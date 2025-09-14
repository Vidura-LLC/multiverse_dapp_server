import { Request, Response } from "express";
import { push, ref, set } from "firebase/database/dist/database";
import { Game } from "game";
import { db } from "../config/firebase"
import { v4 as uuidv4 } from "uuid";

export async function createGame(req: Request, res: Response): Promise<void> {
    try {
        const { name, description, image, userId } = req.body;
        const game: Game = {
            id: uuidv4(),
            userId,
            name,
            description,
            image,
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