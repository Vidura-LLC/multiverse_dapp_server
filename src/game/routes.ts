import { Router } from "express";
import { createGame } from "./controller";

const router = Router();

router.post('/create-game', createGame);