"use strict";
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
exports.getTournamentsByGame = exports.updateParticipantScore = exports.getTournamentLeaderboard = void 0;
// src/gamehub/leaderboardService.ts
const database_1 = require("firebase/database");
const firebase_1 = require("../config/firebase");
const getPDAs_1 = require("../utils/getPDAs");
// Get tournament leaderboard
const getTournamentLeaderboard = (tournamentId, tokenType) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        let tournament = null;
        // If tokenType is provided, search directly in that path
        if (tokenType !== undefined && tokenType !== null) {
            const tt = Number(tokenType);
            if (tt !== getPDAs_1.TokenType.SPL && tt !== getPDAs_1.TokenType.SOL) {
                return { success: false, message: "tokenType must be 0 (SPL) or 1 (SOL)" };
            }
            const tournamentRef = (0, database_1.ref)(firebase_1.db, `tournaments/${tt}/${tournamentId}`);
            const tournamentSnapshot = yield (0, database_1.get)(tournamentRef);
            if (tournamentSnapshot.exists()) {
                tournament = tournamentSnapshot.val();
            }
        }
        else {
            // If tokenType is not provided, search in both token types
            for (const tt of [getPDAs_1.TokenType.SPL, getPDAs_1.TokenType.SOL]) {
                const tournamentRef = (0, database_1.ref)(firebase_1.db, `tournaments/${tt}/${tournamentId}`);
                const tournamentSnapshot = yield (0, database_1.get)(tournamentRef);
                if (tournamentSnapshot.exists()) {
                    tournament = tournamentSnapshot.val();
                    break;
                }
            }
        }
        if (!tournament) {
            return { success: false, message: "Tournament not found" };
        }
        const participants = tournament.participants || {};
        // Transform participants into array
        const leaderboard = Object.entries(participants).map(([playerId, data]) => ({
            rank: 0, // Initial placeholder; will be assigned after sorting
            playerId,
            score: data.score || 0
        }));
        // Sort by score (highest first)
        leaderboard.sort((a, b) => b.score - a.score);
        // Assign ranks (1-based)
        leaderboard.forEach((entry, index) => {
            entry.rank = index + 1;
        });
        return {
            success: true,
            data: {
                tournamentName: tournament.name,
                gameId: tournament.gameId,
                status: tournament.status,
                leaderboard
            }
        };
    }
    catch (error) {
        console.error("Error fetching tournament leaderboard:", error);
        return { success: false, message: "Error fetching tournament leaderboard" };
    }
});
exports.getTournamentLeaderboard = getTournamentLeaderboard;
// Update participant score - Firebase only
const updateParticipantScore = (tournamentId, participantId, score, tokenType) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        let tournamentPath = '';
        let tournament = null;
        // If tokenType is provided, search directly in that path
        if (tokenType !== undefined && tokenType !== null) {
            const tt = Number(tokenType);
            if (tt !== getPDAs_1.TokenType.SPL && tt !== getPDAs_1.TokenType.SOL) {
                return { success: false, message: "tokenType must be 0 (SPL) or 1 (SOL)" };
            }
            tournamentPath = `tournaments/${tt}/${tournamentId}`;
            const tournamentRef = (0, database_1.ref)(firebase_1.db, tournamentPath);
            const tournamentSnapshot = yield (0, database_1.get)(tournamentRef);
            if (tournamentSnapshot.exists()) {
                tournament = tournamentSnapshot.val();
            }
        }
        else {
            // If tokenType is not provided, search in both token types
            for (const tt of [getPDAs_1.TokenType.SPL, getPDAs_1.TokenType.SOL]) {
                tournamentPath = `tournaments/${tt}/${tournamentId}`;
                const tournamentRef = (0, database_1.ref)(firebase_1.db, tournamentPath);
                const tournamentSnapshot = yield (0, database_1.get)(tournamentRef);
                if (tournamentSnapshot.exists()) {
                    tournament = tournamentSnapshot.val();
                    break;
                }
            }
        }
        if (!tournament || !tournamentPath) {
            return { success: false, message: "Tournament not found" };
        }
        // Check if participant exists
        if (!tournament.participants || !tournament.participants[participantId]) {
            return { success: false, message: "Participant not found in tournament" };
        }
        // Update participant score in Firebase only
        const participantRef = (0, database_1.ref)(firebase_1.db, `${tournamentPath}/participants/${participantId}`);
        yield (0, database_1.set)(participantRef, { score });
        return { success: true, message: "Score updated successfully" };
    }
    catch (error) {
        console.error("Error updating participant score:", error);
        return { success: false, message: "Error updating participant score" };
    }
});
exports.updateParticipantScore = updateParticipantScore;
// Get tournaments by game
const getTournamentsByGame = (gameId, tokenType) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const tournamentsRef = (0, database_1.ref)(firebase_1.db, `tournaments/${tokenType}`);
        const snapshot = yield (0, database_1.get)(tournamentsRef);
        if (!snapshot.exists()) {
            return { success: true, data: [] };
        }
        const tournaments = snapshot.val();
        const filteredTournaments = Object.entries(tournaments)
            .filter(([_, tournament]) => tournament.gameId === gameId)
            .map(([id, tournament]) => (Object.assign({ id }, tournament)));
        return { success: true, data: filteredTournaments };
    }
    catch (error) {
        console.error("Error fetching tournaments by game:", error);
        return { success: false, message: "Error fetching tournaments" };
    }
});
exports.getTournamentsByGame = getTournamentsByGame;
//# sourceMappingURL=leaderboardService.js.map