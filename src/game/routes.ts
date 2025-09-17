import { Router } from "express";
import { createGame, getAllGames, getGameById } from "./controller";
import multer from "multer";

const router = Router();

// Configure multer for handling multipart form data
const upload = multer({
    storage: multer.memoryStorage(), // Store in memory for now
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
    },
    fileFilter: (req, file, cb) => {
        // Accept only image files
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed'));
        }
    }
});

router.post('/create-game', upload.single('image'), createGame);
router.get('/all-games', getAllGames);
router.get('/game/:id', getGameById);

export default router;