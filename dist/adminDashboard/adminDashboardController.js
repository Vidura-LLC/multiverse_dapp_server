"use strict";
//src/adminDashboard/adminDashboardController.ts
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
exports.getPlatformConfigController = exports.transferSuperAdminController = exports.updatePlatformWalletController = exports.updatePlatformConfigController = exports.initializePlatformConfigController = exports.getDashboardStatsController = exports.getRevenuePoolStatsController = exports.getTournamentStatsController = exports.getDetailedStakersController = exports.getAPYController = exports.getActiveStakersController = exports.getStakingPoolController = exports.getStakingStatsController = exports.initializeRewardPoolController = exports.confirmPrizePoolController = exports.initializePrizePoolController = exports.initializeStakingPoolController = exports.checkPoolStatusController = void 0;
const web3_js_1 = require("@solana/web3.js");
const services_1 = require("./services");
const getPDAs_1 = require("../utils/getPDAs");
const services_2 = require("../staking/services");
const stakingStatsService_1 = require("./stakingStatsService");
const dashboardStatsService_1 = require("./dashboardStatsService");
const database_1 = require("firebase/database");
const firebase_1 = require("../config/firebase");
const checkPoolStatusController = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { tokenType } = req.query;
        // Validate token type
        if (!tokenType) {
            return res.status(400).json({
                success: false,
                error: 'Token type is required'
            });
        }
        // Check staking pool status (expect 0 or 1)
        const tt = Number(tokenType);
        if (tt !== getPDAs_1.TokenType.SPL && tt !== getPDAs_1.TokenType.SOL) {
            return res.status(400).json({ success: false, error: 'tokenType must be 0 (SPL) or 1 (SOL)' });
        }
        // Pool status check uses super admin from platform config (pools are global)
        const result = yield (0, services_1.checkPoolStatus)(tt);
        if (result.success) {
            return res.status(200).json({
                data: result
            });
        }
        else {
            return res.status(400).json({
                success: false,
                error: ('message' in result ? result.message : 'Failed to check pool status')
            });
        }
    }
    catch (err) {
        console.error('Error in check staking pool status controller:', err);
        return res.status(500).json({
            success: false,
            error: 'Failed to check staking pool status',
            details: err.message
        });
    }
});
exports.checkPoolStatusController = checkPoolStatusController;
// Controller function for initializing the staking pool
const initializeStakingPoolController = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { mintPublicKey, adminPublicKey, tokenType } = req.body; // Get mint address and token type from request body
        // Validate the mint address
        if (!mintPublicKey || !adminPublicKey || tokenType === undefined || tokenType === null) {
            return res.status(400).json({ error: 'Mint public key, admin public key and token type are required' });
        }
        // Call the staking pool initialization service (expect 0 or 1)
        const tt = Number(tokenType);
        if (tt !== getPDAs_1.TokenType.SPL && tt !== getPDAs_1.TokenType.SOL) {
            return res.status(400).json({ error: 'tokenType must be 0 (SPL) or 1 (SOL)' });
        }
        const result = yield (0, services_1.initializeStakingPoolService)(new web3_js_1.PublicKey(mintPublicKey), tt, new web3_js_1.PublicKey(adminPublicKey));
        // Return the result
        if (result.success) {
            return res.status(200).json({ data: result });
        }
        else {
            return res.status(500).json({ error: result.message });
        }
    }
    catch (err) {
        console.error('Error in initialize staking pool controller:', err);
        return res.status(500).json({ error: 'Failed to initialize staking pool' });
    }
});
exports.initializeStakingPoolController = initializeStakingPoolController;
/**
 * Controller function for initializing a prize pool for a specific tournament
 */
