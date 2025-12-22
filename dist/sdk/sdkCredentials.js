"use strict";
// src/sdk/sdkCredentials.ts
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getGameById = exports.verifyApiKey = exports.getSdkStatus = exports.enableSdkAccess = exports.revokeSdkAccess = exports.rotateApiKey = exports.createGameWithCredentials = void 0;
const database_1 = require("firebase/database");
const firebase_1 = require("../config/firebase");
const sdkCredentialsHelper_1 = require("../utils/sdkCredentialsHelper");
/**
 * Create a new game with SDK credentials
 * Single gameId approach: Client provides `gameId`, used for everything
 */
const createGameWithCredentials = (gameData) => __awaiter(void 0, void 0, void 0, function* () {
    const { apiKey, credentialData } = (0, sdkCredentialsHelper_1.generateSdkCredentials)(gameData.gameId);
    const now = new Date().toISOString();
    const game = {
        id: gameData.gameId,
        gameId: gameData.gameId,
        name: gameData.name,
        description: gameData.description,
        userId: gameData.userId,
        createdBy: gameData.adminPublicKey,
        image: gameData.image || '',
        status: gameData.status || 'draft',
        createdAt: new Date(now), // Store as Date object for type compatibility, but Firebase will serialize it
        updatedAt: new Date(now),
        apiKeyHash: credentialData.apiKeyHash,
        apiKeyPrefix: credentialData.apiKeyPrefix,
        sdkEnabled: credentialData.sdkEnabled,
    };
    // Convert Date objects to ISO strings for Firebase storage
    const gameForFirebase = Object.assign(Object.assign({}, game), { createdAt: now, updatedAt: now });
    const gameRef = (0, database_1.ref)(firebase_1.db, `games/${gameData.gameId}`);
    yield (0, database_1.set)(gameRef, gameForFirebase);
    return {
        gameId: gameData.gameId,
        credentials: {
            gameId: gameData.gameId,
            apiKey,
            apiKeyPrefix: credentialData.apiKeyPrefix,
            warning: 'Store your API key securely. It cannot be retrieved later.',
        },
    };
});
exports.createGameWithCredentials = createGameWithCredentials;
/**
 * Rotate API key for an existing game
 */
const rotateApiKey = (gameId, adminPublicKey) => __awaiter(void 0, void 0, void 0, function* () {
    const gameRef = (0, database_1.ref)(firebase_1.db, `games/${gameId}`);
    const snapshot = yield (0, database_1.get)(gameRef);
    if (!snapshot.exists()) {
        throw new Error('Game not found');
    }
    const game = snapshot.val();
    if (game.createdBy !== adminPublicKey) {
        throw new Error('Not authorized to rotate keys for this game');
    }
    const newApiKey = (0, sdkCredentialsHelper_1.generateApiKey)('live');
    const newApiKeyHash = (0, sdkCredentialsHelper_1.hashApiKey)(newApiKey);
    const newApiKeyPrefix = (0, sdkCredentialsHelper_1.getApiKeyPrefix)(newApiKey);
    yield (0, database_1.update)(gameRef, {
        apiKeyHash: newApiKeyHash,
        apiKeyPrefix: newApiKeyPrefix,
        apiKeyRotatedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    });
    return {
        gameId: game.gameId,
        apiKey: newApiKey,
        apiKeyPrefix: newApiKeyPrefix,
        warning: 'Store your API key securely. It cannot be retrieved later.',
    };
});
exports.rotateApiKey = rotateApiKey;
/**
 * Revoke SDK access for a game
 */
const revokeSdkAccess = (gameId, adminPublicKey) => __awaiter(void 0, void 0, void 0, function* () {
    const gameRef = (0, database_1.ref)(firebase_1.db, `games/${gameId}`);
    const snapshot = yield (0, database_1.get)(gameRef);
    if (!snapshot.exists()) {
        throw new Error('Game not found');
    }
    const game = snapshot.val();
    if (game.createdBy !== adminPublicKey) {
        throw new Error('Not authorized');
    }
    yield (0, database_1.update)(gameRef, {
        sdkEnabled: false,
        sdkRevokedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    });
});
exports.revokeSdkAccess = revokeSdkAccess;
/**
 * Re-enable SDK access with new credentials
 */
