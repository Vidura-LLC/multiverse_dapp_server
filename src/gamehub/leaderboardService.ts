// src/gamehub/leaderboardService.ts
import { ref, get, set, query, orderByChild, limitToLast, startAt, endAt } from "firebase/database";
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
}

interface LeaderboardData {
  period: string;
  entries: LeaderboardEntry[];
  totalPlayers: number;
  lastUpdated: string;
  nextReset?: string;
  filters: any;
}

// Get tournament leaderboard
export const getTournamentLeaderboard = async (tournamentId: string, tokenType?: TokenType) => {
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
    
    // Transform participants into array
    const leaderboard: LeaderboardEntry[] = Object.entries(participants).map(([playerId, data]) => ({
      rank: 0, // Initial placeholder; will be assigned after sorting
      playerId,
      score: (data as any).score || 0
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
  } catch (error) {
    console.error("Error fetching tournament leaderboard:", error);
    return { success: false, message: "Error fetching tournament leaderboard" };
  }
};

// Update participant score - Firebase only
export const updateParticipantScore = async (tournamentId: string, participantId: string, score: number, tokenType?: TokenType) => {
  try {
    let tournamentPath: string = '';
    let tournament: any = null;
    
    // If tokenType is provided, search directly in that path
    if (tokenType !== undefined && tokenType !== null) {
      const tt = Number(tokenType);
      if (tt !== TokenType.SPL && tt !== TokenType.SOL) {
        return { success: false, message: "tokenType must be 0 (SPL) or 1 (SOL)" };
      }
      tournamentPath = `tournaments/${tt}/${tournamentId}`;
      const tournamentRef = ref(db, tournamentPath);
      const tournamentSnapshot = await get(tournamentRef);
      
      if (tournamentSnapshot.exists()) {
        tournament = tournamentSnapshot.val();
      }
    } else {
      // If tokenType is not provided, search in both token types
      for (const tt of [TokenType.SPL, TokenType.SOL]) {
        tournamentPath = `tournaments/${tt}/${tournamentId}`;
        const tournamentRef = ref(db, tournamentPath);
        const tournamentSnapshot = await get(tournamentRef);
        
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
    const participantRef = ref(db, `${tournamentPath}/participants/${participantId}`);
    await set(participantRef, { score });
    
    return { success: true, message: "Score updated successfully" };
  } catch (error) {
    console.error("Error updating participant score:", error);
    return { success: false, message: "Error updating participant score" };
  }
};

// Get tournaments by game
export const getTournamentsByGame = async (gameId: string, tokenType: TokenType) => {
  try {
    const tournamentsRef = ref(db, `tournaments/${tokenType}`);
    const snapshot = await get(tournamentsRef);
    
    if (!snapshot.exists()) {
      return { success: true, data: [] };
    }
    
    const tournaments = snapshot.val();
    const filteredTournaments = Object.entries(tournaments)
      .filter(([_, tournament]) => (tournament as any).gameId === gameId)
      .map(([id, tournament]) => ({
        id,
        ...(tournament as any)
      }));
    
    return { success: true, data: filteredTournaments };
  } catch (error) {
    console.error("Error fetching tournaments by game:", error);
    return { success: false, message: "Error fetching tournaments" };
  }
};