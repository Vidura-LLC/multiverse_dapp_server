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
exports.getTournamentLeaderboardAgainstAdmin = exports.getAdminTournamentsLeaderboards = void 0;
// src/gamehub/adminLeaderboardService.ts
const database_1 = require("firebase/database");
const firebase_1 = require("../config/firebase");
const getPDAs_1 = require("../utils/getPDAs");
// Get aggregated leaderboards for all tournaments by admin
const getAdminTournamentsLeaderboards = (adminPublicKey) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        // Get all tournaments
        const tournamentsRef = (0, database_1.ref)(firebase_1.db, 'tournaments');
        const tournamentsSnapshot = yield (0, database_1.get)(tournamentsRef);
        if (!tournamentsSnapshot.exists()) {
            return { success: false, message: "No tournaments found" };
        }
        const allTournaments = tournamentsSnapshot.val();
        // Filter tournaments created by the admin
        const adminTournaments = Object.entries(allTournaments)
            .filter(([_, tournament]) => tournament.createdBy === adminPublicKey)
            .map(([id, tournament]) => (Object.assign({ id }, tournament)));
        if (adminTournaments.length === 0) {
            return { success: false, message: "No tournaments found for this admin" };
        }
        // Process each tournament to get leaderboard data
        const tournamentLeaderboards = [];
        let totalPlayers = 0;
        let totalAdminScore = 0;
        let highestAdminScore = 0;
        let tournamentsWon = 0;
        for (const tournament of adminTournaments) {
            const participants = tournament.participants || {};
            const adminId = tournament.createdBy;
            // Get admin score (if admin is also a participant)
            const adminScore = ((_a = participants[adminId]) === null || _a === void 0 ? void 0 : _a.score) || 0;
            // Transform participants into array, excluding admin
            const playerLeaderboard = Object.entries(participants)
                .filter(([playerId]) => playerId !== adminId)
                .map(([playerId, data]) => ({
                rank: 0, // Initial placeholder; will be assigned after sorting
                playerId,
                score: data.score || 0,
                tournamentId: tournament.id,
                tournamentName: tournament.name
            }));
            // Add admin to the leaderboard
            const adminEntry = {
                rank: 0,
                playerId: adminId,
                score: adminScore,
                tournamentId: tournament.id,
                tournamentName: tournament.name
            };
            // Combine admin and players
            const allEntries = [adminEntry, ...playerLeaderboard];
            // Sort by score (highest first)
            allEntries.sort((a, b) => b.score - a.score);
            // Assign ranks (1-based)
            allEntries.forEach((entry, index) => {
                entry.rank = index + 1;
            });
            // Separate admin and players for response
            const adminRank = allEntries.find(entry => entry.playerId === adminId);
            const playersRanked = allEntries.filter(entry => entry.playerId !== adminId);
            // Track aggregated stats
            totalPlayers += allEntries.length;
            totalAdminScore += adminScore;
            if (adminScore > highestAdminScore) {
                highestAdminScore = adminScore;
            }
            if ((adminRank === null || adminRank === void 0 ? void 0 : adminRank.rank) === 1) {
                tournamentsWon++;
            }
            const tournamentData = {
                tournamentId: tournament.id,
                tournamentName: tournament.name,
                gameId: tournament.gameId,
                status: tournament.status,
                admin: {
                    playerId: adminId,
                    score: adminScore,
                    rank: (adminRank === null || adminRank === void 0 ? void 0 : adminRank.rank) || 0
                },
                players: playersRanked,
                totalParticipants: allEntries.length
            };
            tournamentLeaderboards.push(tournamentData);
        }
        // Calculate aggregated statistics
        const averageScore = adminTournaments.length > 0 ? totalAdminScore / adminTournaments.length : 0;
        const responseData = {
            adminPublicKey,
            totalTournaments: adminTournaments.length,
            tournaments: tournamentLeaderboards,
            aggregatedStats: {
                totalPlayers,
                averageScore: Math.round(averageScore * 100) / 100, // Round to 2 decimal places
                highestScore: highestAdminScore,
                tournamentsWon
            }
        };
        return {
            success: true,
            data: responseData
        };
    }
    catch (error) {
        console.error("Error fetching admin tournaments leaderboards:", error);
        return { success: false, message: "Error fetching admin tournaments leaderboards" };
    }
});
exports.getAdminTournamentsLeaderboards = getAdminTournamentsLeaderboards;
// Get single tournament leaderboard against admin (keeping for backward compatibility)
const getTournamentLeaderboardAgainstAdmin = (tournamentId, tokenType) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
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
        const adminId = tournament.createdBy;
        if (!adminId) {
            return { success: false, message: "Admin not found for this tournament" };
        }
        // Get admin score (if admin is also a participant)
        const adminScore = ((_a = participants[adminId]) === null || _a === void 0 ? void 0 : _a.score) || 0;
        // Transform participants into array, excluding admin
        const playerLeaderboard = Object.entries(participants)
            .filter(([playerId]) => playerId !== adminId)
            .map(([playerId, data]) => ({
            rank: 0, // Initial placeholder; will be assigned after sorting
            playerId,
            score: data.score || 0,
            tournamentId: tournament.id,
            tournamentName: tournament.name
        }));
        // Add admin to the leaderboard
        const adminEntry = {
            rank: 0,
            playerId: adminId,
            score: adminScore,
            tournamentId: tournament.id,
            tournamentName: tournament.name
        };
        // Combine admin and players
        const allEntries = [adminEntry, ...playerLeaderboard];
        // Sort by score (highest first)
        allEntries.sort((a, b) => b.score - a.score);
        // Assign ranks (1-based)
        allEntries.forEach((entry, index) => {
            entry.rank = index + 1;
        });
        // Separate admin and players for response
        const adminRank = allEntries.find(entry => entry.playerId === adminId);
        const playersRanked = allEntries.filter(entry => entry.playerId !== adminId);
        const responseData = {
            tournamentId: tournament.id,
            tournamentName: tournament.name,
            gameId: tournament.gameId,
            status: tournament.status,
            admin: {
                playerId: adminId,
                score: adminScore,
                rank: (adminRank === null || adminRank === void 0 ? void 0 : adminRank.rank) || 0
            },
            players: playersRanked,
            totalParticipants: allEntries.length
        };
        return {
            success: true,
            data: responseData
        };
    }
    catch (error) {
        console.error("Error fetching tournament leaderboard against admin:", error);
        return { success: false, message: "Error fetching tournament leaderboard against admin" };
    }
});
exports.getTournamentLeaderboardAgainstAdmin = getTournamentLeaderboardAgainstAdmin;
//# sourceMappingURL=adminLeaderboardService.js.map