const enableSdkAccess = (gameId, adminPublicKey) => __awaiter(void 0, void 0, void 0, function* () {
    const gameRef = (0, database_1.ref)(firebase_1.db, `games/${gameId}`);
    const snapshot = yield (0, database_1.get)(gameRef);
    if (!snapshot.exists()) {
        throw new Error('Game not found');
    }
    const game = snapshot.val();
    if (game.createdBy !== adminPublicKey) {
        throw new Error('Not authorized');
    }
    const newApiKey = (0, sdkCredentialsHelper_1.generateApiKey)('live');
    const newApiKeyHash = (0, sdkCredentialsHelper_1.hashApiKey)(newApiKey);
    const newApiKeyPrefix = (0, sdkCredentialsHelper_1.getApiKeyPrefix)(newApiKey);
    yield (0, database_1.update)(gameRef, {
        apiKeyHash: newApiKeyHash,
        apiKeyPrefix: newApiKeyPrefix,
        sdkEnabled: true,
        sdkEnabledAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    });
    return {
        gameId: game.gameId,
        apiKey: newApiKey,
        apiKeyPrefix: newApiKeyPrefix,
        warning: 'Store your API key securely. It cannot be retrieved later.',
    };
});
exports.enableSdkAccess = enableSdkAccess;
/**
 * Get SDK status for a game
 */
const getSdkStatus = (gameId, adminPublicKey) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c;
    const gameRef = (0, database_1.ref)(firebase_1.db, `games/${gameId}`);
    const snapshot = yield (0, database_1.get)(gameRef);
    if (!snapshot.exists()) {
        throw new Error('Game not found');
    }
    const game = snapshot.val();
    if (game.createdBy !== adminPublicKey) {
        throw new Error('Not authorized');
    }
    // Handle createdAt - Firebase might store it as Date, timestamp, or undefined
    let createdAt = null;
    if (game.createdAt) {
        if (game.createdAt instanceof Date) {
            createdAt = game.createdAt.toISOString();
        }
        else if (typeof game.createdAt === 'string') {
            // If it's already a string, validate it's a valid date
            const date = new Date(game.createdAt);
            createdAt = isNaN(date.getTime()) ? null : date.toISOString();
        }
        else if (typeof game.createdAt === 'number') {
            // If it's a timestamp
            createdAt = new Date(game.createdAt).toISOString();
        }
    }
    return {
        gameId: game.gameId,
        sdkEnabled: (_a = game.sdkEnabled) !== null && _a !== void 0 ? _a : false,
        apiKeyPrefix: (_b = game.apiKeyPrefix) !== null && _b !== void 0 ? _b : null,
        apiKeyRotatedAt: (_c = game.apiKeyRotatedAt) !== null && _c !== void 0 ? _c : null,
        createdAt: createdAt !== null && createdAt !== void 0 ? createdAt : null, // Return null if createdAt is not available
    };
});
exports.getSdkStatus = getSdkStatus;
/**
 * Verify API key for a game
 */
const verifyApiKey = (gameId, apiKey) => __awaiter(void 0, void 0, void 0, function* () {
    const gameRef = (0, database_1.ref)(firebase_1.db, `games/${gameId}`);
    const snapshot = yield (0, database_1.get)(gameRef);
    if (!snapshot.exists()) {
        return false;
    }
    const game = snapshot.val();
    if (!game.sdkEnabled) {
        return false;
    }
    const providedKeyHash = (0, sdkCredentialsHelper_1.hashApiKey)(apiKey);
    return providedKeyHash === game.apiKeyHash;
});
exports.verifyApiKey = verifyApiKey;
/**
 * Get game by gameId
 */
const getGameById = (gameId) => __awaiter(void 0, void 0, void 0, function* () {
    const gameRef = (0, database_1.ref)(firebase_1.db, `games/${gameId}`);
    const snapshot = yield (0, database_1.get)(gameRef);
    if (!snapshot.exists()) {
        return null;
    }
    return snapshot.val();
});
exports.getGameById = getGameById;
//# sourceMappingURL=sdkCredentials.js.map