"use strict";
// src/sdk/sdkController.ts
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
exports.submitScoreController = void 0;
const getPDAs_1 = require("../utils/getPDAs");
const scoreService_1 = require("./scoreService");
const submitScoreController = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    try {
        const { tournamentId } = req.params;
        const { userPublicKey, score, tokenType } = (_a = req.body) !== null && _a !== void 0 ? _a : {};
        const gameId = (_b = req.game) === null || _b === void 0 ? void 0 : _b.gameId;
        // Basic request validation
        if (!tournamentId || !userPublicKey || tokenType === undefined || tokenType === null || score === undefined) {
            res.status(400).json({
                success: false,
                message: 'Missing required fields',
            });
            return;
        }
        if (typeof userPublicKey !== 'string' || userPublicKey.trim().length === 0) {
            res.status(400).json({
                success: false,
                message: 'userPublicKey must be a non-empty string',
            });
            return;
        }
        const numericScore = Number(score);
        if (Number.isNaN(numericScore) || numericScore < 0) {
            res.status(400).json({
                success: false,
                message: 'Score must be a non-negative number',
            });
            return;
        }
        const tt = Number(tokenType);
        if (tt !== getPDAs_1.TokenType.SPL && tt !== getPDAs_1.TokenType.SOL) {
            res.status(400).json({
                success: false,
                message: 'tokenType must be 0 (SPL) or 1 (SOL)',
            });
            return;
        }
        if (!gameId) {
            // This should not happen if sdkAuth middleware ran correctly
            res.status(401).json({
                success: false,
                message: 'Unauthorized: game context missing',
            });
            return;
        }
        const result = yield (0, scoreService_1.submitScore)({
            tournamentId,
            userPublicKey,
            score: numericScore,
            tokenType: tt,
            gameId,
        });
        if (result.success) {
            res.status(200).json(result);
            return;
        }
        // Map business errors to HTTP status codes
        switch (result.errorCode) {
            case 'INVALID_SCORE':
                res.status(400).json(result);
                return;
            case 'INVALID_TOKEN_TYPE':
                res.status(400).json(result);
                return;
            case 'ALREADY_PLAYED':
                res.status(400).json({
                    success: false,
                    message: 'You have already submitted a score for this tournament',
                });
                return;
            case 'TOURNAMENT_NOT_ACTIVE':
                res.status(400).json(result);
                return;
            case 'NOT_REGISTERED':
                res.status(403).json(result);
                return;
            case 'WRONG_GAME':
                res.status(403).json(result);
                return;
            case 'TOURNAMENT_NOT_FOUND':
                res.status(404).json(result);
                return;
            default:
                res.status(500).json({
                    success: false,
                    message: 'Internal server error',
                });
                return;
        }
    }
    catch (error) {
        console.error('[SDK] submitScoreController error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
        });
    }
});
exports.submitScoreController = submitScoreController;
//# sourceMappingURL=sdkController.js.map