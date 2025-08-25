"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const stakingController_1 = require("./stakingController");
const router = (0, express_1.Router)();
//Route to handle staking tokens
router.post('/stake', stakingController_1.stakeTokensController);
//Route to handle unstaking tokens
router.post('/unstake', stakingController_1.unstakeTokensController);
// Route to claim rewards
router.post('/claim-rewards', stakingController_1.claimRewardsController);
// Route to get user staking account
router.get('/user-staked-amount/:userPublicKey', stakingController_1.fetchUserStakingAccountController);
// Route to accrue rewards for a specific user
router.post('/accrue-rewards', stakingController_1.accrueRewardsController);
exports.default = router;
//# sourceMappingURL=stakingRoutes.js.map