import { Request, Response } from "express";
import { ref, get, set, push } from "firebase/database";
import { db } from "../config/firebase";  // Assuming db is your Firebase database instance
import { createTournamentPoolService, registerForTournamentService } from './services';
import { PublicKey } from "@solana/web3.js";

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
        const { tournamentId, entryFee, mint } = req.body;

        if (!tournamentId || !entryFee || !mint) {
            return res.status(400).json({ message: 'Missing required fields: tournamentId, entryFee, mint' });
        }

        // Convert the mint to a PublicKey
        const mintPublicKey = new PublicKey(mint);

        // Call the service to create the tournament pool
        const result = await createTournamentPoolService(tournamentId, entryFee, mintPublicKey);

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





// Controller function to register for a tournament
export const registerForTournamentController = async (req: Request, res: Response) => {
    try {
        // Get the necessary data from the request body
        const { mintPublicKey, entryFee } = req.body;  // Assuming mintPublicKey and tournamentId are passed in the body

        // Call the service function to register for the tournament
        const registrationResult = await registerForTournamentService(mintPublicKey, entryFee);

        // Check if the registration was successful
        if (registrationResult.success) {
            // Send a success response
            return res.status(200).json({
                message: 'User successfully registered for the tournament',
                transaction: registrationResult.transaction,  // Include the transaction details
                transactionSignature: registrationResult.transactionSignature  // Include the transaction signature
            });
        } else {
            // If registration failed, send an error response
            return res.status(500).json({
                message: registrationResult.message || 'Failed to register for the tournament'
            });
        }
    } catch (error) {
        console.error('Error registering for tournament:', error);
        return res.status(500).json({
            message: 'An error occurred while registering for the tournament',
            error: error.message
        });
    }
};




// // Define the structure of Tournament data
// interface TournamentData {
//     EnableTournament: boolean;
//     TournamentStart: {
//         Date: number;
//         month: number;
//     };
//     TournamentEnd: {
//         Date: number;
//         month: number;
//     };
// }

// // Controller function to retrieve active tournament data
// export const getActiveTournamentController = async (req: Request, res: Response) => {
//   try {
//     // Reference to the Tournament Data in Firebase
//     const tournamentRef = ref(db, 'Tournament Data');
//     const snapshot = await get(tournamentRef);

//     if (snapshot.exists()) {
//       const tournamentData = snapshot.val();  // Tournament Data

//       // Check if tournaments are enabled
//       if (tournamentData.EnableTournament) {
//         return res.status(200).json({
//           message: "Active tournament found",
//           tournament: tournamentData  // Return the tournament data if enabled
//         });
//       } else {
//         console.log("No active tournament.");
//         return res.status(404).json({
//           message: "No active tournament"
//         });  // No active tournament
//       }
//     } else {
//       console.log("No tournament data found in the database.");
//       return res.status(404).json({
//         message: "No tournament data found"
//       });
//     }
//   } catch (error) {
//     console.error("Error fetching tournament data: ", error);
//     return res.status(500).json({
//       message: "Internal server error"
//     });
//   }
// };
