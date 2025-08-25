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
exports.getDashboardStatsController = exports.getRevenuePoolStatsController = exports.getTournamentStatsController = exports.getDetailedStakersController = exports.getAPYController = exports.getActiveStakersController = exports.getStakingPoolController = exports.getStakingStatsController = exports.initializeRewardPoolController = exports.initializePrizePoolController = exports.initializeRevenuePoolController = exports.initializeStakingPoolController = exports.checkPoolStatusController = void 0;
const web3_js_1 = require("@solana/web3.js");
const services_1 = require("./services");
const stakingStatsService_1 = require("./stakingStatsService");
const dashboardStatsService_1 = require("./dashboardStatsService");
const database_1 = require("firebase/database");
const firebase_1 = require("../config/firebase");
const checkPoolStatusController = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { adminPublicKey } = req.params;
        // Validate the admin public key
        if (!adminPublicKey) {
            return res.status(400).json({
                success: false,
                error: 'Admin public key is required'
            });
        }
        // Validate public key format
        try {
            new web3_js_1.PublicKey(adminPublicKey);
        }
        catch (error) {
            return res.status(400).json({
                success: false,
                error: 'Invalid admin public key format'
            });
        }
        // Check staking pool status
        const result = yield (0, services_1.checkPoolStatus)(new web3_js_1.PublicKey(adminPublicKey));
        if (result.success) {
            return res.status(200).json({
                data: result
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
        const { mintPublicKey, adminPublicKey } = req.body; // Get mint address from request body
        // Validate the mint address
        if (!mintPublicKey || !adminPublicKey) {
            return res.status(400).json({ error: 'Mint public key is required' });
        }
        // Call the staking pool initialization service
        const result = yield (0, services_1.initializeStakingPoolService)(new web3_js_1.PublicKey(mintPublicKey), new web3_js_1.PublicKey(adminPublicKey));
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
 * Controller function for initializing the global revenue pool
 */
const initializeRevenuePoolController = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { mintPublicKey, adminPublicKey } = req.body;
        // Validate the mint address
        if (!mintPublicKey || !adminPublicKey) {
            return res.status(400).json({
                success: false,
                message: 'Mint and Admin public key is required'
            });
        }
        // Call the service function to initialize revenue pool
        const result = yield (0, services_1.initializeRevenuePoolService)(new web3_js_1.PublicKey(mintPublicKey), new web3_js_1.PublicKey(adminPublicKey));
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
exports.initializeRevenuePoolController = initializeRevenuePoolController;
/**
 * Controller function for initializing a prize pool for a specific tournament
 */
const initializePrizePoolController = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { tournamentId, mintPublicKey, adminPublicKey } = req.body;
        // Validate required fields
        if (!tournamentId) {
            return res.status(400).json({
                success: false,
                message: 'Tournament ID is required'
            });
        }
        if (!mintPublicKey || !adminPublicKey) {
            return res.status(400).json({
                success: false,
                message: 'Mint public key and Admin Public Key is required'
            });
        }
        // Convert string public key to PublicKey object
        const mintPubkey = new web3_js_1.PublicKey(mintPublicKey);
        const adminPubKey = new web3_js_1.PublicKey(adminPublicKey);
        // Call the service function to initialize prize pool for the tournament
        const result = yield (0, services_1.initializePrizePoolService)(tournamentId, mintPubkey, adminPubKey);
        if (result.success) {
            const tournamentRef = (0, database_1.ref)(firebase_1.db, `tournaments/${tournamentId}`);
            const tournamentSnapshot = yield (0, database_1.get)(tournamentRef);
            if (!tournamentSnapshot.exists()) {
                return res.status(404).json({
                    success: false,
                    message: 'Tournament not found'
                });
            }
            const tournament = tournamentSnapshot.val();
            tournament.prizePool = result.prizePool;
            // Save the updated tournament data back to Firebase
            yield (0, database_1.set)(tournamentRef, tournament);
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
/**
 * Controller function for initializing the global revenue pool
 */
const initializeRewardPoolController = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { mintPublicKey, adminPublicKey } = req.body;
        // Validate the mint address
        if (!mintPublicKey || !adminPublicKey) {
            return res.status(400).json({
                success: false,
                message: 'Mint and Admin public key is required'
            });
        }
        // Call the service function to initialize revenue pool
        const result = yield (0, services_1.initializeRewardPoolService)(new web3_js_1.PublicKey(mintPublicKey), new web3_js_1.PublicKey(adminPublicKey));
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
        console.log('📊 Fetching staking statistics...');
        // Validate the admin address
        if (!adminPublicKey) {
            return res.status(400).json({
                success: false,
                message: 'Admin public key is required'
            });
        }
        const result = yield (0, dashboardStatsService_1.getStakingStats)(new web3_js_1.PublicKey(adminPublicKey));
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
        const { adminPublicKey } = req.params;
        console.log('🏦 Fetching staking pool data...');
        const result = yield (0, stakingStatsService_1.getStakingPoolData)(new web3_js_1.PublicKey(adminPublicKey));
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
        const result = yield (0, stakingStatsService_1.getActiveStakers)();
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
        // Call the service to get tournament stats
        const result = yield (0, dashboardStatsService_1.getTournamentStats)();
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
        // Call the service function
        const result = yield (0, dashboardStatsService_1.getRevenuePoolStatsService)(new web3_js_1.PublicKey(adminPublicKey));
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
        // Validate the admin public key
        if (!adminPublicKey) {
            return res.status(400).json({
                success: false,
                message: 'Admin public key is required'
            });
        }
        // Call the service to get all stats
        const result = yield (0, dashboardStatsService_1.getDashboardData)(new web3_js_1.PublicKey(adminPublicKey));
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
//# sourceMappingURL=adminDashboardController.js.map