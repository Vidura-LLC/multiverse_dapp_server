"use strict";
// src/revenue/revenueRoutes.ts - Update with these new routes
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const revenueController_1 = require("./revenueController");
const router = (0, express_1.Router)();
// Route for distributing tournament revenue
router.post('/distribute-tournament', revenueController_1.distributeTournamentRevenueController);
// Route for confirming tournament revenue distribution
router.post('/confirm-distribution', revenueController_1.confirmDistributionController);
// Route for distributing tournament prizes
router.post('/distribute-prizes', revenueController_1.distributeTournamentPrizesController);
//Router for confirming prize distribution
router.post('/confirm-prize-distribution', revenueController_1.confirmPrizeDistributionController);
// Route for getting prize distribution details
router.get('/prize-distribution/:tournamentId', revenueController_1.getTournamentPrizesDistributionController);
// Route for admin total prizes distributed across tournaments
router.get('/admin/prizes-distributed/:adminPubKey', revenueController_1.getAdminPrizesDistributedController);
// Route for admin distribution totals aggregation
router.get('/admin/distribution-totals/:adminPubKey', revenueController_1.getAdminDistributionTotalsController);
// ==============================
// DEVELOPER REVENUE ENDPOINTS
// ==============================
// Get developer revenue history (paginated) - MUST come before the general route
router.get('/developer/:developerPublicKey/history', revenueController_1.getDeveloperRevenueHistoryController);
// Get developer revenue statistics
router.get('/developer/:developerPublicKey', revenueController_1.getDeveloperRevenueController);
// ==============================
// PLATFORM REVENUE ENDPOINTS (Admin Only)
// ==============================
// Get platform revenue statistics
router.get('/platform', revenueController_1.getPlatformRevenueController);
// Get platform revenue history (paginated)
router.get('/platform/history', revenueController_1.getPlatformRevenueHistoryController);
// Get platform revenue grouped by developer
router.get('/platform/by-developer', revenueController_1.getPlatformRevenueByDeveloperController);
exports.default = router;
//# sourceMappingURL=revenueRoutes.js.map