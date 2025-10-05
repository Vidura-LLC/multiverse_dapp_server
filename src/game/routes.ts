import { Router } from "express";
import { createGame, getAllGames, getGameById, getGamePerformanceMetrics, updateGame } from "./controller";
import {upload, handleMulterError} from "../middleware/mutler"
const router = Router();

// Create game with multipart fields only (no file handling for now)
router.post(
  '/create-game',
  createGame
);
  
  // Update game with optional image upload
  router.put(
    '/games/:gameId',
    updateGame
  );router.get('/all-games', getAllGames);
router.get('/game/:id', getGameById);
router.get('/performance-metrics', getGamePerformanceMetrics);

export default router;