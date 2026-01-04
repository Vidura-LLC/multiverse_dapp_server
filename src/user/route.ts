import { RequestHandler, Router } from "express";
import { createAtaForUser, checkAdminStatus } from "./controller";

const router = Router();

router.post("/create-ata", createAtaForUser as unknown as RequestHandler);
router.get("/check-admin", checkAdminStatus as unknown as RequestHandler);

export default router;
