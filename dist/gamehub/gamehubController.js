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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTournamentPoolController = exports.registerForTournamentController = exports.initializeTournamentPoolController = exports.getActiveTournament = void 0;
exports.getAllGames = getAllGames;
exports.createTournament = createTournament;
exports.getTournaments = getTournaments;
exports.getTournamentById = getTournamentById;
exports.getTournamentLeaderboardController = getTournamentLeaderboardController;
exports.updateParticipantScoreController = updateParticipantScoreController;
exports.getTournamentsByGameController = getTournamentsByGameController;
const database_1 = require("firebase/database");
const firebase_1 = require("../config/firebase");
const services_1 = require("./services");
const leaderboardService_1 = require("./leaderboardService");
const web3_js_1 = require("@solana/web3.js");
const node_schedule_1 = __importDefault(require("node-schedule"));
function getAllGames(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const gamesRef = (0, database_1.ref)(firebase_1.db, "games");
            const gamesSnapshot = yield (0, database_1.get)(gamesRef);
            if (!gamesSnapshot.exists()) {
                return res.status(404).json({ message: "No games found" });
            }
            const gamesObject = gamesSnapshot.val(); // Object with game IDs as keys
            const gamesArray = Object.keys(gamesObject).map((gameId) => (Object.assign({ id: gameId }, gamesObject[gameId])));
            return res.status(200).json({ games: gamesArray });
        }
        catch (error) {
            console.error(error);
            return res.status(500).json({ message: "Internal Server Error" });
        }
    });
}
function createTournament(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { name, description, startTime, endTime, gameId } = req.body;
            const { mint, adminPublicKey, entryFee } = req.body;
            const maxParticipants = 100;
            if (!name || !gameId || !startTime || !endTime || !adminPublicKey || !entryFee || !mint) {
                return res.status(400).json({ message: "Missing required fields" });
            }
            const endTimeInUnix = Math.floor(new Date(endTime).getTime() / 1000);
            const pubKey = new web3_js_1.PublicKey(adminPublicKey);
            const tournamentsRef = (0, database_1.ref)(firebase_1.db, "tournaments");
            const newTournamentRef = (0, database_1.push)(tournamentsRef);
            const tournamentId = newTournamentRef.key;
            if (!tournamentId) {
                return res.status(500).json({ message: "Failed to generate tournament ID" });
            }
            const tx = yield (0, services_1.initializeTournamentPool)(pubKey, tournamentId, entryFee, maxParticipants, endTimeInUnix, mint);
            res.status(201).json({
                message: "Tournament created successfully",
                tx
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
            yield (0, database_1.set)(newTournamentRef, tournament);
            const tournamentRef = (0, database_1.ref)(firebase_1.db, `tournaments/${tournamentId}`);
            node_schedule_1.default.scheduleJob(new Date(startTime), () => __awaiter(this, void 0, void 0, function* () {
                try {
                    yield (0, database_1.update)(tournamentRef, { status: "Active" });
                    console.log(`Tournament ${tournamentId} has started.`);
                }
                catch (error) {
                    console.error(`Failed to start tournament ${tournamentId}:`, error);
                }
            }));
            node_schedule_1.default.scheduleJob(new Date(endTime), () => __awaiter(this, void 0, void 0, function* () {
                try {
                    yield (0, database_1.update)(tournamentRef, { status: "Ended" });
                    console.log(`Tournament ${tournamentId} has ended.`);
                }
                catch (error) {
                    console.error(`Failed to end tournament ${tournamentId}:`, error);
                }
            }));
        }
        catch (error) {
            console.error("Error creating tournament:", error);
            return res.status(500).json({ message: "Internal Server Error" });
        }
    });
}
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
// Controller to create a tournament pool
const initializeTournamentPoolController = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { adminPublicKey, tournamentId, entryFee, maxParticipants, endTime, mintPublicKey } = req.body;
        // Validate the required fields
        if (!adminPublicKey || !tournamentId || entryFee === undefined ||
            !maxParticipants || !endTime || !mintPublicKey) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: adminPublicKey, tournamentId, entryFee, maxParticipants, endTime, or mintPublicKey'
            });
        }
        // Convert string public keys to PublicKey objects
        const adminPubKey = new web3_js_1.PublicKey(adminPublicKey);
        const mintPubKey = new web3_js_1.PublicKey(mintPublicKey);
        // Call the service to initialize the tournament pool
        const result = yield (0, services_1.initializeTournamentPool)(adminPubKey, tournamentId, entryFee, maxParticipants, endTime, mintPubKey);
        if (result.success) {
            return res.status(200).json(result);
        }
        else {
            return res.status(400).json(result);
        }
    }
    catch (error) {
        console.error('❌ Error in initializeTournamentPool controller:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
});
exports.initializeTournamentPoolController = initializeTournamentPoolController;
// Modification to the registerForTournamentController in gamehubController.ts
const registerForTournamentController = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
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
        const tournamentRef = (0, database_1.ref)(firebase_1.db, `tournaments/${tournamentId}`);
        const tournamentSnapshot = yield (0, database_1.get)(tournamentRef);
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
        const userPubKey = new web3_js_1.PublicKey(userPublicKey);
        // First register on blockchain (maintains existing functionality)
        const blockchainResult = yield (0, services_1.registerForTournament)(tournamentId, userPubKey, new web3_js_1.PublicKey(adminPublicKey));
        // Then update Firebase to add participant with initial score
        if (blockchainResult.success) {
            const participants = tournament.participants || {};
            // Initialize the participant with a score of 0 (in Firebase )
            participants[userPublicKey] = {
                score: 0
            };
            yield (0, database_1.update)(tournamentRef, {
                participants,
                participantsCount: Object.keys(participants).length
            });
            return res.status(200).json(blockchainResult);
        }
        else {
            return res.status(400).json(blockchainResult);
        }
    }
    catch (error) {
        console.error("❌ Error in registerForTournament controller:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message,
        });
    }
});
exports.registerForTournamentController = registerForTournamentController;
const getTournamentPoolController = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { tournamentId, adminPubKey } = req.body;
        // Validate the required fields
        if (!tournamentId || !adminPubKey) {
            return res.status(400).json({
                success: false,
                message: 'Missing required field: tournamentId or adminPubKey'
            });
        }
        const adminPublicKey = new web3_js_1.PublicKey(adminPubKey);
        // Call the service to get tournament pool details
        const result = yield (0, services_1.getTournamentPool)(tournamentId, adminPublicKey);
        if (result.success) {
            return res.status(200).json(result);
        }
        else {
            return res.status(404).json(result);
        }
    }
    catch (error) {
        console.error('❌ Error in getTournamentPool controller:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
});
exports.getTournamentPoolController = getTournamentPoolController;
// Get tournament leaderboard
function getTournamentLeaderboardController(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { id } = req.params;
            if (!id) {
                return res.status(400).json({ message: "Tournament ID is required" });
            }
            const result = yield (0, leaderboardService_1.getTournamentLeaderboard)(id);
            if (result.success) {
                return res.status(200).json(result);
            }
            else {
                return res.status(404).json(result);
            }
        }
        catch (error) {
            console.error("Error in getTournamentLeaderboardController:", error);
            return res.status(500).json({ message: "Internal Server Error" });
        }
    });
}
// Update participant score
function updateParticipantScoreController(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { tournamentId, participantId, score } = req.body;
            if (!tournamentId || !participantId || score === undefined) {
                return res.status(400).json({ message: "Missing required fields" });
            }
            const result = yield (0, leaderboardService_1.updateParticipantScore)(tournamentId, participantId, score);
            if (result.success) {
                return res.status(200).json(result);
            }
            else {
                return res.status(400).json(result);
            }
        }
        catch (error) {
            console.error("Error in updateParticipantScoreController:", error);
            return res.status(500).json({ message: "Internal Server Error" });
        }
    });
}
// Get tournaments by game
function getTournamentsByGameController(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { gameId } = req.params;
            if (!gameId) {
                return res.status(400).json({ message: "Game ID is required" });
            }
            const result = yield (0, leaderboardService_1.getTournamentsByGame)(gameId);
            if (result.success) {
                return res.status(200).json(result);
            }
            else {
                return res.status(500).json(result);
            }
        }
        catch (error) {
            console.error("Error in getTournamentsByGameController:", error);
            return res.status(500).json({ message: "Internal Server Error" });
        }
    });
}
//# sourceMappingURL=gamehubController.js.map