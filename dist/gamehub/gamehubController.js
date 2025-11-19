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
exports.getTotalTournamentEntryFeesController = exports.getTotalTournamentPoolsFundsController = exports.getTotalPrizePoolsFundsController = exports.getPrizePoolController = exports.getTournamentPoolController = exports.confirmParticipationController = exports.registerForTournamentController = exports.getTournamentsByAdmin = exports.getActiveTournament = void 0;
exports.getAllGames = getAllGames;
exports.createTournament = createTournament;
exports.getTournaments = getTournaments;
exports.getTournamentById = getTournamentById;
exports.getTournamentLeaderboardController = getTournamentLeaderboardController;
exports.updateParticipantScoreController = updateParticipantScoreController;
exports.getTournamentLeaderboardAgainstAdminController = getTournamentLeaderboardAgainstAdminController;
exports.getAdminTournamentsLeaderboardsController = getAdminTournamentsLeaderboardsController;
exports.getTournamentsByGameController = getTournamentsByGameController;
exports.updateTournamentStatus = updateTournamentStatus;
exports.checkAndUpdateTournamentStatuses = checkAndUpdateTournamentStatuses;
const database_1 = require("firebase/database");
const firebase_1 = require("../config/firebase");
const services_1 = require("./services");
const leaderboardService_1 = require("./leaderboardService");
const adminLeaderboardService_1 = require("./adminLeaderboardService");
const web3_js_1 = require("@solana/web3.js");
const node_schedule_1 = __importDefault(require("node-schedule"));
const getPDAs_1 = require("../utils/getPDAs");
const services_2 = require("../staking/services");
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
            const { name, description, startTime, endTime, gameId, tokenType } = req.body;
            const { mint, adminPublicKey, entryFee } = req.body;
            const maxParticipants = 100;
            if (!name || !gameId || !startTime || !endTime || !adminPublicKey || !entryFee || !mint || tokenType === undefined || tokenType === null) {
                return res.status(400).json({ message: "Missing required fields" });
            }
            const tt = Number(tokenType);
            if (tt !== getPDAs_1.TokenType.SPL && tt !== getPDAs_1.TokenType.SOL) {
                return res.status(400).json({ message: "tokenType must be 0 (SPL) or 1 (SOL)" });
            }
            // ✅ FIX: Ensure endTime is in SECONDS (Unix timestamp)
            let endTimeInUnix;
            if (typeof endTime === 'string') {
                // If it's an ISO string, convert to seconds
                endTimeInUnix = Math.floor(new Date(endTime).getTime() / 1000);
            }
            else if (typeof endTime === 'number') {
                // If it's already a number, check if it's milliseconds or seconds
                endTimeInUnix = endTime > 10000000000 ? Math.floor(endTime / 1000) : endTime;
            }
            else {
                return res.status(400).json({ message: "Invalid endTime format" });
            }
            // ✅ Validate that endTime is at least 5 minutes in the future
            const currentTimeInUnix = Math.floor(Date.now() / 1000);
            const MIN_DURATION = 300; // 5 minutes in seconds
            if (endTimeInUnix <= currentTimeInUnix + MIN_DURATION) {
                return res.status(400).json({
                    message: `Tournament end time must be at least 5 minutes in the future. Current time: ${currentTimeInUnix}, End time: ${endTimeInUnix}`
                });
            }
            console.log(`✅ Time validation:`, {
                currentTime: currentTimeInUnix,
                endTime: endTimeInUnix,
                difference: endTimeInUnix - currentTimeInUnix,
                differenceHours: (endTimeInUnix - currentTimeInUnix) / 3600
            });
            const pubKey = new web3_js_1.PublicKey(adminPublicKey);
            // Generate tournament ID first
            const tournamentsRef = (0, database_1.ref)(firebase_1.db, `tournaments/${tt}`);
            const newTournamentRef = (0, database_1.push)(tournamentsRef);
            const tournamentId = newTournamentRef.key;
            if (!tournamentId) {
                return res.status(500).json({ message: "Failed to generate tournament ID" });
            }
            const transaction = yield (0, services_1.initializeTournamentPoolService)(pubKey, tournamentId, entryFee, maxParticipants, endTimeInUnix, // ✅ Pass as seconds
            mint, tt);
            if (!transaction.success) {
                return res.status(500).json({
                    message: "Failed to create tournament transaction",
                    error: transaction.message
                });
            }
            res.status(201).json({
                message: "Tournament created successfully",
                transaction,
                tournamentId,
            });
            // Determine initial status based on startTime
            const now = new Date();
            const startTimeDate = new Date(startTime);
            const initialStatus = startTimeDate <= now ? "Active" : "Not Started";
            const tournament = {
                id: tournamentId,
                name,
                description,
                startTime,
                endTime,
                gameId,
                max_participants: maxParticipants,
                entryFee,
                createdAt: new Date().toISOString(),
                participants: {},
                participantsCount: 0,
                status: initialStatus,
                createdBy: adminPublicKey,
                tokenType: tt
            };
            // Save tournament to the correct path: tournaments/{tokenType}/{tournamentId}
            yield (0, database_1.set)(newTournamentRef, tournament);
            // Use the same reference for scheduled updates
            const tournamentRef = newTournamentRef;
            // Only schedule job if startTime is in the future
            if (startTimeDate > now) {
                node_schedule_1.default.scheduleJob(startTimeDate, () => __awaiter(this, void 0, void 0, function* () {
                    try {
                        yield (0, database_1.update)(tournamentRef, { status: "Active" });
                        console.log(`Tournament ${tournamentId} has started.`);
                    }
                    catch (error) {
                        console.error(`Failed to start tournament ${tournamentId}:`, error);
                    }
                }));
            }
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
const getTournamentsByAdmin = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { adminPublicKey } = req.params;
        const { tokenType } = req.query;
        if (!adminPublicKey || !tokenType || tokenType === undefined || tokenType === null) {
            return res.status(400).json({ message: "adminPublicKey and tokenType are required" });
        }
        const tt = Number(tokenType);
        if (tt !== getPDAs_1.TokenType.SPL && tt !== getPDAs_1.TokenType.SOL) {
            return res.status(400).json({ message: "tokenType must be 0 (SPL) or 1 (SOL)" });
        }
        if (!adminPublicKey) {
            return res.status(400).json({ message: "adminPublicKey is required" });
        }
        const tournamentsRef = (0, database_1.ref)(firebase_1.db, `tournaments/${tt}`);
        const tournamentsSnapshot = yield (0, database_1.get)(tournamentsRef);
        if (!tournamentsSnapshot.exists()) {
            return res.status(404).json({ message: "No tournaments found" });
        }
        const tournaments = tournamentsSnapshot.val();
        const adminTournaments = Object.values(tournaments).filter((tournament) => tournament.createdBy === adminPublicKey && tournament.tokenType === tt);
        return res.status(200).json({
            message: "Tournaments fetched successfully",
            tournaments: adminTournaments,
        });
    }
    catch (error) {
        console.error("Error fetching tournaments by admin:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
});
exports.getTournamentsByAdmin = getTournamentsByAdmin;
function getTournaments(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { tokenType } = req.query;
            // If tokenType is provided, fetch tournaments for that specific token type
            if (tokenType !== undefined && tokenType !== null) {
                const tt = Number(tokenType);
                if (tt !== getPDAs_1.TokenType.SPL && tt !== getPDAs_1.TokenType.SOL) {
                    return res.status(400).json({ message: "tokenType must be 0 (SPL) or 1 (SOL)" });
                }
                // Fetch tournaments for specific token type
                const tournamentsRef = (0, database_1.ref)(firebase_1.db, `tournaments/${tt}`);
                const tournamentsSnapshot = yield (0, database_1.get)(tournamentsRef);
                if (!tournamentsSnapshot.exists()) {
                    return res.status(200).json({ tournaments: {} });
                }
                const tournaments = tournamentsSnapshot.val();
                return res.status(200).json({ tournaments });
            }
            else {
                // If no tokenType provided, fetch tournaments from both token types and merge them
                const allTournaments = {};
                for (const tt of [getPDAs_1.TokenType.SPL, getPDAs_1.TokenType.SOL]) {
                    const tournamentsRef = (0, database_1.ref)(firebase_1.db, `tournaments/${tt}`);
                    const tournamentsSnapshot = yield (0, database_1.get)(tournamentsRef);
                    if (tournamentsSnapshot.exists()) {
                        const tournaments = tournamentsSnapshot.val();
                        Object.assign(allTournaments, tournaments);
                    }
                }
                return res.status(200).json({ tournaments: allTournaments });
            }
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
            const { tokenType } = req.query;
            // Parse tokenType if provided
            let tt = undefined;
            if (tokenType !== undefined && tokenType !== null) {
                const parsed = Number(tokenType);
                if (parsed === getPDAs_1.TokenType.SPL || parsed === getPDAs_1.TokenType.SOL) {
                    tt = parsed;
                }
            }
            let tournament = null;
            // If tokenType is provided, search directly in that path
            if (tt !== undefined) {
                const tournamentRef = (0, database_1.ref)(firebase_1.db, `tournaments/${tt}/${id}`);
                const tournamentSnapshot = yield (0, database_1.get)(tournamentRef);
                if (tournamentSnapshot.exists()) {
                    tournament = tournamentSnapshot.val();
                }
            }
            else {
                // If tokenType is not provided, search in both token types
                for (const tokenTypeValue of [getPDAs_1.TokenType.SPL, getPDAs_1.TokenType.SOL]) {
                    const tournamentRef = (0, database_1.ref)(firebase_1.db, `tournaments/${tokenTypeValue}/${id}`);
                    const tournamentSnapshot = yield (0, database_1.get)(tournamentRef);
                    if (tournamentSnapshot.exists()) {
                        tournament = tournamentSnapshot.val();
                        break;
                    }
                }
            }
            if (!tournament) {
                return res.status(404).json({ message: "Tournament not found" });
            }
            return res.status(200).json({ tournament });
        }
        catch (error) {
            console.error(error);
            return res.status(500).json({ message: "Internal Server Error" });
        }
    });
}
// Modification to the registerForTournamentController in gamehubController.ts
const registerForTournamentController = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { tournamentId, userPublicKey, tokenType } = req.body;
        // Validate required fields
        if (!userPublicKey || !tournamentId || tokenType === undefined || tokenType === null) {
            return res.status(400).json({
                success: false,
                message: "Missing required fields: tournamentId or userPublicKey",
            });
        }
        const tt = Number(tokenType);
        if (tt !== getPDAs_1.TokenType.SPL && tt !== getPDAs_1.TokenType.SOL) {
            return res.status(400).json({ message: "tokenType must be 0 (SPL) or 1 (SOL)" });
        }
        // Find tournament by tournamentId in the correct path: tournaments/{tokenType}/{tournamentId}
        const tournamentRef = (0, database_1.ref)(firebase_1.db, `tournaments/${tt}/${tournamentId}`);
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
        // Create transaction for blockchain registration (don't add to Firebase yet)
        const blockchainResult = yield (0, services_1.registerForTournamentService)(tournamentId, userPubKey, new web3_js_1.PublicKey(adminPublicKey), tt);
        // Return transaction - participant will be added to Firebase after transaction is confirmed
        if (blockchainResult.success) {
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
// Controller to confirm participation after transaction is verified on blockchain
const confirmParticipationController = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { tournamentId, userPublicKey, transactionSignature, tokenType } = req.body;
        // Validate required fields
        if (!userPublicKey || !tournamentId || !transactionSignature || tokenType === undefined || tokenType === null) {
            return res.status(400).json({
                success: false,
                message: "Missing required fields: tournamentId, userPublicKey, transactionSignature, or tokenType",
            });
        }
        const tt = Number(tokenType);
        if (tt !== getPDAs_1.TokenType.SPL && tt !== getPDAs_1.TokenType.SOL) {
            return res.status(400).json({ message: "tokenType must be 0 (SPL) or 1 (SOL)" });
        }
        // Find tournament by tournamentId
        const tournamentRef = (0, database_1.ref)(firebase_1.db, `tournaments/${tt}/${tournamentId}`);
        const tournamentSnapshot = yield (0, database_1.get)(tournamentRef);
        // Check if tournament exists
        if (!tournamentSnapshot.exists()) {
            return res.status(404).json({
                success: false,
                message: "Tournament not found",
            });
        }
        const tournament = tournamentSnapshot.val();
        const adminPublicKey = tournament.createdBy;
        if (!adminPublicKey) {
            return res.status(400).json({
                success: false,
                message: "Tournament does not have an adminPublicKey",
            });
        }
        const userPubKey = new web3_js_1.PublicKey(userPublicKey);
        const adminPubKey = new web3_js_1.PublicKey(adminPublicKey);
        // Verify transaction exists on blockchain and was successful
        const { connection, program } = (0, services_2.getProgram)();
        try {
            const txInfo = yield connection.getTransaction(transactionSignature, {
                maxSupportedTransactionVersion: 0
            });
            if (!txInfo) {
                return res.status(400).json({
                    success: false,
                    message: 'Transaction not found on blockchain'
                });
            }
            // Check if transaction was successful
            if ((_a = txInfo.meta) === null || _a === void 0 ? void 0 : _a.err) {
                return res.status(400).json({
                    success: false,
                    message: 'Transaction failed on blockchain',
                    error: txInfo.meta.err
                });
            }
        }
        catch (err) {
            console.error('Error verifying transaction on blockchain:', err);
            return res.status(400).json({
                success: false,
                message: 'Could not verify transaction on blockchain',
                error: err.message
            });
        }
        // Verify registration account exists on blockchain (confirms registration was successful)
        try {
            const tournamentPoolPublicKey = (0, getPDAs_1.getTournamentPoolPDA)(adminPubKey, tournamentId, tt);
            const registrationAccountPublicKey = (0, getPDAs_1.getRegistrationPDA)(tournamentPoolPublicKey, userPubKey);
            // Try to fetch the registration account - if it exists, registration was successful
            // Use fetchNullable to handle cases where account might not exist yet
            const registrationAccount = yield program.account.registrationRecord.fetchNullable(registrationAccountPublicKey);
            if (!registrationAccount) {
                return res.status(400).json({
                    success: false,
                    message: 'Registration account not found on blockchain - registration may have failed or transaction not yet confirmed'
                });
            }
        }
        catch (err) {
            console.error('Error verifying registration account:', err);
            return res.status(400).json({
                success: false,
                message: 'Could not verify registration on blockchain - registration account does not exist',
                error: err.message
            });
        }
        // Transaction verified and registration confirmed - now add participant to Firebase
        const participants = tournament.participants || {};
        // Check if participant already exists (idempotency)
        if (participants[userPublicKey]) {
            return res.status(200).json({
                success: true,
                message: "Participant already registered",
            });
        }
        // Initialize the participant with a score of 0
        participants[userPublicKey] = {
            score: 0,
            joinedAt: new Date().toISOString()
        };
        yield (0, database_1.update)(tournamentRef, {
            participants,
            participantsCount: Object.keys(participants).length
        });
        return res.status(200).json({
            success: true,
            message: "Participation confirmed and participant added to tournament",
        });
    }
    catch (error) {
        console.error("❌ Error in confirmParticipation controller:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message,
        });
    }
});
exports.confirmParticipationController = confirmParticipationController;
const getTournamentPoolController = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { tournamentId, adminPubKey, tokenType } = req.body;
        // Validate the required fields
        if (!tournamentId || !adminPubKey || !tokenType || tokenType === undefined || tokenType === null) {
            return res.status(400).json({
                success: false,
                message: 'Missing required field: tournamentId or adminPubKey'
            });
        }
        const adminPublicKey = new web3_js_1.PublicKey(adminPubKey);
        const tt = Number(tokenType);
        if (tt !== getPDAs_1.TokenType.SPL && tt !== getPDAs_1.TokenType.SOL) {
            return res.status(400).json({ message: "tokenType must be 0 (SPL) or 1 (SOL)" });
        }
        // Call the service to get tournament pool details
        const result = yield (0, services_1.getTournamentPool)(tournamentId, adminPublicKey, tt);
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
// Controller: get a single prize pool by tournamentId and adminPubKey
const getPrizePoolController = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { tournamentId, adminPubKey, tokenType } = req.body;
        if (!tournamentId || !adminPubKey || !tokenType || tokenType === undefined || tokenType === null) {
            return res.status(400).json({ success: false, message: 'Missing required field: tournamentId or adminPubKey' });
        }
        const tt = Number(tokenType);
        if (tt !== getPDAs_1.TokenType.SPL && tt !== getPDAs_1.TokenType.SOL) {
            return res.status(400).json({ message: "tokenType must be 0 (SPL) or 1 (SOL)" });
        }
        const adminPublicKey = new web3_js_1.PublicKey(adminPubKey);
        const result = yield (0, services_1.getPrizePoolService)(tournamentId, adminPublicKey, tt);
        if (result.success) {
            return res.status(200).json(result);
        }
        else {
            return res.status(404).json(result);
        }
    }
    catch (error) {
        console.error('❌ Error in getPrizePoolController:', error);
        return res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
    }
});
exports.getPrizePoolController = getPrizePoolController;
// Controller: aggregate funds across all prize pools (optional admin filter)
const getTotalPrizePoolsFundsController = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { adminPubKey } = req.query;
        const adminPublicKey = adminPubKey ? new web3_js_1.PublicKey(adminPubKey) : undefined;
        const result = yield (0, services_1.getTotalPrizePoolsFundsService)(adminPublicKey);
        if (result.success) {
            return res.status(200).json(result);
        }
        else {
            return res.status(400).json(result);
        }
    }
    catch (error) {
        console.error('❌ Error in getTotalPrizePoolsFundsController:', error);
        return res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
    }
});
exports.getTotalPrizePoolsFundsController = getTotalPrizePoolsFundsController;
// Controller: aggregate funds across all tournament pools (optional admin filter)
const getTotalTournamentPoolsFundsController = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { adminPubKey } = req.query;
        const adminPublicKey = adminPubKey ? new web3_js_1.PublicKey(adminPubKey) : undefined;
        const result = yield (0, services_1.getTotalTournamentPoolsFundsService)(adminPublicKey);
        if (result.success) {
            return res.status(200).json(result);
        }
        else {
            return res.status(400).json(result);
        }
    }
    catch (error) {
        console.error('❌ Error in getTotalTournamentPoolsFundsController:', error);
        return res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
    }
});
exports.getTotalTournamentPoolsFundsController = getTotalTournamentPoolsFundsController;
// Controller: get total entry fees from Firebase tournaments by admin
const getTotalTournamentEntryFeesController = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { adminPubKey } = req.query;
        if (!adminPubKey) {
            return res.status(400).json({ success: false, message: 'adminPubKey is required' });
        }
        const result = yield (0, services_1.getTotalTournamentEntryFeesService)(adminPubKey);
        if (result.success) {
            return res.status(200).json(result);
        }
        else {
            return res.status(400).json(result);
        }
    }
    catch (error) {
        console.error('❌ Error in getTotalTournamentEntryFeesController:', error);
        return res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
    }
});
exports.getTotalTournamentEntryFeesController = getTotalTournamentEntryFeesController;
// Get tournament leaderboard
function getTournamentLeaderboardController(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { id } = req.params;
            const { tokenType } = req.query;
            if (!id) {
                return res.status(400).json({ message: "Tournament ID is required" });
            }
            // Parse tokenType if provided
            let tt = undefined;
            if (tokenType !== undefined && tokenType !== null) {
                const parsed = Number(tokenType);
                if (parsed === getPDAs_1.TokenType.SPL || parsed === getPDAs_1.TokenType.SOL) {
                    tt = parsed;
                }
            }
            const result = yield (0, leaderboardService_1.getTournamentLeaderboard)(id, tt);
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
            const { tournamentId, participantId, score, tokenType } = req.body;
            if (!tournamentId || !participantId || score === undefined) {
                return res.status(400).json({ message: "Missing required fields" });
            }
            // Parse tokenType if provided
            let tt = undefined;
            if (tokenType !== undefined && tokenType !== null) {
                const parsed = Number(tokenType);
                if (parsed === getPDAs_1.TokenType.SPL || parsed === getPDAs_1.TokenType.SOL) {
                    tt = parsed;
                }
            }
            const result = yield (0, leaderboardService_1.updateParticipantScore)(tournamentId, participantId, score, tt);
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
// Get tournament leaderboard against admin
function getTournamentLeaderboardAgainstAdminController(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { id } = req.params;
            const { tokenType } = req.query;
            if (!id) {
                return res.status(400).json({ message: "Tournament ID is required" });
            }
            // Parse tokenType if provided
            let tt = undefined;
            if (tokenType !== undefined && tokenType !== null) {
                const parsed = Number(tokenType);
                if (parsed === getPDAs_1.TokenType.SPL || parsed === getPDAs_1.TokenType.SOL) {
                    tt = parsed;
                }
            }
            const result = yield (0, adminLeaderboardService_1.getTournamentLeaderboardAgainstAdmin)(id, tt);
            if (result.success) {
                return res.status(200).json(result);
            }
            else {
                return res.status(404).json(result);
            }
        }
        catch (error) {
            console.error("Error in getTournamentLeaderboardAgainstAdminController:", error);
            return res.status(500).json({ message: "Internal Server Error" });
        }
    });
}
// Get aggregated leaderboards for all tournaments by admin
function getAdminTournamentsLeaderboardsController(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { adminPublicKey } = req.params;
            if (!adminPublicKey) {
                return res.status(400).json({ message: "Admin public key is required" });
            }
            const result = yield (0, adminLeaderboardService_1.getAdminTournamentsLeaderboards)(adminPublicKey);
            if (result.success) {
                return res.status(200).json(result);
            }
            else {
                return res.status(404).json(result);
            }
        }
        catch (error) {
            console.error("Error in getAdminTournamentsLeaderboardsController:", error);
            return res.status(500).json({ message: "Internal Server Error" });
        }
    });
}
// Get tournaments by game
function getTournamentsByGameController(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { gameId, tokenType } = req.params;
            if (!tokenType || tokenType === undefined || tokenType === null) {
                return res.status(400).json({ message: "Token type is required" });
            }
            const tt = Number(tokenType);
            if (tt !== getPDAs_1.TokenType.SPL && tt !== getPDAs_1.TokenType.SOL) {
                return res.status(400).json({ message: "tokenType must be 0 (SPL) or 1 (SOL)" });
            }
            if (!gameId) {
                return res.status(400).json({ message: "Game ID is required" });
            }
            // Fetch from Firebase at tournaments/{tokenType} and filter by gameId
            const tournamentsRef = (0, database_1.ref)(firebase_1.db, `tournaments/${tt}`);
            const snapshot = yield (0, database_1.get)(tournamentsRef);
            if (!snapshot.exists()) {
                return res.status(200).json({ success: true, data: [] });
            }
            const all = snapshot.val();
            const data = Object.values(all).filter((t) => t.gameId === gameId);
            return res.status(200).json({ success: true, data });
        }
        catch (error) {
            console.error("Error in getTournamentsByGameController:", error);
            return res.status(500).json({ message: "Internal Server Error" });
        }
    });
}
function updateTournamentStatus(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { tournamentId, status } = req.body;
            if (!tournamentId || !status) {
                return res.status(400).json({ message: "Missing required fields" });
            }
            const tournamentRef = (0, database_1.ref)(firebase_1.db, `tournaments/${tournamentId}`);
            const tournamentSnapshot = yield (0, database_1.get)(tournamentRef);
            if (!tournamentSnapshot.exists()) {
                return res.status(404).json({ message: "Tournament not found" });
            }
            yield (0, database_1.update)(tournamentRef, { status });
            const updatedTournamentSnapshot = yield (0, database_1.get)(tournamentRef);
            const updatedTournament = updatedTournamentSnapshot.val();
            return res.status(200).json({ message: "Tournament status updated successfully", tournament: updatedTournament });
        }
        catch (error) {
            console.error("Error updating tournament status:", error);
            return res.status(500).json({ message: "Internal Server Error" });
        }
    });
}
// Track scheduled jobs to avoid duplicates
const scheduledJobs = new Map();
/**
 * Check and update tournament statuses based on current time
 * This function should be called on server startup and periodically
 *
 * Performance optimizations:
 * - Only checks tournaments that can change status ("Not Started", "Active", "Draft")
 * - Skips "Ended", "Distributed", "Awarded" tournaments
 * - Tracks scheduled jobs to avoid duplicates
 * - Uses efficient filtering to minimize Firebase reads
 */
