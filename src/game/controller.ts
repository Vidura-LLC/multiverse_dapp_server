import { Request, Response } from 'express';
import { ref, push, set, get } from 'firebase/database';
import { db } from '../config/firebase'; // Adjust import path
import { S3Service } from './s3Service';
import { Game, TGameStatus } from '../types/game'; // Adjust import path

export async function createGame(req: Request, res: Response): Promise<void> {
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
        const game: Game = {
            id,
            userId,
            name,
            description,
            image: image || "",
            status: status as TGameStatus,
            createdAt: new Date(),
            updatedAt: new Date(),
            createdBy: adminPublicKey,
        };

        // Save to Firebase
        try {
            const gameRef = ref(db, "games");
            const newGameRef = push(gameRef);
            const gameId = newGameRef.key;

            await set(newGameRef, game);

            res.status(201).json({
                message: "Game created successfully",
                gameId,
                game: {
                    ...game,
                    firebaseId: gameId
                }
            });
            return;
        } catch (dbError) {
            console.error('Error saving to Firebase:', dbError);
            res.status(500).json({ message: "Failed to save game to database" });
            return;
        }
    } catch (error) {
        console.error('Unexpected error in createGame:', error);
        res.status(500).json({ message: "Internal Server Error" });
        return;
    }
}

export async function getAllGames(req: Request, res: Response): Promise<void> {
    try {
        const { adminPublicKey } = req.query;

        // Validate adminPublicKey parameter
        if (!adminPublicKey || typeof adminPublicKey !== 'string') {
            res.status(400).json({ message: "Missing required query parameter: adminPublicKey" });
            return;
        }

        const gamesRef = ref(db, "games");
        const gamesSnapshot = await get(gamesRef);
        const gamesData = gamesSnapshot.val();

        // Convert Firebase object to array format and filter by adminPublicKey
        const allGames = gamesData ? Object.entries(gamesData).map(([firebaseKey, gameData]: [string, any]) => ({
            ...gameData,
            // Ensure the game has an id - use the provided id or fallback to Firebase key
            id: gameData.id || firebaseKey
        })) : [];

        // Filter games by the adminPublicKey (createdBy field)
        const games = allGames.filter((game: any) => game.createdBy === adminPublicKey);

        // console.log(`Fetched ${games.length} games for admin: ${adminPublicKey}`);
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

export async function getGamePerformanceMetrics(req: Request, res: Response): Promise<void> {
    try {
        // Get all games
        const gamesRef = ref(db, "games");
        const gamesSnapshot = await get(gamesRef);
        const gamesData = gamesSnapshot.val();
        const games = gamesData ? Object.values(gamesData) as Game[] : [];

        // Get all tournaments
        const tournamentsRef = ref(db, "tournaments");
        const tournamentsSnapshot = await get(tournamentsRef);
        const tournamentsData = tournamentsSnapshot.val();
        const tournaments = tournamentsData ? Object.values(tournamentsData) : [];

        // Calculate performance metrics for each game
        const gamePerformanceMetrics = games.map((game: Game) => {
            // Filter tournaments for this game
            const gameTournaments = tournaments.filter((tournament: any) =>
                tournament.gameId === game.id
            );

            // Calculate total players across all tournaments for this game
            const totalPlayers = gameTournaments.reduce((sum: number, tournament: any) => {
                return sum + (tournament.participantsCount || 0);
            }, 0);

            // Calculate total revenue generated from entry fees
            const totalRevenue = gameTournaments.reduce((sum: number, tournament: any) => {
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
                totalRevenue: Number(totalRevenue) / 1_000_000_000, // Convert from lamports to tokens
                category: game.status || 'Unknown'
            };
        });

        res.status(200).json({
            success: true,
            data: gamePerformanceMetrics
        });
        return;
    } catch (error) {
        console.error("Error fetching game performance metrics:", error);
        res.status(500).json({
            success: false,
            message: "Internal Server Error"
        });
        return;
    }
}

export async function updateGame(req: Request, res: Response): Promise<void> {
    try {
        const { gameId } = req.params;
        const { name, description, status, adminPublicKey } = req.body;

        if (!gameId) {
            res.status(400).json({ message: "Game ID is required" });
            return;
        }

        // Get current game data to handle image replacement
        const gameRef = ref(db, `games/${gameId}`);
        // You'll need to implement get functionality here

        let imageUrl = "";
        let oldImageKey = "";

        // Handle new image upload
        const imageFile = req.file;
        if (imageFile) {
            try {
                const uploadResult = await S3Service.uploadFile(imageFile, 'games');
                imageUrl = uploadResult.url;

                // TODO: Get old image URL from existing game data and extract key for deletion
                // const oldImageUrl = existingGame.image;
                // if (oldImageUrl) {
                //     oldImageKey = S3Service.extractKeyFromUrl(oldImageUrl);
                // }

            } catch (uploadError) {
                console.error('Error uploading new image:', uploadError);
                res.status(400).json({ message: "Failed to upload new image" });
                return;
            }
        }

        const updateData: Partial<Game> = {
            updatedAt: new Date(),
        };

        if (name) updateData.name = name;
        if (description) updateData.description = description;
        if (status) updateData.status = status as TGameStatus;
        if (imageUrl) updateData.image = imageUrl;
        if (adminPublicKey) updateData.createdBy = adminPublicKey;

        // Update in Firebase
        await set(gameRef, updateData);

        // Delete old image if new one was uploaded
        if (oldImageKey && imageUrl) {
            try {
                await S3Service.deleteFile(oldImageKey);
            } catch (deleteError) {
                console.error('Error deleting old image:', deleteError);
                // Don't fail the request if cleanup fails
            }
        }

        res.status(200).json({
            message: "Game updated successfully",
            gameId
        });

    } catch (error) {
        console.error('Error updating game:', error);
        res.status(500).json({ message: "Internal Server Error" });
    }
}