const initializePrizePoolController = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { tournamentId, mintPublicKey, adminPublicKey, tokenType } = req.body;
        // Validate required fields
        if (!tournamentId || !adminPublicKey || tokenType === undefined) {
            return res.status(400).json({
                success: false,
                message: 'Tournament ID, Admin public key, and token type are required'
            });
        }
        const tt = Number(tokenType);
        if (tt !== getPDAs_1.TokenType.SPL && tt !== getPDAs_1.TokenType.SOL) {
            return res.status(400).json({
                success: false,
                message: 'tokenType must be 0 (SPL) or 1 (SOL)'
            });
        }
        // For SPL, mint is required
        if (tt === getPDAs_1.TokenType.SPL && !mintPublicKey) {
            return res.status(400).json({
                success: false,
                message: 'Mint public key is required for SPL tournaments'
            });
        }
        const adminPubKey = new web3_js_1.PublicKey(adminPublicKey);
        const mintPubkey = mintPublicKey ? new web3_js_1.PublicKey(mintPublicKey) : web3_js_1.SystemProgram.programId;
        // Call the service function to create transaction
        const result = yield (0, services_1.initializePrizePoolService)(tournamentId, mintPubkey, adminPubKey, tt);
        // Return transaction - prize pool will be updated in Firebase after transaction is confirmed
        if (result.success) {
            return res.status(200).json(result);
        }
        else {
            return res.status(500).json(result);
        }
    }
    catch (err) {
        console.error('Error in initialize prize pool controller:', err);
        return res.status(500).json({
            success: false,
            message: 'Failed to initialize prize pool',
            error: err.message || err
        });
    }
});
exports.initializePrizePoolController = initializePrizePoolController;
// Controller to confirm prize pool initialization after transaction is verified on blockchain
const confirmPrizePoolController = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { tournamentId, adminPublicKey, transactionSignature, prizePool, tokenType } = req.body;
        // Validate required fields
        if (!tournamentId || !adminPublicKey || !transactionSignature || !prizePool || tokenType === undefined || tokenType === null) {
            return res.status(400).json({
                success: false,
                message: "Missing required fields: tournamentId, adminPublicKey, transactionSignature, prizePool, or tokenType",
            });
        }
        const tt = Number(tokenType);
        if (tt !== getPDAs_1.TokenType.SPL && tt !== getPDAs_1.TokenType.SOL) {
            return res.status(400).json({ message: "tokenType must be 0 (SPL) or 1 (SOL)" });
        }
        // Verify transaction exists on blockchain and was successful
        const { connection, program } = (0, services_2.getProgram)();
        try {
            const txInfo = yield connection.getTransaction(transactionSignature, {
                maxSupportedTransactionVersion: 0
            });
            if (!txInfo) {
                return res.status(400).json({
                    success: false,
                    message: 'Transaction not found on blockchain'
                });
            }
            // Check if transaction was successful
            if ((_a = txInfo.meta) === null || _a === void 0 ? void 0 : _a.err) {
                return res.status(400).json({
                    success: false,
                    message: 'Transaction failed on blockchain',
                    error: txInfo.meta.err
                });
            }
        }
        catch (err) {
            console.error('Error verifying transaction on blockchain:', err);
            return res.status(400).json({
                success: false,
                message: 'Could not verify transaction on blockchain',
                error: err.message
            });
        }
        // Verify prize pool account exists on blockchain (confirms initialization was successful)
        try {
            const adminPubKey = new web3_js_1.PublicKey(adminPublicKey);
            const tournamentPoolPublicKey = (0, getPDAs_1.getTournamentPoolPDA)(adminPubKey, tournamentId, tt);
            const prizePoolPublicKey = (0, getPDAs_1.getPrizePoolPDA)(tournamentPoolPublicKey);
            // Verify the prize pool address matches
            if (prizePoolPublicKey.toBase58() !== prizePool) {
                return res.status(400).json({
                    success: false,
                    message: 'Prize pool address mismatch'
                });
            }
            // Try to fetch the prize pool account - if it exists, initialization was successful
            const prizePoolAccount = yield program.account.prizePool.fetchNullable(prizePoolPublicKey);
            if (!prizePoolAccount) {
                return res.status(400).json({
                    success: false,
                    message: 'Prize pool account not found on blockchain - initialization may have failed'
                });
            }
        }
        catch (err) {
            console.error('Error verifying prize pool account:', err);
            return res.status(400).json({
                success: false,
                message: 'Could not verify prize pool on blockchain - prize pool account does not exist',
                error: err.message
            });
        }
        // Transaction verified and prize pool confirmed - now update Firebase
        const tournamentRef = (0, database_1.ref)(firebase_1.db, `tournaments/${tt}/${tournamentId}`);
        const tournamentSnapshot = yield (0, database_1.get)(tournamentRef);
        if (!tournamentSnapshot.exists()) {
            return res.status(404).json({
                success: false,
                message: 'Tournament not found'
            });
        }
        const tournament = tournamentSnapshot.val();
        // Check if prize pool already exists (idempotency)
        if (tournament.prizePool) {
            return res.status(200).json({
                success: true,
                message: "Prize pool already initialized",
            });
        }
        // Update tournament with prize pool address
        tournament.prizePool = prizePool;
        yield (0, database_1.update)(tournamentRef, tournament);
        return res.status(200).json({
            success: true,
            message: "Prize pool confirmed and tournament updated",
            prizePool: prizePool
        });
    }
    catch (error) {
        console.error("❌ Error in confirmPrizePool controller:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message,
        });
    }
});
exports.confirmPrizePoolController = confirmPrizePoolController;
/**
 * Controller function for initializing the global revenue pool
 */
