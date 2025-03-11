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
exports.getActiveTournament = exports.userParticipation = exports.createTournamentPool = void 0;
exports.createTournament = createTournament;
exports.getTournaments = getTournaments;
exports.getTournamentById = getTournamentById;
const database_1 = require("firebase/database");
const firebase_1 = require("../config/firebase"); // Assuming db is your Firebase database instance
const services_1 = require("./services");
const web3_js_1 = require("@solana/web3.js");
function createTournament(req, res) {
    try {
        const { name, description, startTime, endTime, gameId } = req.body;
        // Validate required fields
        if (!name || !gameId || !startTime || !endTime) {
            return res.status(400).json({ message: "Missing required fields" });
        }
        // Create a reference to the tournaments node
        const tournamentsRef = (0, database_1.ref)(firebase_1.db, 'tournaments');
        // Generate a new unique key for the tournament
        const newTournamentRef = (0, database_1.push)(tournamentsRef);
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
        (0, database_1.set)(newTournamentRef, tournament)
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
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
}
// Controller for creating the tournament pool
const createTournamentPool = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { tournamentId, entryFee, mint } = req.body;
        if (!tournamentId || !entryFee || !mint) {
            return res.status(400).json({ message: 'Missing required fields: tournamentId, entryFee, mint' });
        }
        // Convert the mint to a PublicKey
        const mintPublicKey = new web3_js_1.PublicKey(mint);
        // Call the service to create the tournament pool
        const result = yield (0, services_1.createTournamentPoolService)(tournamentId, entryFee, mintPublicKey);
        if (result.success) {
            return res.status(200).json({ message: result.message });
        }
        else {
            return res.status(500).json({ message: result.message });
        }
    }
    catch (error) {
        console.error('Error creating tournament pool:', error);
        return res.status(500).json({ message: 'Error creating tournament pool' });
    }
});
exports.createTournamentPool = createTournamentPool;
const userParticipation = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { userId, tournamentId } = req.body;
        if (!userId || !tournamentId) {
            return res.status(400).json({ message: "Missing userId or tournamentId" });
        }
        const tournamentRef = (0, database_1.ref)(firebase_1.db, `tournaments/${tournamentId}`);
        const tournamentSnapshot = yield (0, database_1.get)(tournamentRef);
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
        yield (0, database_1.set)(tournamentRef, tournamentData);
        return res.status(200).json({
            message: "User added to tournament successfully",
            tournament: tournamentData
        });
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
});
exports.userParticipation = userParticipation;
// Controller function to retrieve active tournament data
const getActiveTournament = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Reference to the Tournament Data in Firebase
        const tournamentRef = (0, database_1.ref)(firebase_1.db, 'tournaments'); // Assuming you have a 'tournaments' node in Firebase
        const snapshot = yield (0, database_1.get)(tournamentRef);
        if (snapshot.exists()) {
            const tournamentsData = snapshot.val(); // All tournaments data
            // Filter active tournaments based on status
            const activeTournaments = Object.values(tournamentsData).filter((tournament) => tournament.status === "Active");
            if (activeTournaments.length > 0) {
                return res.status(200).json({
                    message: "Active tournament(s) found",
                    tournaments: activeTournaments // Return the active tournaments
                });
            }
            else {
                console.log("No active tournaments.");
                return res.status(404).json({
                    message: "No active tournaments"
                }); // No active tournament found
            }
        }
        else {
            console.log("No tournament data found in the database.");
            return res.status(404).json({
                message: "No tournament data found"
            });
        }
    }
    catch (error) {
        console.error("Error fetching tournament data: ", error);
        return res.status(500).json({
            message: "Internal server error"
        });
    }
});
exports.getActiveTournament = getActiveTournament;
function getTournaments(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const tournamentsRef = (0, database_1.ref)(firebase_1.db, 'tournaments');
            const tournamentsSnapshot = yield (0, database_1.get)(tournamentsRef);
            if (!tournamentsSnapshot.exists()) {
                return res.status(404).json({ message: "No tournaments found" });
            }
            const tournaments = tournamentsSnapshot.val();
            return res.status(200).json({ tournaments });
        }
        catch (error) {
            console.error(error);
            return res.status(500).json({ message: "Internal Server Error" });
        }
    });
}
function getTournamentById(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { id } = req.params;
            const tournamentRef = (0, database_1.ref)(firebase_1.db, `tournaments/${id}`);
            const tournamentSnapshot = yield (0, database_1.get)(tournamentRef);
            if (!tournamentSnapshot.exists()) {
                return res.status(404).json({ message: "Tournament not found" });
            }
            const tournament = tournamentSnapshot.val();
            return res.status(200).json({ tournament });
        }
        catch (error) {
            console.error(error);
            return res.status(500).json({ message: "Internal Server Error" });
        }
    });
}
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
//# sourceMappingURL=gamehubController.js.map