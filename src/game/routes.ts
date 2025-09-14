import { Router } from "express";
import { createGame, getAllGames, getGameById } from "./controller";

const router = Router();

router.post('/create-game', createGame);
router.get('/all-games', getAllGames);
router.get('/game/:id', getGameById);

export default router;