const initializeRewardPoolController = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { mintPublicKey, adminPublicKey, tokenType } = req.body;
        // Validate the mint address
        if (!mintPublicKey || !adminPublicKey || tokenType === undefined || tokenType === null) {
            return res.status(400).json({
                success: false,
                message: 'Mint, Admin public key and token type are required'
            });
        }
        // Call the service function to initialize reward pool
        const tt = Number(tokenType);
        if (tt !== getPDAs_1.TokenType.SPL && tt !== getPDAs_1.TokenType.SOL) {
            return res.status(400).json({ success: false, message: 'tokenType must be 0 (SPL) or 1 (SOL)' });
        }
        const result = yield (0, services_1.initializeRewardPoolService)(new web3_js_1.PublicKey(mintPublicKey), new web3_js_1.PublicKey(adminPublicKey), tt);
        // Return the result
        if (result.success) {
            return res.status(200).json({ data: result });
        }
        else {
            return res.status(500).json({ error: result.message });
        }
    }
    catch (err) {
        console.error('Error in initialize revenue pool controller:', err);
        return res.status(500).json({
            success: false,
            message: 'Failed to initialize revenue pool',
            error: err.message || err
        });
    }
});
exports.initializeRewardPoolController = initializeRewardPoolController;
/**
 * Controller function to get comprehensive staking statistics
 * This is the main endpoint for your dashboard
 */
const getStakingStatsController = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { adminPublicKey } = req.params;
        const { tokenType } = req.query;
        console.log('📊 Fetching staking statistics...');
        // Validate the admin address
        if (!adminPublicKey || !tokenType || tokenType === undefined || tokenType === null) {
            return res.status(400).json({
                success: false,
                message: 'Admin public key and token type are required'
            });
        }
        const tt = Number(tokenType);
        if (tt !== getPDAs_1.TokenType.SPL && tt !== getPDAs_1.TokenType.SOL) {
            return res.status(400).json({ success: false, message: 'tokenType must be 0 (SPL) or 1 (SOL)' });
        }
        const result = yield (0, dashboardStatsService_1.getStakingStats)(new web3_js_1.PublicKey(adminPublicKey), tt);
        if (result.success) {
            return res.status(200).json({
                message: "Staking statistics retrieved successfully",
                data: result
            });
        }
        else {
            return res.status(500).json({
                success: false,
                message: result.message || "Failed to fetch staking statistics"
            });
        }
    }
    catch (err) {
        console.error('❌ Error in staking stats controller:', err);
        return res.status(500).json({
            success: false,
            message: 'Internal server error while fetching staking statistics'
        });
    }
});
exports.getStakingStatsController = getStakingStatsController;
/**
 * Controller function to get staking pool data only
 */
