"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const stakingController_1 = require("./stakingController");
const router = (0, express_1.Router)();
// Route for initializing the staking pool
router.post('/initialize', stakingController_1.initializeAccountsController);
//Route to handle staking tokens
router.post('/stake', stakingController_1.stakeTokens);
//Route to handle unstaking tokens
router.post('/unstake', stakingController_1.unstakeTokens);
// Route to get user staking account
router.get('/user-staked-amount/:userPublicKey', stakingController_1.fetchUserStakingAccount);
// Route to create ATA
router.post('/create-ATA', stakingController_1.createTokenAccountController);
// Route to create ATA with Keypair for testing purpose
router.post('/create-ATA-Keypair', stakingController_1.createTokenAccountControllerWithKeypair);
exports.default = router;
//# sourceMappingURL=stakingRoutes.js.map