// src/gamehub/adminLeaderboardService.ts
import { ref, get } from "firebase/database";
import { db } from "../config/firebase";
import { TokenType } from "../utils/getPDAs";

// Interface for leaderboard entry
interface LeaderboardEntry {
  rank: number;
  playerId: string;
  playerName?: string;
  score: number;
  gameId?: string;
  gameName?: string;
  timestamp?: string;
  totalGames?: number;
  winRate?: number;
  tournamentId?: string;
  tournamentName?: string;
}

interface TournamentLeaderboardData {
  tournamentId: string;
  tournamentName: string;
  gameId: string;
  status: string;
  admin: {
    playerId: string;
    score: number;
    rank: number;
  };
  players: LeaderboardEntry[];
  totalParticipants: number;
}

interface AggregatedAdminLeaderboardData {
  adminPublicKey: string;
  totalTournaments: number;
  tournaments: TournamentLeaderboardData[];
  aggregatedStats: {
    totalPlayers: number;
    averageScore: number;
    highestScore: number;
    tournamentsWon: number;
  };
}

// Get aggregated leaderboards for all tournaments by admin
export const getAdminTournamentsLeaderboards = async (adminPublicKey: string): Promise<{
  success: boolean;
  data?: AggregatedAdminLeaderboardData;
  message?: string;
}> => {
  try {
    // Get all tournaments
    const tournamentsRef = ref(db, 'tournaments');
    const tournamentsSnapshot = await get(tournamentsRef);
    
    if (!tournamentsSnapshot.exists()) {
      return { success: false, message: "No tournaments found" };
    }
    
    const allTournaments = tournamentsSnapshot.val();
    
    // Filter tournaments created by the admin
    const adminTournaments = Object.entries(allTournaments)
      .filter(([_, tournament]) => (tournament as any).createdBy === adminPublicKey)
      .map(([id, tournament]) => ({ id, ...(tournament as any) }));
    
    if (adminTournaments.length === 0) {
      return { success: false, message: "No tournaments found for this admin" };
    }
    
    // Process each tournament to get leaderboard data
    const tournamentLeaderboards: TournamentLeaderboardData[] = [];
    let totalPlayers = 0;
    let totalAdminScore = 0;
    let highestAdminScore = 0;
    let tournamentsWon = 0;
    
    for (const tournament of adminTournaments) {
      const participants = tournament.participants || {};
      const adminId = tournament.createdBy;
      
      // Get admin score (if admin is also a participant)
      const adminScore = participants[adminId]?.score || 0;
      
      // Transform participants into array, excluding admin
      const playerLeaderboard: LeaderboardEntry[] = Object.entries(participants)
        .filter(([playerId]) => playerId !== adminId)
        .map(([playerId, data]) => ({
          rank: 0, // Initial placeholder; will be assigned after sorting
          playerId,
          score: (data as any).score || 0,
          tournamentId: tournament.id,
          tournamentName: tournament.name
        }));
      
      // Add admin to the leaderboard
      const adminEntry: LeaderboardEntry = {
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
      if (adminRank?.rank === 1) {
        tournamentsWon++;
      }
      
      const tournamentData: TournamentLeaderboardData = {
        tournamentId: tournament.id,
        tournamentName: tournament.name,
        gameId: tournament.gameId,
        status: tournament.status,
        admin: {
          playerId: adminId,
          score: adminScore,
          rank: adminRank?.rank || 0
        },
        players: playersRanked,
        totalParticipants: allEntries.length
      };
      
      tournamentLeaderboards.push(tournamentData);
    }
    
    // Calculate aggregated statistics
    const averageScore = adminTournaments.length > 0 ? totalAdminScore / adminTournaments.length : 0;
    
    const responseData: AggregatedAdminLeaderboardData = {
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
  } catch (error) {
    console.error("Error fetching admin tournaments leaderboards:", error);
    return { success: false, message: "Error fetching admin tournaments leaderboards" };
  }
};

// Get single tournament leaderboard against admin (keeping for backward compatibility)
export const getTournamentLeaderboardAgainstAdmin = async (tournamentId: string, tokenType?: TokenType): Promise<{
  success: boolean;
  data?: TournamentLeaderboardData;
  message?: string;
}> => {
  try {
    let tournament: any = null;
    
    // If tokenType is provided, search directly in that path
    if (tokenType !== undefined && tokenType !== null) {
      const tt = Number(tokenType);
      if (tt !== TokenType.SPL && tt !== TokenType.SOL) {
        return { success: false, message: "tokenType must be 0 (SPL) or 1 (SOL)" };
      }
      const tournamentRef = ref(db, `tournaments/${tt}/${tournamentId}`);
      const tournamentSnapshot = await get(tournamentRef);
      
      if (tournamentSnapshot.exists()) {
        tournament = tournamentSnapshot.val();
      }
    } else {
      // If tokenType is not provided, search in both token types
      for (const tt of [TokenType.SPL, TokenType.SOL]) {
        const tournamentRef = ref(db, `tournaments/${tt}/${tournamentId}`);
        const tournamentSnapshot = await get(tournamentRef);
        
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
    const adminScore = participants[adminId]?.score || 0;
    
    // Transform participants into array, excluding admin
    const playerLeaderboard: LeaderboardEntry[] = Object.entries(participants)
      .filter(([playerId]) => playerId !== adminId)
      .map(([playerId, data]) => ({
        rank: 0, // Initial placeholder; will be assigned after sorting
        playerId,
        score: (data as any).score || 0,
        tournamentId: tournament.id,
        tournamentName: tournament.name
      }));
    
    // Add admin to the leaderboard
    const adminEntry: LeaderboardEntry = {
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
    
    const responseData: TournamentLeaderboardData = {
      tournamentId: tournament.id,
      tournamentName: tournament.name,
      gameId: tournament.gameId,
      status: tournament.status,
      admin: {
        playerId: adminId,
        score: adminScore,
        rank: adminRank?.rank || 0
      },
      players: playersRanked,
      totalParticipants: allEntries.length
    };
    
    return {
      success: true,
      data: responseData
    };
  } catch (error) {
    console.error("Error fetching tournament leaderboard against admin:", error);
    return { success: false, message: "Error fetching tournament leaderboard against admin" };
  }
};

