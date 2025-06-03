"use strict";
// src/revenue/revenueRoutes.ts - Update with these new routes
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const revenueController_1 = require("./revenueController");
const router = (0, express_1.Router)();
// Route for initializing a prize pool for a specific tournament
router.post('/initialize-prize-pool', revenueController_1.initializePrizePoolController);
// Route for distributing tournament revenue
router.post('/distribute-tournament', revenueController_1.distributeTournamentRevenueController);
// Route for distributing tournament prizes
router.post('/distribute-prizes', revenueController_1.distributeTournamentPrizesController);
// Route for getting prize distribution details
router.get('/prize-distribution/:tournamentId', revenueController_1.getTournamentPrizesDistributionController);
exports.default = router;
//# sourceMappingURL=revenueRoutes.js.map