const getStakingPoolController = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { tokenType } = req.query;
        console.log('🏦 Fetching staking pool data...');
        // Pool data uses super admin from platform config (pools are global)
        const result = yield (0, stakingStatsService_1.getStakingPoolData)(Number(tokenType));
        if (result.success) {
            return res.status(200).json({
                success: true,
                message: "Staking pool data retrieved successfully",
                data: result.data
            });
        }
        else {
            return res.status(500).json({
                success: false,
                message: result.message || "Failed to fetch staking pool data"
            });
        }
    }
    catch (err) {
        console.error('❌ Error in staking pool controller:', err);
        return res.status(500).json({
            success: false,
            message: 'Internal server error while fetching staking pool data'
        });
    }
});
exports.getStakingPoolController = getStakingPoolController;
/**
 * Controller function to get active stakers information
 */
const getActiveStakersController = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        console.log('👥 Fetching active stakers...');
        const { adminPublicKey, tokenType } = req.query;
        // If both params provided, filter by tokenType
        let result;
        if (adminPublicKey && tokenType !== undefined) {
            const tt = Number(tokenType);
            if (tt !== getPDAs_1.TokenType.SPL && tt !== getPDAs_1.TokenType.SOL) {
                return res.status(400).json({
                    success: false,
                    message: 'tokenType must be 0 (SPL) or 1 (SOL)'
                });
            }
            result = yield (0, stakingStatsService_1.getActiveStakers)(new web3_js_1.PublicKey(adminPublicKey), tt);
        }
        else {
            // Backward compatibility: get all stakers if params not provided
            result = yield (0, stakingStatsService_1.getActiveStakers)();
        }
        if (result.success) {
            return res.status(200).json({
                success: true,
                message: "Active stakers data retrieved successfully",
                data: result.data
            });
        }
        else {
            return res.status(500).json({
                success: false,
                message: result.message || "Failed to fetch active stakers data"
            });
        }
    }
    catch (err) {
        console.error('❌ Error in active stakers controller:', err);
        return res.status(500).json({
            success: false,
            message: 'Internal server error while fetching active stakers'
        });
    }
});
exports.getActiveStakersController = getActiveStakersController;
/**
 * Controller function to get APY calculation
 */
const getAPYController = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        console.log('📈 Calculating APY...');
        const result = yield (0, stakingStatsService_1.calculateAPY)();
        if (result.success) {
            return res.status(200).json({
                success: true,
                message: "APY calculated successfully",
                data: result.data
            });
        }
        else {
            return res.status(500).json({
                success: false,
                message: result.message || "Failed to calculate APY"
            });
        }
    }
    catch (err) {
        console.error('❌ Error in APY controller:', err);
        return res.status(500).json({
            success: false,
            message: 'Internal server error while calculating APY'
        });
    }
});
exports.getAPYController = getAPYController;
/**
 * Controller function to get detailed staker information with pagination
 */
