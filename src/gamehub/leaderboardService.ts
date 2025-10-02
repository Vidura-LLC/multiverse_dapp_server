// src/gamehub/leaderboardService.ts
import { ref, get, set, query, orderByChild, limitToLast, startAt, endAt } from "firebase/database";
import { db } from "../config/firebase";

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
export const getTournamentLeaderboard = async (tournamentId: string) => {
  try {
    // Get tournament data
    const tournamentRef = ref(db, `tournaments/${tournamentId}`);
    const tournamentSnapshot = await get(tournamentRef);
    
    if (!tournamentSnapshot.exists()) {
      return { success: false, message: "Tournament not found" };
    }
    
    const tournament = tournamentSnapshot.val();
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
export const updateParticipantScore = async (tournamentId: string, participantId: string, score: number) => {
  try {
    const tournamentRef = ref(db, `tournaments/${tournamentId}`);
    const tournamentSnapshot = await get(tournamentRef);
    
    if (!tournamentSnapshot.exists()) {
      return { success: false, message: "Tournament not found" };
    }
    
    const tournament = tournamentSnapshot.val();
    
    // Check if participant exists
    if (!tournament.participants || !tournament.participants[participantId]) {
      return { success: false, message: "Participant not found in tournament" };
    }
    
    // Update participant score in Firebase only
    const participantRef = ref(db, `tournaments/${tournamentId}/participants/${participantId}`);
    await set(participantRef, { score });
    
    return { success: true, message: "Score updated successfully" };
  } catch (error) {
    console.error("Error updating participant score:", error);
    return { success: false, message: "Error updating participant score" };
  }
};

// Get tournaments by game
export const getTournamentsByGame = async (gameId: string) => {
  try {
    const tournamentsRef = ref(db, 'tournaments');
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