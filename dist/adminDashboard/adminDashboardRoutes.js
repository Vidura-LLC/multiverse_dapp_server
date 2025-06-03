"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const adminDashboardController_1 = require("./adminDashboardController");
const router = (0, express_1.Router)();
// Route for checking the staking pool status
router.get('/check-pool-status/:adminPublicKey', adminDashboardController_1.checkPoolStatusController);
// Route for initializing the staking pool
router.post('/initialize-staking-pool', adminDashboardController_1.initializeStakingPoolController);
// Route for initializing the global revenue pool
router.post('/initialize-revenue-pool', adminDashboardController_1.initializeRevenuePoolController);
exports.default = router;
//# sourceMappingURL=adminDashboardRoutes.js.map