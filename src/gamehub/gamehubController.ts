import { Request, Response } from "express";
import { ref, get, set, push, update } from "firebase/database";
import { db } from "../config/firebase";  // Assuming db is your Firebase database instance
import { getTournamentPool, initializeTournamentPool, registerForTournament } from './services';
import { PublicKey } from "@solana/web3.js";
import { initializeAccount2InstructionData } from "@solana/spl-token/lib/types";
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

// export function createTournament(req: Request, res: Response) {
//     try {
//         const { name, description, startTime, endTime, gameId, max_participants } = req.body as Tournament;
//         const { mint, adminPublicKey, entryFee } = req.body;

//         // Validate required fields
//         if (!name || !gameId || !startTime || !endTime) {
//             return res.status(400).json({ message: "Missing required fields" });
//         }

//         // Create a reference to the tournaments node
//         const tournamentsRef = ref(db, 'tournaments');

//         // Generate a new unique key for the tournament
//         const newTournamentRef = push(tournamentsRef);

//         // Create tournament object
//         const tournament = {
//             id: newTournamentRef.key,
//             name,
//             description,
//             startTime,
//             endTime,
//             gameId,
//             max_participants,
//             entryFee,
//             createdAt: new Date().toISOString(),
//             participants: {}, // Initialize empty participants object
//             participantsCount: 0,
//             status: "Not Started"
//         };

//         // Set the tournament data
//         set(newTournamentRef, tournament)
//             .then(async () => {

//                 let tx = await initializeTournamentPoolController(adminPublicKey, tournament.id, entryFee, tournament.max_participants, tournament.endTime, mint);

//                 res.status(201).json({
//                     message: "Tournament created successfully",
//                     tournament,
//                     tx
//                 });

//                 schedule.scheduleJob(startTime, async () => {
//                     try {
//                         const tournamentRef = ref(db, `tournaments/${tournament.id}`);

//                         await update(tournamentRef, { status: "Active" });
//                         console.log(`Tournament ${tournament.id} has started and status is updated.`);
//                     } catch (error) {
//                         console.error(`Failed to start tournament ${tournamentsRef.key}: `, error);
//                     }
//                 });

//                 return;
//             })
//             .catch((error) => {
//                 console.error("Error creating tournament:", error);
//                 return res.status(500).json({ message: "Failed to create tournament" });
//             });

//     } catch (error) {
//         console.error(error);
//         return res.status(500).json({ message: "Internal Server Error" });
//     }
// }



// // Controller for creating the tournament pool
// export const createTournamentPoolNow = async (adminPublicKey: string, tournamentId: string, entryFee: number, mint: string) => {
//     try {

//         if (!adminPublicKey || !tournamentId || !entryFee || !mint) {
//             return JSON.stringify({ message: 'Missing required fields: tournamentId, entryFee, mint' });
//         }

//         const mintPublicKey = new PublicKey(mint);
//         // Call the service to create the tournament pool
//         const admin = new PublicKey(adminPublicKey)
//         const result = await initializeAccountsService(admin, tournamentId, entryFee, mintPublicKey);

//         if (result.success) {
//             return result;
//         } else {
//             return result;
//         }
//     } catch (error) {
//         console.error('Error creating tournament pool:', error);
//         return JSON.stringify({ message: 'Error creating tournament pool' });
//     }
// };



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
    const result = await initializeTournamentPool(
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


// Controller to handle the register for tournament logic
export const registerForTournamentController = async (req: Request, res: Response) => {
    try {
      const {tournamentId, userPublicKey, adminPubKey  } = req.body;
  
      // Validate the required fields
      if (!userPublicKey || !tournamentId || !adminPubKey) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields: userSecretKey or tournamentId or adminKey'
        });
      }
  
      const userPubKey = new PublicKey(userPublicKey);
      const adminPublicKey = new PublicKey(adminPubKey)
  
      // Call the service to register for the tournament
      const result = await registerForTournament(
        tournamentId,
        userPubKey,
        adminPublicKey
      );
  
      if (result.success) {
        return res.status(200).json(result);
      } else {
        return res.status(400).json(result);
      }
    } catch (error) {
      console.error('❌ Error in registerForTournament controller:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
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