const getDetailedStakersController = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        console.log('📋 Fetching detailed stakers information...');
        // Get pagination parameters from query
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const sortBy = req.query.sortBy || 'stakedAmount';
        const sortOrder = req.query.sortOrder || 'desc';
        const result = yield (0, stakingStatsService_1.getActiveStakers)();
        if (result.success) {
            const stakers = result.data.stakers;
            // Sort stakers
            const sortedStakers = stakers.sort((a, b) => {
                if (sortBy === 'stakedAmount') {
                    return sortOrder === 'desc' ? b.stakedAmount - a.stakedAmount : a.stakedAmount - b.stakedAmount;
                }
                else if (sortBy === 'stakeTimestamp') {
                    return sortOrder === 'desc' ?
                        parseInt(b.stakeTimestamp) - parseInt(a.stakeTimestamp) :
                        parseInt(a.stakeTimestamp) - parseInt(b.stakeTimestamp);
                }
                return 0;
            });
            // Apply pagination
            const startIndex = (page - 1) * limit;
            const endIndex = startIndex + limit;
            const paginatedStakers = sortedStakers.slice(startIndex, endIndex);
            return res.status(200).json({
                success: true,
                message: "Detailed stakers data retrieved successfully",
                data: {
                    stakers: paginatedStakers,
                    pagination: {
                        currentPage: page,
                        totalPages: Math.ceil(stakers.length / limit),
                        totalStakers: stakers.length,
                        stakersPerPage: limit,
                        hasNextPage: endIndex < stakers.length,
                        hasPrevPage: page > 1
                    },
                    summary: {
                        activeStakersCount: result.data.activeStakersCount,
                        totalStakers: result.data.totalStakers
                    }
                }
            });
        }
        else {
            return res.status(500).json({
                success: false,
                message: result.message || "Failed to fetch detailed stakers data"
            });
        }
    }
    catch (err) {
        console.error('❌ Error in detailed stakers controller:', err);
        return res.status(500).json({
            success: false,
            message: 'Internal server error while fetching detailed stakers'
        });
    }
});
exports.getDetailedStakersController = getDetailedStakersController;
/**
 * Controller to get tournament stats
 */
const getTournamentStatsController = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        console.log('📊 Fetching tournament statistics...');
        const { tokenType } = req.query;
        // Validate tokenType
        if (!tokenType || tokenType === undefined || tokenType === null) {
            return res.status(400).json({
                success: false,
                message: 'tokenType is required'
            });
        }
        const tt = Number(tokenType);
        if (tt !== getPDAs_1.TokenType.SPL && tt !== getPDAs_1.TokenType.SOL) {
            return res.status(400).json({
                success: false,
                message: 'tokenType must be 0 (SPL) or 1 (SOL)'
            });
        }
        // Call the service to get tournament stats filtered by tokenType
        const result = yield (0, dashboardStatsService_1.getTournamentStats)(tt);
        if (result !== null && result !== undefined) {
            return res.status(200).json({
                success: true,
                message: "Tournament statistics retrieved successfully",
                data: result
            });
        }
        else {
            return res.status(500).json({
                success: false,
                message: "Failed to fetch tournament statistics"
            });
        }
    }
    catch (err) {
        console.error('❌ Error in tournament stats controller:', err);
        return res.status(500).json({
            success: false,
            message: 'Internal server error while fetching tournament statistics'
        });
    }
});
exports.getTournamentStatsController = getTournamentStatsController;
/**
 * Controller function to get revenue pool statistics
 */
const getRevenuePoolStatsController = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { adminPublicKey } = req.params;
        const { tokenType } = req.query;
        // Call the service function
        const result = yield (0, dashboardStatsService_1.getRevenuePoolStatsService)(new web3_js_1.PublicKey(adminPublicKey), Number(tokenType));
        if (result.success) {
            return res.status(200).json({
                success: true,
                message: result.message,
                data: result
            });
        }
        else {
            // Return 404 if revenue pool doesn't exist, 500 for other errors
            const statusCode = result.message.includes('not been initialized') ? 404 : 500;
            return res.status(statusCode).json({
                success: false,
                message: result.message
            });
        }
    }
    catch (err) {
        console.error('❌ Error in getRevenuePoolStatsController:', err);
        return res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: err.message || err
        });
    }
});
exports.getRevenuePoolStatsController = getRevenuePoolStatsController;
/**
 * Controller function to get all dashboard statistics
 * This is the main endpoint for your dashboard
 */
