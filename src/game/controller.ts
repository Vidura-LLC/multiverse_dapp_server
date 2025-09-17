import { Request, Response } from "express";
import { get, push, ref, set } from "firebase/database";
import { Game, TGameStatus } from "../types/game";
import { db } from "../config/firebase"


export async function createGame(req: Request, res: Response): Promise<void> {
    try {
        const { id, name, description, userId, status } = req.body;

        // Validate required fields
        if (!id || !name || !description || !userId) {
            res.status(400).json({ message: "Missing required fields: id, name, description, userId, status" });
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
        const game: Game = {
            id, // Use the provided ID from frontend
            userId,
            name,
            description,
            image: "", // Empty field for now, will integrate S3 bucket later
            status: status as TGameStatus,
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        const gameRef = ref(db, "games");
        const newGameRef = push(gameRef);
        const gameId = newGameRef.key;
        if (!gameId) {
            res.status(500).json({ message: "Failed to generate game ID" });
            return
        }
        await set(newGameRef, game);
        res.status(201).json({ message: "Game created successfully", gameId });
        return;
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal Server Error" });
        return;
    }
}

export async function getAllGames(req: Request, res: Response): Promise<void> {
    try {
        const gamesRef = ref(db, "games");
        const gamesSnapshot = await get(gamesRef);
        const gamesData = gamesSnapshot.val();

        // Convert Firebase object to array format
        const games = gamesData ? Object.values(gamesData) : [];

        res.status(200).json({ games });
        return;
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal Server Error" });
        return;
    }
}

export async function getGameById(req: Request, res: Response): Promise<void> {
    try {
        const { id } = req.params;
        const gameRef = ref(db, `games/${id}`);
        const gameSnapshot = await get(gameRef);
        const game = gameSnapshot.val();
        res.status(200).json({ game });
        return;
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal Server Error" });
        return;
    }
}