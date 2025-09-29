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
const database_1 = require("firebase/database/dist/database");
const firebase_1 = require("../config/firebase");
function createGame(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { id, name, description, userId, status, adminPublicKey } = req.body;
            // Validate required fields
            if (!id || !name || !description || !userId || !status || !adminPublicKey) {
                res.status(400).json({ message: "Missing required fields: id, name, description, userId, status" });
                return;
            }
            // Validate status field
            const validStatuses = ["Active", "Upcoming", "Ended", "Draft", "Distributed", "Awarded"];
            if (!validStatuses.includes(status)) {
                res.status(400).json({ message: "Invalid status. Must be one of: Active, Upcoming, Ended, Draft, Distributed, Awarded" });
                return;
            }
            // Check if image file was uploaded (optional for now)
            const imageFile = req.file;
            if (imageFile) {
                console.log(`Image uploaded: ${imageFile.originalname}, size: ${imageFile.size} bytes`);
                // TODO: Upload to S3 bucket and get URL
            }
            // For now, save empty string for image field as requested
            // This will be replaced with S3 URL later
            const game = {
                id, // Use the provided ID from frontend
                userId,
                name,
                description,
                image: "", // Empty field for now, will integrate S3 bucket later
                status: status,
                createdAt: new Date(),
                updatedAt: new Date(),
                createdBy: adminPublicKey,
            };
            const gameRef = (0, database_1.ref)(firebase_1.db, "games");
            const newGameRef = (0, database_1.push)(gameRef);
            const gameId = newGameRef.key;
            if (!gameId) {
                res.status(500).json({ message: "Failed to generate game ID" });
                return;
            }
            yield (0, database_1.set)(newGameRef, game);
            res.status(201).json({ message: "Game created successfully", gameId });
            return;
        }
        catch (error) {
            console.error(error);
            res.status(500).json({ message: "Internal Server Error" });
            return;
        }
    });
}
function getAllGames(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const gamesRef = (0, database_1.ref)(firebase_1.db, "games");
            const gamesSnapshot = yield (0, database_1.get)(gamesRef);
            const games = gamesSnapshot.val();
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
//# sourceMappingURL=controller.js.map