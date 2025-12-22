"use strict";
// src/sdk/scoreService.ts
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
exports.submitScore = submitScore;
const database_1 = require("firebase/database");
const firebase_1 = require("../config/firebase");
const getPDAs_1 = require("../utils/getPDAs");
function submitScore(params) {
    return __awaiter(this, void 0, void 0, function* () {
        const { tournamentId, userPublicKey, score, tokenType, gameId } = params;
        try {
            const tt = Number(tokenType);
            if (tt !== getPDAs_1.TokenType.SPL && tt !== getPDAs_1.TokenType.SOL) {
                return {
                    success: false,
                    message: 'tokenType must be 0 (SPL) or 1 (SOL)',
                    errorCode: 'INVALID_TOKEN_TYPE',
                };
            }
            if (typeof score !== 'number' || Number.isNaN(score) || score < 0) {
                return {
                    success: false,
                    message: 'Score must be a non-negative number',
                    errorCode: 'INVALID_SCORE',
                };
            }
            const tournamentRef = (0, database_1.ref)(firebase_1.db, `tournaments/${tt}/${tournamentId}`);
            const snapshot = yield (0, database_1.get)(tournamentRef);
            if (!snapshot.exists()) {
                return {
                    success: false,
                    message: 'Tournament not found',
                    errorCode: 'TOURNAMENT_NOT_FOUND',
                };
            }
            const tournament = snapshot.val();
            // Verify tournament belongs to this game
            if (tournament.gameId !== gameId) {
                return {
                    success: false,
                    message: 'Tournament does not belong to this game',
                    errorCode: 'WRONG_GAME',
                };
            }
            // Verify tournament is active
            if (tournament.status !== 'Active') {
                return {
                    success: false,
                    message: `Tournament is not active. Current status: ${tournament.status}`,
                    errorCode: 'TOURNAMENT_NOT_ACTIVE',
                };
            }
            const participants = tournament.participants || {};
            const participant = participants[userPublicKey];
            if (!participant) {
                return {
                    success: false,
                    message: 'You are not registered in this tournament',
                    errorCode: 'NOT_REGISTERED',
                };
            }
            // Treat missing hasPlayed field as false for backward compatibility
            if (participant.hasPlayed === true) {
                return {
                    success: false,
                    message: 'You have already submitted a score for this tournament',
                    errorCode: 'ALREADY_PLAYED',
                };
            }
            const now = new Date().toISOString();
            const updatedParticipant = Object.assign(Object.assign({}, participant), { score, hasPlayed: true, scoreSubmittedAt: now });
            const participantRef = (0, database_1.ref)(firebase_1.db, `tournaments/${tt}/${tournamentId}/participants/${userPublicKey}`);
            yield (0, database_1.set)(participantRef, updatedParticipant);
            return {
                success: true,
                message: 'Score submitted successfully',
                data: {
                    tournamentId,
                    userPublicKey,
                    score,
                },
            };
        }
        catch (error) {
            console.error('[ScoreService] Error submitting score:', error);
            return {
                success: false,
                message: 'Internal server error',
                errorCode: 'INTERNAL_ERROR',
            };
        }
    });
}
//# sourceMappingURL=scoreService.js.map