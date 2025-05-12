import { Request, Response } from "express";
import { ref, get, set, push, update } from "firebase/database";
import { db } from "../config/firebase";
import { getTournamentPool, registerForTournamentService, initializeTournamentPoolService } from './services';
import { getTournamentLeaderboard, updateParticipantScore, getTournamentsByGame } from "./leaderboardService";
import { PublicKey } from "@solana/web3.js";
import schedule from 'node-schedule'
// Define Tournament interface
interface Tournament {
  id: string;
  name: string;
  description: string;
  entryFee: string;
  startTime: string;
  endTime: string;
  gameId: string;
  max_participants: number,
  participants: { [key: string]: { joinedAt: string; score: number } };
  participantsCount: number;
  status: "Active" | "Paused" | "Ended",
  createdBy: string
}


export async function getAllGames(req: Request, res: Response) {
  try {
    const gamesRef = ref(db, "games");
    const gamesSnapshot = await get(gamesRef);

    if (!gamesSnapshot.exists()) {
      return res.status(404).json({ message: "No games found" });
    }

    const gamesObject = gamesSnapshot.val(); // Object with game IDs as keys
    const gamesArray = Object.keys(gamesObject).map((gameId) => ({
      id: gameId,
      ...gamesObject[gameId], // Spread the game details
    }));

    return res.status(200).json({ games: gamesArray });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}

export async function createTournament(req: Request, res: Response) {
  try {
    const { name, description, startTime, endTime, gameId } = req.body as Tournament;
    const { mint, adminPublicKey, entryFee } = req.body;
    const maxParticipants = 100;

    if (!name || !gameId || !startTime || !endTime || !adminPublicKey || !entryFee || !mint) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const endTimeInUnix = Math.floor(new Date(endTime).getTime() / 1000);
    const pubKey = new PublicKey(adminPublicKey);

    const tournamentsRef = ref(db, "tournaments");
    const newTournamentRef = push(tournamentsRef);
    const tournamentId = newTournamentRef.key;

    if (!tournamentId) {
      return res.status(500).json({ message: "Failed to generate tournament ID" });
    }

    const transaction = await initializeTournamentPoolService(
      pubKey,
      tournamentId,
      entryFee,
      maxParticipants,
      endTimeInUnix,
      mint
    );

    res.status(201).json({
      message: "Tournament created successfully",
      transaction
    });

    const tournament = {
      id: tournamentId,
      name,
      description,
      startTime,
      endTime,
      gameId,
      maxParticipants,
      entryFee,
      createdAt: new Date().toISOString(),
      participants: {},
      participantsCount: 0,
      status: "Not Started",
      createdBy: adminPublicKey
    };

    await set(newTournamentRef, tournament);

    const tournamentRef = ref(db, `tournaments/${tournamentId}`);

    schedule.scheduleJob(new Date(startTime), async () => {
      try {
        await update(tournamentRef, { status: "Active" });
        console.log(`Tournament ${tournamentId} has started.`);
      } catch (error) {
        console.error(`Failed to start tournament ${tournamentId}:`, error);
      }
    });

    schedule.scheduleJob(new Date(endTime), async () => {
      try {
        await update(tournamentRef, { status: "Ended" });
        console.log(`Tournament ${tournamentId} has ended.`);
      } catch (error) {
        console.error(`Failed to end tournament ${tournamentId}:`, error);
      }
    });

  } catch (error) {
    console.error("Error creating tournament:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}

// Controller function to retrieve active tournament data
export const getActiveTournament = async (req: Request, res: Response) => {
  try {
    // Reference to the Tournament Data in Firebase
    const tournamentRef = ref(db, 'tournaments');  // Assuming you have a 'tournaments' node in Firebase
    const snapshot = await get(tournamentRef);

    if (snapshot.exists()) {
      const tournamentsData = snapshot.val();  // All tournaments data

      // Filter active tournaments based on status
      const activeTournaments = Object.values(tournamentsData).filter(
        (tournament: Tournament) => tournament.status === "Active"
      );

      if (activeTournaments.length > 0) {
        return res.status(200).json({
          message: "Active tournament(s) found",
          tournaments: activeTournaments  // Return the active tournaments
        });
      } else {
        console.log("No active tournaments.");
        return res.status(404).json({
          message: "No active tournaments"
        });  // No active tournament found
      }
    } else {
      console.log("No tournament data found in the database.");
      return res.status(404).json({
        message: "No tournament data found"
      });
    }
  } catch (error) {
    console.error("Error fetching tournament data: ", error);
    return res.status(500).json({
      message: "Internal server error"
    });
  }
};

export async function getTournaments(req: Request, res: Response) {
  try {
    const tournamentsRef = ref(db, 'tournaments');
    const tournamentsSnapshot = await get(tournamentsRef);

    if (!tournamentsSnapshot.exists()) {
      return res.status(404).json({ message: "No tournaments found" });
    }

    const tournaments = tournamentsSnapshot.val();
    return res.status(200).json({ tournaments });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}

export async function getTournamentById(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const tournamentRef = ref(db, `tournaments/${id}`);
    const tournamentSnapshot = await get(tournamentRef);

    if (!tournamentSnapshot.exists()) {
      return res.status(404).json({ message: "Tournament not found" });
    }

    const tournament = tournamentSnapshot.val();
    return res.status(200).json({ tournament });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}


// Controller to create a tournament pool
export const initializeTournamentPoolController = async (req: Request, res: Response) => {
  try {
    const {
      adminPublicKey,
      tournamentId,
      entryFee,
      maxParticipants,
      endTime,
      mintPublicKey
    } = req.body;

    // Validate the required fields
    if (!adminPublicKey || !tournamentId || entryFee === undefined ||
      !maxParticipants || !endTime || !mintPublicKey) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: adminPublicKey, tournamentId, entryFee, maxParticipants, endTime, or mintPublicKey'
      });
    }

    // Convert string public keys to PublicKey objects
    const adminPubKey = new PublicKey(adminPublicKey);
    const mintPubKey = new PublicKey(mintPublicKey);

    // Call the service to initialize the tournament pool
    const result = await initializeTournamentPoolService(
      adminPubKey,
      tournamentId,
      entryFee,
      maxParticipants,
      endTime,
      mintPubKey
    );

    if (result.success) {
      return res.status(200).json(result);
    } else {
      return res.status(400).json(result);
    }
  } catch (error) {
    console.error('❌ Error in initializeTournamentPool controller:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};


// Modification to the registerForTournamentController in gamehubController.ts
export const registerForTournamentController = async (req: Request, res: Response) => {
  try {
    const { tournamentId, userPublicKey } = req.body;

    // Validate required fields
    if (!userPublicKey || !tournamentId) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: tournamentId or userPublicKey",
      });
    }

    // Find tournament by tournamentId
    const tournamentRef = ref(db, `tournaments/${tournamentId}`);
    const tournamentSnapshot = await get(tournamentRef);

    // Check if tournament exists
    if (!tournamentSnapshot.exists()) {
      return res.status(404).json({
        success: false,
        message: "Tournament not found",
      });
    }

    const tournament = tournamentSnapshot.val();

    // Extract adminPublicKey (createdBy)
    const adminPublicKey = tournament.createdBy;
    if (!adminPublicKey) {
      return res.status(400).json({
        success: false,
        message: "Tournament does not have an adminPublicKey",
      });
    }

    const userPubKey = new PublicKey(userPublicKey);

    // First register on blockchain (maintains existing functionality)
    const blockchainResult = await registerForTournamentService(tournamentId, userPubKey, new PublicKey(adminPublicKey));

    // Then update Firebase to add participant with initial score
    if (blockchainResult.success) {
      const participants = tournament.participants || {};

      // Initialize the participant with a score of 0 (in Firebase )
      participants[userPublicKey] = {
        score: 0
      };

      await update(tournamentRef, {
        participants,
        participantsCount: Object.keys(participants).length
      });

      return res.status(200).json(blockchainResult);
    } else {
      return res.status(400).json(blockchainResult);
    }
  } catch (error) {
    console.error("❌ Error in registerForTournament controller:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};


export const getTournamentPoolController = async (req: Request, res: Response) => {
  try {
    const { tournamentId, adminPubKey } = req.body;

    // Validate the required fields
    if (!tournamentId || !adminPubKey) {
      return res.status(400).json({
        success: false,
        message: 'Missing required field: tournamentId or adminPubKey'
      });
    }
    const adminPublicKey = new PublicKey(adminPubKey);
    // Call the service to get tournament pool details
    const result = await getTournamentPool(tournamentId, adminPublicKey);

    if (result.success) {
      return res.status(200).json(result);
    } else {
      return res.status(404).json(result);
    }
  } catch (error) {
    console.error('❌ Error in getTournamentPool controller:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};




// Get tournament leaderboard
export async function getTournamentLeaderboardController(req: Request, res: Response) {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ message: "Tournament ID is required" });
    }

    const result = await getTournamentLeaderboard(id);

    if (result.success) {
      return res.status(200).json(result);
    } else {
      return res.status(404).json(result);
    }
  } catch (error) {
    console.error("Error in getTournamentLeaderboardController:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}

// Update participant score
export async function updateParticipantScoreController(req: Request, res: Response) {
  try {
    const { tournamentId, participantId, score } = req.body;

    if (!tournamentId || !participantId || score === undefined) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const result = await updateParticipantScore(tournamentId, participantId, score);

    if (result.success) {
      return res.status(200).json(result);
    } else {
      return res.status(400).json(result);
    }
  } catch (error) {
    console.error("Error in updateParticipantScoreController:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}

// Get tournaments by game
export async function getTournamentsByGameController(req: Request, res: Response) {
  try {
    const { gameId } = req.params;

    if (!gameId) {
      return res.status(400).json({ message: "Game ID is required" });
    }

    const result = await getTournamentsByGame(gameId);

    if (result.success) {
      return res.status(200).json(result);
    } else {
      return res.status(500).json(result);
    }
  } catch (error) {
    console.error("Error in getTournamentsByGameController:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}