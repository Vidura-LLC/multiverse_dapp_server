"use strict";
//src/adminDashboard/adminDashboardRoutes.ts
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const adminDashboardController_1 = require("./adminDashboardController");
const router = (0, express_1.Router)();
// Route for checking the staking pool status (pools are global, uses super admin from platform config)
router.get('/check-pool-status', adminDashboardController_1.checkPoolStatusController);
// Route for initializing the staking pool
router.post('/initialize-staking-pool', adminDashboardController_1.initializeStakingPoolController);
// Route for initializing the reward pool
router.post('/initialize-reward-pool', adminDashboardController_1.initializeRewardPoolController);
// Route for initializing the prize pool (creates transaction)
router.post('/initialize-prize-pool', adminDashboardController_1.initializePrizePoolController);
// Route to confirm prize pool initialization after transaction is verified
router.post('/confirm-prize-pool', adminDashboardController_1.confirmPrizePoolController);
// Main route to get comprehensive staking statistics (for your dashboard)
router.get('/staking/stats/:adminPublicKey', adminDashboardController_1.getStakingStatsController);
// Route to get staking pool data only (pools are global, uses super admin from platform config)
router.get('/staking/pool-data', adminDashboardController_1.getStakingPoolController);
// Route to get active stakers count and basic info
router.get('/staking/active-stakers', adminDashboardController_1.getActiveStakersController);
// Route to get current APY calculation
router.get('/staking/apy', adminDashboardController_1.getAPYController);
// Route to get detailed stakers information with pagination
// Query parameters: page, limit, sortBy, sortOrder
// Example: /api/staking/stakers?page=1&limit=10&sortBy=stakedAmount&sortOrder=desc
router.get('/staking/stakers', adminDashboardController_1.getDetailedStakersController);
// Route to get tournament stats
router.get('/tournaments/stats', adminDashboardController_1.getTournamentStatsController);
// Route to get revenue stats
router.get('/revenue/stats/:adminPublicKey', adminDashboardController_1.getRevenuePoolStatsController);
// Route to get dashboard data
router.get('/dashboardStats/:adminPublicKey', adminDashboardController_1.getDashboardStatsController);
// ==============================
// PLATFORM CONFIGURATION ROUTES
// ==============================
// Route to initialize platform configuration (one-time setup)
router.post('/platform-config/initialize', adminDashboardController_1.initializePlatformConfigController);
// Route to update platform configuration (share percentages)
router.post('/platform-config/update', adminDashboardController_1.updatePlatformConfigController);
// Route to update platform wallet
router.post('/platform-config/update-wallet', adminDashboardController_1.updatePlatformWalletController);
// Route to transfer super admin role
router.post('/platform-config/transfer-admin', adminDashboardController_1.transferSuperAdminController);
// Route to get platform configuration
router.get('/platform-config', adminDashboardController_1.getPlatformConfigController);
exports.default = router;
//# sourceMappingURL=adminDashboardRoutes.js.map