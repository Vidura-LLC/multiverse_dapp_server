"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const stakingController_1 = require("./stakingController");
const router = (0, express_1.Router)();
// Route for initializing the staking pool
router.post('/initialize', stakingController_1.initializeAccountsController);
//Route to handle staking tokens
router.post('/stake', stakingController_1.stakeTokens);
exports.default = router;
//# sourceMappingURL=stakingRoutes.js.map