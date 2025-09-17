"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const controller_1 = require("./controller");
const multer_1 = __importDefault(require("multer"));
const router = (0, express_1.Router)();
// Configure multer for handling multipart form data
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(), // Store in memory for now
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
    },
    fileFilter: (req, file, cb) => {
        // Accept only image files
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        }
        else {
            cb(new Error('Only image files are allowed'));
        }
    }
});
router.post('/create-game', upload.single('image'), controller_1.createGame);
router.get('/all-games', controller_1.getAllGames);
router.get('/game/:id', controller_1.getGameById);
exports.default = router;
//# sourceMappingURL=routes.js.map