const getDashboardStatsController = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        console.log('📊 Fetching all dashboard statistics...');
        const { adminPublicKey } = req.params;
        const { tokenType } = req.query;
        // Validate the admin public key
        if (!adminPublicKey) {
            return res.status(400).json({
                success: false,
                message: 'Admin public key is required'
            });
        }
        // Call the service to get all stats
        const result = yield (0, dashboardStatsService_1.getDashboardData)(new web3_js_1.PublicKey(adminPublicKey), Number(tokenType));
        if (result) {
            return res.status(200).json({
                success: true,
                message: "Dashboard statistics retrieved successfully",
                dashboardStats: result
            });
        }
        else {
            return res.status(500).json({
                success: false,
                message: result.message || "Failed to fetch dashboard statistics"
            });
        }
    }
    catch (err) {
        console.error('❌ Error in dashboard stats controller:', err);
        return res.status(500).json({
            success: false,
            message: 'Internal server error while fetching dashboard statistics'
        });
    }
});
exports.getDashboardStatsController = getDashboardStatsController;
// ==============================
// PLATFORM CONFIGURATION CONTROLLERS
// ==============================
/**
 * Controller to initialize platform configuration (super admin only, one-time)
 */
const initializePlatformConfigController = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { superAdminPublicKey, platformWalletPublicKey, developerShareBps = 9000, platformShareBps = 1000, developerOnboardingFee = 0 // In lamports, default 0
         } = req.body;
        // Validate required fields
        if (!superAdminPublicKey) {
            return res.status(400).json({
                success: false,
                message: 'Super admin public key is required'
            });
        }
        if (!platformWalletPublicKey) {
            return res.status(400).json({
                success: false,
                message: 'Platform wallet public key is required'
            });
        }
        // Validate public key formats
        let superAdminPubKey;
        let platformWalletPubKey;
        try {
            superAdminPubKey = new web3_js_1.PublicKey(superAdminPublicKey);
            platformWalletPubKey = new web3_js_1.PublicKey(platformWalletPublicKey);
        }
        catch (err) {
            return res.status(400).json({
                success: false,
                message: 'Invalid public key format'
            });
        }
        // Validate share percentages
        const devBps = Number(developerShareBps);
        const platBps = Number(platformShareBps);
        if (isNaN(devBps) || isNaN(platBps)) {
            return res.status(400).json({
                success: false,
                message: 'Share percentages must be valid numbers'
            });
        }
        if (devBps + platBps !== 10000) {
            return res.status(400).json({
                success: false,
                message: `Share percentages must sum to 10000 (100%). Current total: ${devBps + platBps}`
            });
        }
        // Validate onboarding fee
        const onboardingFee = Number(developerOnboardingFee);
        if (isNaN(onboardingFee) || onboardingFee < 0) {
            return res.status(400).json({
                success: false,
                message: 'Developer onboarding fee must be a valid non-negative number'
            });
        }
        // Call the service
        const result = yield (0, services_1.initializePlatformConfigService)(superAdminPubKey, platformWalletPubKey, devBps, platBps, onboardingFee);
        if (result.success) {
            return res.status(200).json(result);
        }
        else {
            return res.status(400).json(result);
        }
    }
    catch (err) {
        console.error('❌ Error in initialize platform config controller:', err);
        return res.status(500).json({
            success: false,
            message: 'Failed to initialize platform config',
            error: err.message || err
        });
    }
});
exports.initializePlatformConfigController = initializePlatformConfigController;
/**
 * Controller to update platform configuration (super admin only)
 */
const updatePlatformConfigController = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { superAdminPublicKey, developerShareBps, platformShareBps } = req.body;
        // Validate required fields
        if (!superAdminPublicKey) {
            return res.status(400).json({
                success: false,
                message: 'Super admin public key is required'
            });
        }
        if (developerShareBps === undefined || platformShareBps === undefined) {
            return res.status(400).json({
                success: false,
                message: 'Both developer and platform share percentages are required'
            });
        }
        // Validate public key format
        let superAdminPubKey;
        try {
            superAdminPubKey = new web3_js_1.PublicKey(superAdminPublicKey);
        }
        catch (err) {
            return res.status(400).json({
                success: false,
                message: 'Invalid super admin public key format'
            });
        }
        // Validate share percentages
        const devBps = Number(developerShareBps);
        const platBps = Number(platformShareBps);
        if (isNaN(devBps) || isNaN(platBps)) {
            return res.status(400).json({
                success: false,
                message: 'Share percentages must be valid numbers'
            });
        }
        if (devBps + platBps !== 10000) {
            return res.status(400).json({
                success: false,
                message: `Share percentages must sum to 10000 (100%). Current total: ${devBps + platBps}`
            });
        }
        // Call the service
        const result = yield (0, services_1.updatePlatformConfigService)(superAdminPubKey, devBps, platBps);
        if (result.success) {
            return res.status(200).json(result);
        }
        else {
            return res.status(400).json(result);
        }
    }
    catch (err) {
        console.error('❌ Error in update platform config controller:', err);
        return res.status(500).json({
            success: false,
            message: 'Failed to update platform config',
            error: err.message || err
        });
    }
});
exports.updatePlatformConfigController = updatePlatformConfigController;
/**
 * Controller to update platform wallet (super admin only)
 */
