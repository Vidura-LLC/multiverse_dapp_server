"use strict";
// src/sdk/sdkAuthMiddleware.ts
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkTournamentOwnership = exports.hashApiKey = exports.validateGameCredentials = exports.optionalSdkAuth = exports.verifyTournamentOwnership = exports.sdkOrUserAuth = exports.sdkAuth = void 0;
const database_1 = require("firebase/database");
const firebase_1 = require("../config/firebase");
const crypto_1 = __importDefault(require("crypto"));
const hashApiKey = (apiKey) => {
    return crypto_1.default.createHash('sha256').update(apiKey).digest('hex');
};
exports.hashApiKey = hashApiKey;
/**
 * Validate game credentials - direct lookup using gameId as Firebase key
 */
const validateGameCredentials = (gameId, apiKey) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const gameRef = (0, database_1.ref)(firebase_1.db, `games/${gameId}`);
        const snapshot = yield (0, database_1.get)(gameRef);
        if (!snapshot.exists()) {
            console.log(`[SDK Auth] Game not found: ${gameId}`);
            return null;
        }
        const game = snapshot.val();
        if (!game.sdkEnabled) {
            console.log(`[SDK Auth] SDK access disabled for game: ${gameId}`);
            return null;
        }
        const providedKeyHash = hashApiKey(apiKey);
        if (providedKeyHash !== game.apiKeyHash) {
            console.log(`[SDK Auth] Invalid API key for game: ${gameId}`);
            return null;
        }
        return {
            gameId: game.gameId,
            name: game.name,
            developerId: game.userId,
            createdBy: game.createdBy,
        };
    }
    catch (error) {
        console.error('[SDK Auth] Error validating game credentials:', error);
        return null;
    }
});
exports.validateGameCredentials = validateGameCredentials;
const checkTournamentOwnership = (tournamentId, tokenType, gameId) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const tournamentRef = (0, database_1.ref)(firebase_1.db, `tournaments/${tokenType}/${tournamentId}`);
        const snapshot = yield (0, database_1.get)(tournamentRef);
        if (!snapshot.exists()) {
            return { owned: false };
        }
        const tournament = snapshot.val();
        return {
            owned: tournament.gameId === gameId,
            tournament,
        };
    }
    catch (error) {
        console.error('[SDK Auth] Error checking tournament ownership:', error);
        return { owned: false };
    }
});
exports.checkTournamentOwnership = checkTournamentOwnership;
/**
 * SDK Authentication Middleware
 */
const sdkAuth = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const apiKey = req.headers['x-api-key'];
        const gameId = req.headers['x-game-id'];
        if (!apiKey || !gameId) {
            return res.status(401).json({
                success: false,
                error: 'MISSING_CREDENTIALS',
                message: 'Missing SDK credentials: x-api-key and x-game-id headers required',
            });
        }
        if (!apiKey.startsWith('sk_live_') && !apiKey.startsWith('sk_test_')) {
            return res.status(401).json({
                success: false,
                error: 'INVALID_KEY_FORMAT',
                message: 'Invalid API key format',
            });
        }
        const game = yield validateGameCredentials(gameId, apiKey);
        if (!game) {
            return res.status(401).json({
                success: false,
                error: 'INVALID_CREDENTIALS',
                message: 'Invalid SDK credentials',
            });
        }
        req.authType = 'sdk';
        req.game = game;
        next();
    }
    catch (error) {
        console.error('[SDK Auth] Middleware error:', error);
        return res.status(500).json({
            success: false,
            error: 'AUTH_ERROR',
            message: 'Internal server error during authentication',
        });
    }
});
exports.sdkAuth = sdkAuth;
/**
 * Combined Authentication Middleware (SDK or Public Key)
 */
const sdkOrUserAuth = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const apiKey = req.headers['x-api-key'];
    const gameId = req.headers['x-game-id'];
    const publicKey = req.headers['public-key'];
    if (apiKey && gameId) {
        const game = yield validateGameCredentials(gameId, apiKey);
        if (game) {
            req.authType = 'sdk';
            req.game = game;
            return next();
        }
        return res.status(401).json({
            success: false,
            error: 'INVALID_SDK_CREDENTIALS',
            message: 'Invalid SDK credentials',
        });
    }
    if (publicKey) {
        try {
            const { checkUser } = yield Promise.resolve().then(() => __importStar(require('../gamehub/middleware')));
            const user = yield checkUser(publicKey);
            if (user) {
                req.authType = 'publicKey';
                req.user = user;
                return next();
            }
            return res.status(401).json({
                success: false,
                error: 'INVALID_PUBLIC_KEY',
                message: 'Unauthorized: Public key does not match',
            });
        }
        catch (error) {
            console.error('[SDK Auth] Error in public key auth:', error);
            return res.status(500).json({
                success: false,
                error: 'AUTH_ERROR',
                message: 'Internal server error during authentication',
            });
        }
    }
    return res.status(401).json({
        success: false,
        error: 'NO_CREDENTIALS',
        message: 'Authentication required: provide SDK credentials (x-api-key, x-game-id) or public-key header',
    });
});
exports.sdkOrUserAuth = sdkOrUserAuth;
/**
 * Tournament Ownership Verification Middleware
 */
const verifyTournamentOwnership = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    if (req.authType !== 'sdk') {
        return next();
    }
    const { tournamentId, tokenType } = req.body;
    const gameId = (_a = req.game) === null || _a === void 0 ? void 0 : _a.gameId;
    if (!tournamentId || tokenType === undefined || !gameId) {
        return next();
    }
    try {
        const { owned, tournament } = yield checkTournamentOwnership(tournamentId, Number(tokenType), gameId);
        if (!tournament) {
            return next();
        }
        if (!owned) {
            return res.status(403).json({
                success: false,
                error: 'TOURNAMENT_NOT_OWNED',
                message: 'Tournament does not belong to this game',
            });
        }
        req.tournament = tournament;
        next();
    }
    catch (error) {
        console.error('[SDK Auth] Error verifying tournament ownership:', error);
        return res.status(500).json({
            success: false,
            error: 'OWNERSHIP_CHECK_ERROR',
            message: 'Internal server error',
        });
    }
});
exports.verifyTournamentOwnership = verifyTournamentOwnership;
/**
 * Optional SDK Auth Middleware
 */
const optionalSdkAuth = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const apiKey = req.headers['x-api-key'];
    const gameId = req.headers['x-game-id'];
    if (apiKey && gameId) {
        const game = yield validateGameCredentials(gameId, apiKey);
        if (game) {
            req.authType = 'sdk';
            req.game = game;
        }
    }
    next();
});
exports.optionalSdkAuth = optionalSdkAuth;
//# sourceMappingURL=sdkAuthMiddleware.js.map