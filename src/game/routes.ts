import { Router } from "express";
import { createGame, getAllGames, getGameById, getGamePerformanceMetrics, updateGame } from "./controller";
import {upload, handleMulterError} from "../middleware/mutler"
const router = Router();

// Create game with image upload
router.post(
    '/games',
    upload.single('image'), // 'image' should match the FormData field name
    handleMulterError,
    createGame
  );
  
  // Update game with optional image upload
  router.put(
    '/games/:gameId',
    upload.single('image'),
    handleMulterError,
    updateGame
  );router.get('/all-games', getAllGames);
router.get('/game/:id', getGameById);
router.get('/performance-metrics', getGamePerformanceMetrics);

export default router;