function checkAndUpdateTournamentStatuses() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const now = new Date();
            let updatedCount = 0;
            let scheduledCount = 0;
            let skippedCount = 0;
            // Check tournaments for both token types
            for (const tokenType of [getPDAs_1.TokenType.SPL, getPDAs_1.TokenType.SOL]) {
                const tournamentsRef = (0, database_1.ref)(firebase_1.db, `tournaments/${tokenType}`);
                const snapshot = yield (0, database_1.get)(tournamentsRef);
                if (!snapshot.exists()) {
                    continue;
                }
                const tournaments = snapshot.val();
                for (const [tournamentId, tournament] of Object.entries(tournaments)) {
                    if (!tournament || !tournament.startTime || !tournament.endTime) {
                        continue;
                    }
                    // Performance optimization: Skip tournaments that can't change status
                    const finalStatuses = ["Ended", "Distributed", "Awarded"];
                    if (finalStatuses.includes(tournament.status)) {
                        skippedCount++;
                        continue;
                    }
                    const startTimeDate = new Date(tournament.startTime);
                    const endTimeDate = new Date(tournament.endTime);
                    const tournamentRef = (0, database_1.ref)(firebase_1.db, `tournaments/${tokenType}/${tournamentId}`);
                    const jobKey = `${tokenType}-${tournamentId}`;
                    let statusUpdated = false;
                    // Check if tournament should be "Ended"
                    if (now >= endTimeDate) {
                        if (tournament.status !== "Ended" &&
                            tournament.status !== "Distributed" &&
                            tournament.status !== "Awarded") {
                            yield (0, database_1.update)(tournamentRef, { status: "Ended" });
                            console.log(`✅ Tournament ${tournamentId} (${tokenType}) status updated to "Ended"`);
                            updatedCount++;
                            statusUpdated = true;
                            // Cancel scheduled jobs for ended tournaments
                            const jobs = scheduledJobs.get(jobKey);
                            if (jobs) {
                                if (jobs.startJob)
                                    jobs.startJob.cancel();
                                if (jobs.endJob)
                                    jobs.endJob.cancel();
                                scheduledJobs.delete(jobKey);
                            }
                        }
                    }
                    // Check if tournament should be "Active"
                    else if (now >= startTimeDate) {
                        if (tournament.status === "Not Started" || tournament.status === "Draft") {
                            yield (0, database_1.update)(tournamentRef, { status: "Active" });
                            console.log(`✅ Tournament ${tournamentId} (${tokenType}) status updated to "Active"`);
                            updatedCount++;
                            statusUpdated = true;
                            // Cancel start job if it exists
                            const jobs = scheduledJobs.get(jobKey);
                            if (jobs === null || jobs === void 0 ? void 0 : jobs.startJob) {
                                jobs.startJob.cancel();
                                jobs.startJob = undefined;
                            }
                        }
                    }
                    // Restore scheduled jobs for future tournaments (only if not already scheduled)
                    if (!statusUpdated) {
                        const existingJobs = scheduledJobs.get(jobKey) || {};
                        // Schedule start job if startTime is in the future and status is "Not Started"
                        if (startTimeDate > now && tournament.status === "Not Started" && !existingJobs.startJob) {
                            const startJob = node_schedule_1.default.scheduleJob(startTimeDate, () => __awaiter(this, void 0, void 0, function* () {
                                try {
                                    yield (0, database_1.update)(tournamentRef, { status: "Active" });
                                    console.log(`✅ Tournament ${tournamentId} (${tokenType}) has started.`);
                                    // Clean up job after execution
                                    const jobs = scheduledJobs.get(jobKey);
                                    if (jobs) {
                                        jobs.startJob = undefined;
                                        if (!jobs.endJob)
                                            scheduledJobs.delete(jobKey);
                                    }
                                }
                                catch (error) {
                                    console.error(`❌ Failed to start tournament ${tournamentId}:`, error);
                                }
                            }));
                            existingJobs.startJob = startJob;
                            scheduledJobs.set(jobKey, existingJobs);
                            scheduledCount++;
                        }
                        // Schedule end job if endTime is in the future and tournament is not already ended
                        if (endTimeDate > now &&
                            tournament.status !== "Ended" &&
                            tournament.status !== "Distributed" &&
                            tournament.status !== "Awarded" &&
                            !existingJobs.endJob) {
                            const endJob = node_schedule_1.default.scheduleJob(endTimeDate, () => __awaiter(this, void 0, void 0, function* () {
                                try {
                                    yield (0, database_1.update)(tournamentRef, { status: "Ended" });
                                    console.log(`✅ Tournament ${tournamentId} (${tokenType}) has ended.`);
                                    // Clean up job after execution
                                    const jobs = scheduledJobs.get(jobKey);
                                    if (jobs) {
                                        jobs.endJob = undefined;
                                        if (!jobs.startJob)
                                            scheduledJobs.delete(jobKey);
                                    }
                                }
                                catch (error) {
                                    console.error(`❌ Failed to end tournament ${tournamentId}:`, error);
                                }
                            }));
                            existingJobs.endJob = endJob;
                            scheduledJobs.set(jobKey, existingJobs);
                            scheduledCount++;
                        }
                    }
                }
            }
            if (updatedCount > 0 || scheduledCount > 0) {
                console.log(`✅ Tournament status check: Updated: ${updatedCount}, Scheduled: ${scheduledCount}, Skipped: ${skippedCount}`);
            }
        }
        catch (error) {
            console.error("❌ Error checking tournament statuses:", error);
        }
    });
}
//# sourceMappingURL=gamehubController.js.map