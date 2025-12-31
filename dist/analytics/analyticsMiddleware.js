"use strict";
// src/analytics/analyticsMiddleware.ts
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
exports.requireAdmin = exports.requireGameOwnership = void 0;
const database_1 = require("firebase/database");
const firebase_1 = require("../config/firebase");
const middleware_1 = require("../gamehub/middleware");
/**
 * Middleware to verify user owns the game (for developer endpoints)
 * Checks if the authenticated user's userId matches the game's userId
 */
const requireGameOwnership = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { gameId } = req.params;
        const publicKey = req.headers['public-key'];
        if (!publicKey) {
            return res.status(401).json({
                success: false,
                error: 'UNAUTHORIZED',
                message: 'Authentication required: public-key header missing',
            });
        }
        // Get game from Firebase first
        const gameRef = (0, database_1.ref)(firebase_1.db, `games/${gameId}`);
        const gameSnapshot = yield (0, database_1.get)(gameRef);
        if (!gameSnapshot.exists()) {
            return res.status(404).json({
                success: false,
                error: 'NOT_FOUND',
                message: 'Game not found',
            });
        }
        const game = gameSnapshot.val();
        // Check if user owns the game by checking createdBy first (most reliable)
        // This allows access even if user doesn't exist in users table yet
        if (game.createdBy === publicKey) {
            // User owns the game, proceed
            // Try to get user data, but don't fail if it doesn't exist
            const user = yield (0, middleware_1.checkUser)(publicKey);
            req.gameData = game;
            req.user = user || { id: null, publicKey };
            return next();
        }
        // If createdBy doesn't match, check user in database and userId
        const user = yield (0, middleware_1.checkUser)(publicKey);
        if (!user) {
            return res.status(401).json({
                success: false,
                error: 'UNAUTHORIZED',
                message: 'Invalid user or you do not have access to this game',
            });
        }
        // Check if user owns the game via userId
        // Note: userId in game might be Clerk user ID, while user.id might be different
        const ownsGame = game.userId === user.id || game.createdBy === publicKey;
        if (!ownsGame) {
            return res.status(403).json({
                success: false,
                error: 'FORBIDDEN',
                message: 'You do not have access to this game',
            });
        }
        // Attach game to request for use in controllers
        req.gameData = game;
        req.user = user;
        next();
    }
    catch (error) {
        console.error('[Analytics] Error in requireGameOwnership:', error);
        return res.status(500).json({
            success: false,
            error: 'INTERNAL_ERROR',
            message: 'Internal server error during authentication',
        });
    }
});
exports.requireGameOwnership = requireGameOwnership;
/**
 * Middleware to verify admin access
 * Checks if user is admin based on public key or role
 */
const requireAdmin = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const publicKey = req.headers['public-key'];
        const adminPublicKey = process.env.ADMIN_PUBLIC_KEY || process.env.NEXT_PUBLIC_ADMIN_PUBLIC_KEY;
        // Check if public key matches admin public key
        if (publicKey && adminPublicKey && publicKey === adminPublicKey) {
            return next();
        }
        // Alternatively, check user role from database
        if (publicKey) {
            const user = yield (0, middleware_1.checkUser)(publicKey);
            if (user && (user.role === 'admin' || user.role === 'super_admin')) {
                return next();
            }
        }
        return res.status(403).json({
            success: false,
            error: 'FORBIDDEN',
            message: 'Admin access required',
        });
    }
    catch (error) {
        console.error('[Analytics] Error in requireAdmin:', error);
        return res.status(500).json({
            success: false,
            error: 'INTERNAL_ERROR',
            message: 'Internal server error during authentication',
        });
    }
});
exports.requireAdmin = requireAdmin;
//# sourceMappingURL=analyticsMiddleware.js.map