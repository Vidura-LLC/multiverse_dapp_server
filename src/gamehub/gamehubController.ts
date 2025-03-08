import { Request, Response } from "express";
import { ref, get, set } from "firebase/database";
import { db } from "../config/firebase";  // Assuming db is your Firebase database instance
import { createTournamentPoolService } from './services';
import { PublicKey } from "@solana/web3.js";

// Define Tournament interface
interface Tournament {
  id: string;
  name: string;
  entryFee: string;
  startTime: string;
  endTime: string;
  users: { userId: string; score: string }[] | null; // Initially null or empty
  description: string;
  status: "Active" | "Paused" | "Ended" | "Not Started";
}

// Controller to create a tournament
export const createTournamentController = async (req: Request, res: Response) => {
  const { id, name, entryFee, startTime, endTime, description, status } = req.body;

  try {
    // Check if all required fields are present
    if (!id || !name || !entryFee || !startTime || !endTime || !description || !status) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // Create a tournament object with empty 'users' field
    const tournament: Tournament = {
      id,
      name,
      entryFee,
      startTime,
      endTime,
      users: null,  // Initially set to null or an empty array
      description,
      status
    };

    // Reference to the tournaments node in the Firebase Realtime Database
    const tournamentRef = ref(db, "tournaments/" + id);

    // Save the tournament document in Firebase database
    await set(tournamentRef, tournament);

    return res.status(200).json({ message: "Tournament created successfully!" });
  } catch (error) {
    console.error("Error creating tournament:", error);
    return res.status(500).json({ message: "Error creating tournament" });
  }
};




// Controller for creating the tournament pool
export const createTournamentPoolController = async (req: Request, res: Response) => {
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



// Controller function to retrieve active tournament data
export const getActiveTournamentController = async (req: Request, res: Response) => {
  try {
    // Reference to the Tournament Data in Firebase
    const tournamentRef = ref(db, 'tournaments');  // Assuming you have a 'tournaments' node in Firebase
    const snapshot = await get(tournamentRef);

    if (snapshot.exists()) {
      const tournamentsData = snapshot.val();  // All tournaments data

      // Filter active tournaments based on status
      const activeTournaments = Object.values(tournamentsData).filter(
        (tournament: any) => tournament.status === "Active"
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
