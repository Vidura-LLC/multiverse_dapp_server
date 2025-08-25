"use strict";
//backend/src/staking/stakingController.ts
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.accrueRewardsController = exports.fetchUserStakingAccountController = exports.unstakeTokensController = exports.claimRewardsController = exports.stakeTokensController = void 0;
const services_1 = require("./services");
const web3_js_1 = require("@solana/web3.js");
// Controller to handle staking requests
const stakeTokensController = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    console.log('Staking invoked');
    try {
        const { mintPublicKey, userPublicKey, amount, lockDuration, adminPublicKey } = req.body;
        // Validate required fields
        if (!mintPublicKey || !userPublicKey || !amount || !lockDuration || !adminPublicKey) {
            return res.status(400).json({
                success: false,
                message: "Missing required fields: mintPublicKey, userPublicKey, amount, lockDuration, and adminPublicKey are required"
            });
        }
        // Validate types
        if (typeof amount !== 'number' || typeof lockDuration !== 'number') {
            return res.status(400).json({
                success: false,
                message: "Amount and lockDuration must be numbers"
            });
        }
        // Validate positive values
        if (amount <= 0 || lockDuration <= 0) {
            return res.status(400).json({
                success: false,
                message: "Amount and lockDuration must be positive numbers"
            });
        }
        console.log('Request body validation passed:', {
            mintPublicKey,
            userPublicKey,
            amount,
            lockDuration,
            adminPublicKey
        });
        // Validate PublicKey formats
        try {
            new web3_js_1.PublicKey(mintPublicKey);
            new web3_js_1.PublicKey(userPublicKey);
            new web3_js_1.PublicKey(adminPublicKey);
        }
        catch (pubkeyError) {
            return res.status(400).json({
                success: false,
                message: "Invalid PublicKey format provided"
            });
        }
        // Call the service function to create an unsigned transaction
        const result = yield (0, services_1.stakeTokenService)(new web3_js_1.PublicKey(mintPublicKey), new web3_js_1.PublicKey(userPublicKey), amount, lockDuration, new web3_js_1.PublicKey(adminPublicKey));
        if (result.success) {
            return res.status(200).json(result);
        }
        else {
            return res.status(500).json(result);
        }
    }
    catch (err) {
        console.error("Error in staking tokens:", err);
        return res.status(500).json({
            success: false,
            message: `Internal server error: ${err.message || err}`
        });
    }
});
exports.stakeTokensController = stakeTokensController;
// ✅ Controller to claim staking rewards
const claimRewardsController = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { userPublicKey, adminPublicKey } = req.body;
        if (!userPublicKey || !adminPublicKey) {
            return res.status(400).json({ success: false, message: 'userPublicKey and adminPublicKey are required' });
        }
        const result = yield (0, services_1.claimRewardsService)(new web3_js_1.PublicKey(userPublicKey), new web3_js_1.PublicKey(adminPublicKey));
        if (result.success) {
            return res.status(200).json(result);
        }
        else {
            return res.status(500).json(result);
        }
    }
    catch (err) {
        console.error('❌ Error in claimRewardsController:', err);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
});
exports.claimRewardsController = claimRewardsController;
const unstakeTokensController = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { userPublicKey, adminPublicKey } = req.body;
        // Validate required fields
        if (!userPublicKey || !adminPublicKey) {
            return res.status(400).json({
                success: false,
                message: "Missing required fields: userPublicKey and adminPublicKey are required"
            });
        }
        // Validate PublicKey formats
        try {
            new web3_js_1.PublicKey(userPublicKey);
            new web3_js_1.PublicKey(adminPublicKey);
        }
        catch (pubkeyError) {
            return res.status(400).json({
                success: false,
                message: "Invalid PublicKey format provided"
            });
        }
        // Get the mint public key from the staking pool
        const { program } = (0, services_1.getProgram)();
        const [stakingPoolPublicKey] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("staking_pool"), new web3_js_1.PublicKey(adminPublicKey).toBuffer()], program.programId);
        // Fetch the staking pool data to get the mint public key
        const stakingPoolData = yield program.account.stakingPool.fetch(stakingPoolPublicKey);
        const mintPublicKey = stakingPoolData.mint;
        const result = yield (0, services_1.unstakeTokenService)(mintPublicKey, new web3_js_1.PublicKey(userPublicKey), new web3_js_1.PublicKey(adminPublicKey));
        if (result.success) {
            return res.status(200).json(result);
        }
        else {
            return res.status(500).json(result);
        }
    }
    catch (err) {
        console.error("Error in unstaking tokens:", err);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
});
exports.unstakeTokensController = unstakeTokensController;
// ✅ Controller function to fetch user staking account
const fetchUserStakingAccountController = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { userPublicKey } = req.params;
        if (!userPublicKey) {
            return res.status(400).json({ success: false, message: "User public key is required" });
        }
        const userPubkey = new web3_js_1.PublicKey(userPublicKey);
        const result = yield (0, services_1.getUserStakingAccount)(userPubkey);
        if (result.success) {
            return res.status(200).json(result);
        }
        else {
            return res.status(200).json(result);
        }
    }
    catch (err) {
        console.error("❌ Error in fetching user staking account:", err);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
});
exports.fetchUserStakingAccountController = fetchUserStakingAccountController;
// Controller function to accrue rewards for a specific user
const accrueRewardsController = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { userPublicKey, adminPublicKey } = req.body;
        if (!userPublicKey || !adminPublicKey) {
            return res.status(400).json({
                success: false,
                message: "userPublicKey and adminPublicKey are required."
            });
        }
        const userPubkey = new web3_js_1.PublicKey(userPublicKey);
        const adminPubkey = new web3_js_1.PublicKey(adminPublicKey);
        const result = yield (0, services_1.accrueRewardsService)(userPubkey, adminPubkey);
        if (result.success) {
            return res.status(200).json(result);
        }
        else {
            return res.status(400).json(result);
        }
    }
    catch (err) {
        console.error("❌ Error in accruing rewards:", err);
        return res.status(500).json({
            success: false,
            message: "Internal Server Error"
        });
    }
});
exports.accrueRewardsController = accrueRewardsController;
//# sourceMappingURL=stakingController.js.map