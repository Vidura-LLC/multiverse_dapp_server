import { RequestHandler, Router } from "express";
import { createAtaForUser } from "./controller";

const router = Router();

router.post("/create-ata", createAtaForUser as unknown as RequestHandler);

export default router;
