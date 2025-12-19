import { RequestHandler, Router } from "express";
import { getAllGames, getGameById, getGamePerformanceMetrics, updateGame } from "./controller";
import { createGameController } from "../sdk/sdkCredentialsController";
import {upload, handleMulterError} from "../middleware/mutler"
const router = Router();

// Create game with multipart fields only (no file handling for now)
router.post(
  '/create-game',
  createGameController as unknown as RequestHandler
);
  
  // Update game with optional image upload
  router.put(
    '/games/:gameId',
    updateGame
  );router.get('/all-games', getAllGames);
router.get('/game/:id', getGameById);
router.get('/performance-metrics', getGamePerformanceMetrics);

export default router;