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
exports.createGame = createGame;
exports.getAllGames = getAllGames;
exports.getGameById = getGameById;
exports.getGamePerformanceMetrics = getGamePerformanceMetrics;
exports.updateGame = updateGame;
const database_1 = require("firebase/database");
const firebase_1 = require("../config/firebase"); // Adjust import path
const s3Service_1 = require("./s3Service");
function createGame(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { id, name, description, userId, status, adminPublicKey, image } = req.body;
            // Validate required fields
            if (!id || !name || !description || !userId || !status || !adminPublicKey) {
                res.status(400).json({
                    message: "Missing required fields: id, name, description, userId, status, adminPublicKey"
                });
                return;
            }
            // Validate status field  
            const validStatuses = ["draft", "published"];
            if (!validStatuses.includes(status)) {
                res.status(400).json({
                    message: "Invalid status. Must be one of: draft, published"
                });
                return;
            }
            // Create game object
            const game = {
                id,
                userId,
                name,
                description,
                image: image || "",
                status: status,
                createdAt: new Date(),
                updatedAt: new Date(),
                createdBy: adminPublicKey,
            };
            // Save to Firebase
            try {
                const gameRef = (0, database_1.ref)(firebase_1.db, "games");
                const newGameRef = (0, database_1.push)(gameRef);
                const gameId = newGameRef.key;
                yield (0, database_1.set)(newGameRef, game);
                res.status(201).json({
                    message: "Game created successfully",
                    gameId,
                    game: Object.assign(Object.assign({}, game), { firebaseId: gameId })
                });
                return;
            }
            catch (dbError) {
                console.error('Error saving to Firebase:', dbError);
                res.status(500).json({ message: "Failed to save game to database" });
                return;
            }
        }
        catch (error) {
            console.error('Unexpected error in createGame:', error);
            res.status(500).json({ message: "Internal Server Error" });
            return;
        }
    });
}
function getAllGames(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { adminPublicKey } = req.query;
            // Validate adminPublicKey parameter
            if (!adminPublicKey || typeof adminPublicKey !== 'string') {
                res.status(400).json({ message: "Missing required query parameter: adminPublicKey" });
                return;
            }
            const gamesRef = (0, database_1.ref)(firebase_1.db, "games");
            const gamesSnapshot = yield (0, database_1.get)(gamesRef);
            const gamesData = gamesSnapshot.val();
            // Convert Firebase object to array format and filter by adminPublicKey
            const allGames = gamesData ? Object.entries(gamesData).map(([firebaseKey, gameData]) => (Object.assign(Object.assign({}, gameData), { 
                // Ensure the game has an id - use the provided id or fallback to Firebase key
                id: gameData.id || firebaseKey }))) : [];
            // Filter games by the adminPublicKey (createdBy field)
            const games = allGames.filter((game) => game.createdBy === adminPublicKey);
            // console.log(`Fetched ${games.length} games for admin: ${adminPublicKey}`);
            res.status(200).json({ games });
            return;
        }
        catch (error) {
            console.error(error);
            res.status(500).json({ message: "Internal Server Error" });
            return;
        }
    });
}
function getGameById(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { id } = req.params;
            const gameRef = (0, database_1.ref)(firebase_1.db, `games/${id}`);
            const gameSnapshot = yield (0, database_1.get)(gameRef);
            const game = gameSnapshot.val();
            res.status(200).json({ game });
            return;
        }
        catch (error) {
            console.error(error);
            res.status(500).json({ message: "Internal Server Error" });
            return;
        }
    });
}
function getGamePerformanceMetrics(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // Get all games
            const gamesRef = (0, database_1.ref)(firebase_1.db, "games");
            const gamesSnapshot = yield (0, database_1.get)(gamesRef);
            const gamesData = gamesSnapshot.val();
            const games = gamesData ? Object.values(gamesData) : [];
            // Get all tournaments
            const tournamentsRef = (0, database_1.ref)(firebase_1.db, "tournaments");
            const tournamentsSnapshot = yield (0, database_1.get)(tournamentsRef);
            const tournamentsData = tournamentsSnapshot.val();
            const tournaments = tournamentsData ? Object.values(tournamentsData) : [];
            // Calculate performance metrics for each game
            const gamePerformanceMetrics = games.map((game) => {
                // Filter tournaments for this game
                const gameTournaments = tournaments.filter((tournament) => tournament.gameId === game.id);
                // Calculate total players across all tournaments for this game
                const totalPlayers = gameTournaments.reduce((sum, tournament) => {
                    return sum + (tournament.participantsCount || 0);
                }, 0);
                // Calculate total revenue generated from entry fees
                const totalRevenue = gameTournaments.reduce((sum, tournament) => {
                    const entryFee = parseFloat(tournament.entryFee) || 0;
                    const participants = tournament.participantsCount || 0;
                    return sum + (entryFee * participants);
                }, 0);
                // Count tournaments
                const tournamentCount = gameTournaments.length;
                return {
                    gameId: game.id,
                    gameName: game.name,
                    totalPlayers,
                    tournamentCount,
                    totalRevenue: Number(totalRevenue) / 1000000000, // Convert from lamports to tokens
                    category: game.status || 'Unknown'
                };
            });
            res.status(200).json({
                success: true,
                data: gamePerformanceMetrics
            });
            return;
        }
        catch (error) {
            console.error("Error fetching game performance metrics:", error);
            res.status(500).json({
                success: false,
                message: "Internal Server Error"
            });
            return;
        }
    });
}
function updateGame(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { gameId } = req.params;
            const { name, description, status, adminPublicKey } = req.body;
            if (!gameId) {
                res.status(400).json({ message: "Game ID is required" });
                return;
            }
            // Get current game data to handle image replacement
            const gameRef = (0, database_1.ref)(firebase_1.db, `games/${gameId}`);
            // You'll need to implement get functionality here
            let imageUrl = "";
            let oldImageKey = "";
            // Handle new image upload
            const imageFile = req.file;
            if (imageFile) {
                try {
                    const uploadResult = yield s3Service_1.S3Service.uploadFile(imageFile, 'games');
                    imageUrl = uploadResult.url;
                    // TODO: Get old image URL from existing game data and extract key for deletion
                    // const oldImageUrl = existingGame.image;
                    // if (oldImageUrl) {
                    //     oldImageKey = S3Service.extractKeyFromUrl(oldImageUrl);
                    // }
                }
                catch (uploadError) {
                    console.error('Error uploading new image:', uploadError);
                    res.status(400).json({ message: "Failed to upload new image" });
                    return;
                }
            }
            const updateData = {
                updatedAt: new Date(),
            };
            if (name)
                updateData.name = name;
            if (description)
                updateData.description = description;
            if (status)
                updateData.status = status;
            if (imageUrl)
                updateData.image = imageUrl;
            if (adminPublicKey)
                updateData.createdBy = adminPublicKey;
            // Update in Firebase
            yield (0, database_1.set)(gameRef, updateData);
            // Delete old image if new one was uploaded
            if (oldImageKey && imageUrl) {
                try {
                    yield s3Service_1.S3Service.deleteFile(oldImageKey);
                }
                catch (deleteError) {
                    console.error('Error deleting old image:', deleteError);
                    // Don't fail the request if cleanup fails
                }
            }
            res.status(200).json({
                message: "Game updated successfully",
                gameId
            });
        }
        catch (error) {
            console.error('Error updating game:', error);
            res.status(500).json({ message: "Internal Server Error" });
        }
    });
}
//# sourceMappingURL=controller.js.map