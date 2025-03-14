import { Request, Response } from "express";
import { ref, get, set, push } from "firebase/database";
import { db } from "../config/firebase";  // Assuming db is your Firebase database instance
import { getTournamentPool, initializeAccountsService, registerForTournamentService, registerForTournamentServiceWithKeypair } from './services';
import { PublicKey } from "@solana/web3.js";
import { initializeAccount2InstructionData } from "@solana/spl-token/lib/types";

// Define Tournament interface
interface Tournament {
    id: string;
    name: string;
    description: string;
    entryFee: string;
    startTime: string;
    endTime: string;
    gameId: string;
    participants: { [key: string]: { joinedAt: string; score: number } };
    participantsCount: number;
    status: "Active" | "Paused" | "Ended"
}


export async function getAllGames(req: Request, res: Response) {
    try {
        const gamesRef = ref(db, 'games');
        const gamesSnapshot = await get(gamesRef);

        if (!gamesSnapshot.exists()) {
            return res.status(404).json({ message: "No games found" });
        }

        const games = gamesSnapshot.val();
        return res.status(200).json({ games });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
}

export function createTournament(req: Request, res: Response) {
    try {
        const { name, description, startTime, endTime, gameId } = req.body as Tournament;

        // Validate required fields
        if (!name || !gameId || !startTime || !endTime) {
            return res.status(400).json({ message: "Missing required fields" });
        }

        // Create a reference to the tournaments node
        const tournamentsRef = ref(db, 'tournaments');

        // Generate a new unique key for the tournament
        const newTournamentRef = push(tournamentsRef);

        // Create tournament object
        const tournament = {
            id: newTournamentRef.key,
            name,
            description,
            startTime,
            endTime,
            gameId,
            createdAt: new Date().toISOString(),
            participants: {}, // Initialize empty participants object
            participantsCount: 0
        };

        // Set the tournament data
        set(newTournamentRef, tournament)
            .then(() => {
                return res.status(201).json({
                    message: "Tournament created successfully",
                    tournament
                });
            })
            .catch((error) => {
                console.error("Error creating tournament:", error);
                return res.status(500).json({ message: "Failed to create tournament" });
            });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
}



// Controller for creating the tournament pool
export const createTournamentPool = async (req: Request, res: Response) => {
    try {
        const { adminPublicKey, tournamentId, entryFee, mint } = req.body;

        if (!adminPublicKey|| !tournamentId || !entryFee || !mint) {
            return res.status(400).json({ message: 'Missing required fields: tournamentId, entryFee, mint' });
        }
        
        const adminAdress = new PublicKey(adminPublicKey);
        const mintPublicKey = new PublicKey(mint);
        // Call the service to create the tournament pool
        const result = await initializeAccountsService(adminAdress, tournamentId, entryFee, mintPublicKey);

        if (result.success) {
            return res.status(200).json({ message: result.message });
        } else {
            return res.status(500).json({ message: result.message });
        }
    } catch (error) {
        console.error('Error creating tournament pool:', error);
        return res.status(500).json({ message: 'Error creating tournament pool' });
    }
};

export const userParticipation = async (req: Request, res: Response) => {
    try {
        const { userId, tournamentId } = req.body;

        if (!userId || !tournamentId) {
            return res.status(400).json({ message: "Missing userId or tournamentId" });
        }

        const tournamentRef = ref(db, `tournaments/${tournamentId}`);
        const tournamentSnapshot = await get(tournamentRef);

        if (!tournamentSnapshot.exists()) {
            return res.status(404).json({ message: "Tournament not found" });
        }

        const tournamentData = tournamentSnapshot.val();

        // Check if user is already participating
        if (tournamentData.participants && tournamentData.participants[userId]) {
            return res.status(400).json({ message: "User already participates in this tournament" });
        }

        // Initialize participants object if it doesn't exist
        if (!tournamentData.participants) {
            tournamentData.participants = {};
            tournamentData.participantsCount = 0;
        }

        // Add user to participants with timestamp
        //firebase doesnt allow array of users, so we need to use an object
        tournamentData.participants[userId] = {
            joinedAt: new Date().toISOString(),
            score: 0
        };
        tournamentData.participantsCount += 1;

        // Update tournament with new participant
        await set(tournamentRef, tournamentData);

        return res.status(200).json({
            message: "User added to tournament successfully",
            tournament: tournamentData
        });

    } catch (error) {
        console.error(error);
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




// Controller to handle the register for tournament logic
export const registerForTournamentController = async (req: Request, res: Response) => {
  try {
    // Destructure the mintPublicKey and adminPublicKey from the request body
    const { mintPublicKey, adminPublicKey, userPublicKey } = req.body;

    // Validate the inputs
    if (!mintPublicKey || !adminPublicKey || !userPublicKey) {
      return res.status(400).json({
        success: false,
        message: 'Missing mintPublicKey or adminPublicKey in the request body',
      });
    }

    // Convert the public keys from base58 to PublicKey
    const mint = new PublicKey(mintPublicKey);
    const admin = new PublicKey(adminPublicKey);
    const user = new PublicKey(userPublicKey);


    // Call the service function to register the user for the tournament
    const result = await registerForTournamentService(mint, user, admin);

    if (result.success) {
        return res.status(200).json(result);
      } else {
        return res.status(500).json(result);
      }
    } catch (err) {
      console.error("Error in staking tokens:", err);
      return res.status(500).json({ success: false, message: "Internal server error" });
};
}


export const getTournamentPoolController = async (req: Request, res: Response) => {
  try {
    // Destructure the userPublicKey from the request body
    const { userPublicKey } = req.body;

    // Validate the inputs
    if (!userPublicKey) {
      return res.status(400).json({
        success: false,
        message: 'Missing userPublicKey in the request body',
      });
    }

    // Convert the public key from base58 to PublicKey
    const userAddress = new PublicKey(userPublicKey);

    // Call the service function to fetch the tournament pool data
    const result = await getTournamentPool(userAddress);

    // Send the response based on the result of the service function
    if (result.success) {
      return res.status(200).json({
        success: true,
        message: 'Tournament pool data fetched successfully',
        data: result.data,  // Send the fetched tournament pool data in the response
      });
    } else {
      return res.status(500).json({
        success: false,
        message: result.message,  // Send the error message from the service
      });
    }
  } catch (error) {
    console.error('Error in getTournamentPoolController:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while fetching the tournament pool.',
    });
  }
};
