"use strict";
// src/sdk/sdkRoutes.ts
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
const express_1 = require("express");
const sdkAuthMiddleware_1 = require("./sdkAuthMiddleware");
const sdkCredentialsController_1 = require("./sdkCredentialsController");
const gamehubController_1 = require("../gamehub/gamehubController");
const sdkController_1 = require("./sdkController");
const router = (0, express_1.Router)();
// ============================================
// Game & SDK Credential Management Routes
// ============================================
router.post('/games', sdkCredentialsController_1.createGameController);
router.post('/games/:gameId/rotate-key', sdkCredentialsController_1.rotateGameApiKeyController);
router.post('/games/:gameId/revoke-sdk', sdkCredentialsController_1.revokeGameSdkAccessController);
router.post('/games/:gameId/enable-sdk', sdkCredentialsController_1.enableGameSdkAccessController);
router.get('/games/:gameId/sdk-status', sdkCredentialsController_1.getGameSdkStatusController);
// ============================================
// SDK-Authenticated Endpoints
// ============================================
router.get('/health', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'Multiversed SDK API is running',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
    });
});
router.post('/verify', sdkAuthMiddleware_1.sdkAuth, ((req, res) => {
    var _a, _b;
    res.status(200).json({
        success: true,
        message: 'SDK credentials are valid',
        game: {
            gameId: (_a = req.game) === null || _a === void 0 ? void 0 : _a.gameId,
            name: (_b = req.game) === null || _b === void 0 ? void 0 : _b.name,
        },
    });
}));
router.get('/tournaments', sdkAuthMiddleware_1.sdkAuth, ((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const gameId = (_a = req.game) === null || _a === void 0 ? void 0 : _a.gameId;
    const { tokenType } = req.query;
    if (!tokenType) {
        return res.status(400).json({
            success: false,
            message: 'tokenType query parameter is required',
        });
    }
    req.params.gameId = gameId;
    req.params.tokenType = tokenType;
    return (0, gamehubController_1.getTournamentsByGameController)(req, res);
})));
router.get('/tournaments/:id', sdkAuthMiddleware_1.sdkAuth, gamehubController_1.getTournamentById);
router.post('/tournaments/prepare-registration', sdkAuthMiddleware_1.sdkAuth, sdkAuthMiddleware_1.verifyTournamentOwnership, gamehubController_1.registerForTournamentController);
router.post('/tournaments/confirm-registration', sdkAuthMiddleware_1.sdkAuth, sdkAuthMiddleware_1.verifyTournamentOwnership, gamehubController_1.confirmParticipationController);
router.get('/tournaments/:id/leaderboard', sdkAuthMiddleware_1.sdkAuth, gamehubController_1.getTournamentLeaderboardController);
router.post('/tournaments/:tournamentId/score', sdkAuthMiddleware_1.sdkAuth, sdkController_1.submitScoreController);
exports.default = router;
//# sourceMappingURL=sdkRoutes.js.map