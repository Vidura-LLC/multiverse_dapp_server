"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const controller_1 = require("./controller");
const router = (0, express_1.Router)();
// Create game with multipart fields only (no file handling for now)
router.post('/create-game', controller_1.createGame);
// Update game with optional image upload
router.put('/games/:gameId', controller_1.updateGame);
router.get('/all-games', controller_1.getAllGames);
router.get('/game/:id', controller_1.getGameById);
router.get('/performance-metrics', controller_1.getGamePerformanceMetrics);
exports.default = router;
//# sourceMappingURL=routes.js.map