const updatePlatformWalletController = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { superAdminPublicKey, newPlatformWalletPublicKey } = req.body;
        // Validate required fields
        if (!superAdminPublicKey) {
            return res.status(400).json({
                success: false,
                message: 'Super admin public key is required'
            });
        }
        if (!newPlatformWalletPublicKey) {
            return res.status(400).json({
                success: false,
                message: 'New platform wallet public key is required'
            });
        }
        // Validate public key formats
        let superAdminPubKey;
        let newPlatformWalletPubKey;
        try {
            superAdminPubKey = new web3_js_1.PublicKey(superAdminPublicKey);
            newPlatformWalletPubKey = new web3_js_1.PublicKey(newPlatformWalletPublicKey);
        }
        catch (err) {
            return res.status(400).json({
                success: false,
                message: 'Invalid public key format'
            });
        }
        // Call the service
        const result = yield (0, services_1.updatePlatformWalletService)(superAdminPubKey, newPlatformWalletPubKey);
        if (result.success) {
            return res.status(200).json(result);
        }
        else {
            return res.status(400).json(result);
        }
    }
    catch (err) {
        console.error('❌ Error in update platform wallet controller:', err);
        return res.status(500).json({
            success: false,
            message: 'Failed to update platform wallet',
            error: err.message || err
        });
    }
});
exports.updatePlatformWalletController = updatePlatformWalletController;
/**
 * Controller to transfer super admin role (super admin only)
 */
const transferSuperAdminController = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { superAdminPublicKey, newSuperAdminPublicKey } = req.body;
        // Validate required fields
        if (!superAdminPublicKey) {
            return res.status(400).json({
                success: false,
                message: 'Current super admin public key is required'
            });
        }
        if (!newSuperAdminPublicKey) {
            return res.status(400).json({
                success: false,
                message: 'New super admin public key is required'
            });
        }
        // Validate public key formats
        let superAdminPubKey;
        let newSuperAdminPubKey;
        try {
            superAdminPubKey = new web3_js_1.PublicKey(superAdminPublicKey);
            newSuperAdminPubKey = new web3_js_1.PublicKey(newSuperAdminPublicKey);
        }
        catch (err) {
            return res.status(400).json({
                success: false,
                message: 'Invalid public key format'
            });
        }
        // Call the service
        const result = yield (0, services_1.transferSuperAdminService)(superAdminPubKey, newSuperAdminPubKey);
        if (result.success) {
            return res.status(200).json(result);
        }
        else {
            return res.status(400).json(result);
        }
    }
    catch (err) {
        console.error('❌ Error in transfer super admin controller:', err);
        return res.status(500).json({
            success: false,
            message: 'Failed to transfer super admin',
            error: err.message || err
        });
    }
});
exports.transferSuperAdminController = transferSuperAdminController;
/**
 * Controller to get platform configuration
 */
const getPlatformConfigController = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Call the service
        const result = yield (0, services_1.getPlatformConfigService)();
        if (result.success) {
            return res.status(200).json(result);
        }
        else {
            return res.status(404).json(result);
        }
    }
    catch (err) {
        console.error('❌ Error in get platform config controller:', err);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch platform config',
            error: err.message || err
        });
    }
});
exports.getPlatformConfigController = getPlatformConfigController;
//# sourceMappingURL=adminDashboardController.js.map