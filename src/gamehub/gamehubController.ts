import { Request, Response } from "express";
import { ref, get } from "firebase/database";
import { db } from "../config/firebase";  // Assuming db is your Firebase database instance

// Define the structure of Tournament data
interface TournamentData {
    EnableTournament: boolean;
    TournamentStart: {
        Date: number;
        month: number;
    };
    TournamentEnd: {
        Date: number;
        month: number;
    };
}

// Controller function to retrieve active tournament data
export const getActiveTournamentController = async (req: Request, res: Response) => {
  try {
    // Reference to the Tournament Data in Firebase
    const tournamentRef = ref(db, 'Tournament Data');
    const snapshot = await get(tournamentRef);

    if (snapshot.exists()) {
      const tournamentData = snapshot.val();  // Tournament Data

      // Check if tournaments are enabled
      if (tournamentData.EnableTournament) {
        return res.status(200).json({
          message: "Active tournament found",
          tournament: tournamentData  // Return the tournament data if enabled
        });
      } else {
        console.log("No active tournament.");
        return res.status(404).json({
          message: "No active tournament"
        });  // No active tournament
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
