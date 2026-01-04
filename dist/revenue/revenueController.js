"use strict";
// src/revenue/revenueController.ts
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
exports.getPlatformRevenueByDeveloperController = exports.getPlatformRevenueHistoryController = exports.getPlatformRevenueController = exports.getDeveloperRevenueHistoryController = exports.getDeveloperRevenueController = exports.getAllDeveloperRevenueController = exports.confirmPrizeDistributionController = exports.confirmDistributionController = exports.getAdminDistributionTotalsController = exports.getAdminPrizesDistributedController = exports.getTournamentPrizesDistributionController = exports.distributeTournamentPrizesController = exports.getTournamentDistributionController = exports.distributeTournamentRevenueController = void 0;
const database_1 = require("firebase/database");
const firebase_1 = require("../config/firebase");
const web3_js_1 = require("@solana/web3.js");
const services_1 = require("./services");
const services_2 = require("../staking/services");
const getPDAs_1 = require("../utils/getPDAs");
const dashboardStatsService_1 = require("../adminDashboard/dashboardStatsService");
/**
 * Controller function to distribute tournament revenue according to the updated percentages
 */
const distributeTournamentRevenueController = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { tournamentId, prizePercentage, revenuePercentage, stakingPercentage, burnPercentage, adminPublicKey, tokenType } = req.body;
        // Validate tournament ID
        if (!tournamentId) {
            return res.status(400).json({
                success: false,
                message: 'Tournament ID is required'
            });
        }
        // Validate admin public key
        if (!adminPublicKey) {
            return res.status(400).json({
                success: false,
                message: 'Admin public key is required'
            });
        }
        let adminPubKey;
        try {
            adminPubKey = new web3_js_1.PublicKey(adminPublicKey);
        }
        catch (err) {
            return res.status(400).json({
                success: false,
                message: 'Invalid admin public key format'
            });
        }
        // Validate token type
        if (tokenType === undefined || tokenType === null) {
            return res.status(400).json({
                success: false,
                message: "Token type is required"
            });
        }
        const tt = Number(tokenType);
        if (tt !== getPDAs_1.TokenType.SPL && tt !== getPDAs_1.TokenType.SOL) {
            return res.status(400).json({
                success: false,
                message: 'tokenType must be 0 (SPL) or 1 (SOL)'
            });
        }
        // Validate custom percentages if provided
        const useCustomPercentages = prizePercentage !== undefined ||
            revenuePercentage !== undefined ||
            stakingPercentage !== undefined ||
            burnPercentage !== undefined;
        let finalPrizePercentage = services_1.DEFAULT_SPLITS.PRIZE_POOL;
        let finalRevenuePercentage = services_1.DEFAULT_SPLITS.REVENUE_POOL;
        let finalStakingPercentage = services_1.DEFAULT_SPLITS.STAKING_REWARD_POOL;
        let finalBurnPercentage = services_1.DEFAULT_SPLITS.BURN;
        if (useCustomPercentages) {
            // Ensure all percentages are provided if any are provided
            if (prizePercentage === undefined ||
                revenuePercentage === undefined ||
                stakingPercentage === undefined ||
                burnPercentage === undefined) {
                return res.status(400).json({
                    success: false,
                    message: "If custom percentages are provided, all percentages (prize, revenue, staking, and burn) must be specified"
                });
            }
            // Validate percentages add up to 100
            if (prizePercentage + revenuePercentage + stakingPercentage + burnPercentage !== 100) {
                return res.status(400).json({
                    success: false,
                    message: `Percentages must add up to 100%. Current total: ${prizePercentage + revenuePercentage + stakingPercentage + burnPercentage}%`
                });
            }
            // Validate individual percentages are within valid ranges
            if (prizePercentage < 0 || prizePercentage > 100 ||
                revenuePercentage < 0 || revenuePercentage > 100 ||
                stakingPercentage < 0 || stakingPercentage > 100 ||
                burnPercentage < 0 || burnPercentage > 100) {
                return res.status(400).json({
                    success: false,
                    message: "All percentages must be between 0 and 100"
                });
            }
            finalPrizePercentage = prizePercentage;
            finalRevenuePercentage = revenuePercentage;
            finalStakingPercentage = stakingPercentage;
            finalBurnPercentage = burnPercentage;
            console.log("✅ Using custom distribution percentages:");
        }
        else {
            console.log("✅ Using default distribution percentages:");
        }
        console.log(`   Prize: ${finalPrizePercentage}%`);
        console.log(`   Revenue: ${finalRevenuePercentage}%`);
        console.log(`   Staking: ${finalStakingPercentage}%`);
        console.log(`   Burn: ${finalBurnPercentage}%`);
        // Call the service function
        const result = yield (0, services_1.distributeTournamentRevenueService)(tournamentId, finalPrizePercentage, finalRevenuePercentage, finalStakingPercentage, finalBurnPercentage, adminPubKey, tt);
        // Return the result
        if (result.success) {
            return res.status(200).json(result);
        }
        else {
            return res.status(400).json(result);
        }
    }
    catch (err) {
        console.error('❌ Error in distribute tournament revenue controller:', err);
        return res.status(500).json({
            success: false,
            message: 'Failed to distribute tournament revenue',
            error: err.message || err
        });
    }
});
exports.distributeTournamentRevenueController = distributeTournamentRevenueController;
/**
 * Controller function to get tournament distribution details
 * Updated to include burn information
 */
const getTournamentDistributionController = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { tournamentId } = req.params;
        // Validate tournament ID
        if (!tournamentId) {
            return res.status(400).json({
                success: false,
                message: 'Tournament ID is required'
            });
        }
        // Get tournament data from Firebase
        const tournamentRef = (0, database_1.ref)(firebase_1.db, `tournaments/${tournamentId}`);
        const tournamentSnapshot = yield (0, database_1.get)(tournamentRef);
        if (!tournamentSnapshot.exists()) {
            return res.status(404).json({
                success: false,
                message: 'Tournament not found'
            });
        }
        const tournament = tournamentSnapshot.val();
        // Check if distribution has been completed
        if (!tournament.distributionCompleted) {
            return res.status(404).json({
                success: false,
                message: 'Tournament revenue has not been distributed yet'
            });
        }
        // Check both 'distribution' and 'distributionDetails' for backward compatibility
        const distDetails = tournament.distribution || tournament.distributionDetails || {};
        // Format and return distribution details including burn information
        return res.status(200).json({
            success: true,
            tournamentId,
            tournamentName: tournament.name,
            distributionDetails: {
                completedAt: new Date(tournament.distributionTimestamp).toISOString(),
                totalDistributed: distDetails.totalDistributed || (distDetails.prizeAmount + distDetails.revenueAmount + distDetails.stakingAmount + distDetails.burnAmount) || 0,
                prizeAmount: distDetails.prizeAmount || 0,
                revenueAmount: distDetails.revenueAmount || 0,
                stakingAmount: distDetails.stakingAmount || 0,
                burnAmount: distDetails.burnAmount || 0,
                transactionSignature: tournament.distributionTransaction || distDetails.transactionSignature || '',
            }
        });
    }
    catch (err) {
        console.error('Error in get tournament distribution controller:', err);
        return res.status(500).json({
            success: false,
            message: 'Failed to get tournament distribution details',
            error: err.message || err
        });
    }
});
exports.getTournamentDistributionController = getTournamentDistributionController;
/**
 * Controller function to distribute prizes to tournament winners
 */
const distributeTournamentPrizesController = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { tournamentId, firstPlacePublicKey, secondPlacePublicKey, thirdPlacePublicKey, adminPublicKey, tokenType } = req.body;
        // Validate tournament ID
        if (!tournamentId) {
            return res.status(400).json({
                success: false,
                message: 'Tournament ID is required'
            });
        }
        // Validate winner public keys
        if (!firstPlacePublicKey || !secondPlacePublicKey || !thirdPlacePublicKey || !adminPublicKey) {
            return res.status(400).json({
                success: false,
                message: 'Public keys for all three winners are required'
            });
        }
        if (tokenType === undefined || tokenType === null) {
            return res.status(400).json({
                success: false,
                message: "Token type is required"
            });
        }
        const tt = Number(tokenType);
        if (tt !== getPDAs_1.TokenType.SPL && tt !== getPDAs_1.TokenType.SOL) {
            return res.status(400).json({ success: false, message: 'tokenType must be 0 (SPL) or 1 (SOL)' });
        }
        // Verify tournament exists
        const tournamentRef = (0, database_1.ref)(firebase_1.db, `tournaments/${tt}/${tournamentId}`);
        const tournamentSnapshot = yield (0, database_1.get)(tournamentRef);
        if (!tournamentSnapshot.exists()) {
            return res.status(404).json({
                success: false,
                message: 'Tournament not found'
            });
        }
        // Verify tournament has ended
        const tournament = tournamentSnapshot.val();
        if (tournament.status !== 'Ended' && tournament.status !== 'Distributed') {
            return res.status(400).json({
                success: false,
                message: 'Cannot distribute prizes for an active tournament'
            });
        }
        // Verify tournament revenue has been distributed
        if (!tournament.distributionCompleted) {
            return res.status(400).json({
                success: false,
                message: 'Tournament revenue must be distributed before prizes can be distributed'
            });
        }
        // Convert string public keys to PublicKey objects
        const firstPlacePubkey = new web3_js_1.PublicKey(firstPlacePublicKey);
        const secondPlacePubkey = new web3_js_1.PublicKey(secondPlacePublicKey);
        const thirdPlacePubkey = new web3_js_1.PublicKey(thirdPlacePublicKey);
        const adminPubKey = new web3_js_1.PublicKey(adminPublicKey);
        // Call the service function to distribute prizes
        const result = yield (0, services_1.distributeTournamentPrizesService)(tournamentId, firstPlacePubkey, secondPlacePubkey, thirdPlacePubkey, adminPubKey, tt);
        // Return the result
        if (result.success) {
            return res.status(200).json(result);
        }
        else {
            return res.status(400).json(result);
        }
    }
    catch (err) {
        console.error('Error in distribute tournament prizes controller:', err);
        return res.status(500).json({
            success: false,
            message: 'Failed to distribute tournament prizes',
            error: err.message || err
        });
    }
});
exports.distributeTournamentPrizesController = distributeTournamentPrizesController;
/**
 * Controller function to get tournament prizes distribution details
 */
const getTournamentPrizesDistributionController = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { tournamentId } = req.params;
        const { tokenType } = req.query;
        // Validate tournament ID
        if (!tournamentId) {
            return res.status(400).json({
                success: false,
                message: 'Tournament ID is required'
            });
        }
        if (tokenType === undefined || tokenType === null) {
            return res.status(400).json({
                success: false,
                message: 'Token type is required'
            });
        }
        const tt = Number(tokenType);
        if (tt !== getPDAs_1.TokenType.SPL && tt !== getPDAs_1.TokenType.SOL) {
            return res.status(400).json({
                success: false,
                message: 'tokenType must be 0 (SPL) or 1 (SOL)'
            });
        }
        // Get tournament data from Firebase
        const tournamentRef = (0, database_1.ref)(firebase_1.db, `tournaments/${tt}/${tournamentId}`);
        const tournamentSnapshot = yield (0, database_1.get)(tournamentRef);
        if (!tournamentSnapshot.exists()) {
            return res.status(404).json({
                success: false,
                message: 'Tournament not found'
            });
        }
        const tournament = tournamentSnapshot.val();
        // Check if prizes have been distributed
        if (!tournament.prizesDistributed) {
            return res.status(404).json({
                success: false,
                message: 'Tournament prizes have not been distributed yet'
            });
        }
        // Format and return distribution details
        return res.status(200).json({
            success: true,
            tournamentId,
            tournamentName: tournament.name,
            prizesDistribution: {
                completedAt: new Date(tournament.prizesDistributionTimestamp).toISOString(),
                firstPlace: tournament.prizesDistributionDetails.firstPlace,
                secondPlace: tournament.prizesDistributionDetails.secondPlace,
                thirdPlace: tournament.prizesDistributionDetails.thirdPlace,
                transactionSignature: tournament.prizesDistributionDetails.transactionSignature,
            }
        });
    }
    catch (err) {
        console.error('Error in get tournament prizes distribution controller:', err);
        return res.status(500).json({
            success: false,
            message: 'Failed to get tournament prizes distribution details',
            error: err.message || err
        });
    }
});
exports.getTournamentPrizesDistributionController = getTournamentPrizesDistributionController;
/**
 * Controller: Get total prizes distributed by an admin across all tournaments
 */
const getAdminPrizesDistributedController = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d;
    try {
        const { adminPubKey } = req.params;
        if (!adminPubKey) {
            return res.status(400).json({ success: false, message: 'adminPubKey is required' });
        }
        // Fetch all tournaments
        const tournamentsRef = (0, database_1.ref)(firebase_1.db, 'tournaments');
        const tournamentsSnapshot = yield (0, database_1.get)(tournamentsRef);
        if (!tournamentsSnapshot.exists()) {
            return res.status(200).json({
                success: true,
                data: { totalPrizeRaw: '0', totalPrize: 0, tokenDecimals: 9, tournamentCount: 0 }
            });
        }
        const tournaments = tournamentsSnapshot.val();
        // Filter tournaments created by admin with prizesDistributed = true
        const adminTournaments = Object.values(tournaments).filter((t) => t.createdBy === adminPubKey && t.prizesDistributed === true);
        // Sum prize amounts. Prefer winners amounts; fallback to prizesDistributionDetails.prizeAmount
        let totalPrize = BigInt(0);
        for (const t of adminTournaments) {
            if (t === null || t === void 0 ? void 0 : t.winners) {
                const a1 = BigInt(((_a = t.winners.firstPlace) === null || _a === void 0 ? void 0 : _a.amount) || 0);
                const a2 = BigInt(((_b = t.winners.secondPlace) === null || _b === void 0 ? void 0 : _b.amount) || 0);
                const a3 = BigInt(((_c = t.winners.thirdPlace) === null || _c === void 0 ? void 0 : _c.amount) || 0);
                totalPrize += a1 + a2 + a3;
            }
            else if (((_d = t === null || t === void 0 ? void 0 : t.prizesDistributionDetails) === null || _d === void 0 ? void 0 : _d.prizeAmount) != null) {
                totalPrize += BigInt(t.prizesDistributionDetails.prizeAmount || 0);
            }
        }
        const tokenDecimals = 9;
        const totalPrizeRaw = totalPrize.toString();
        const totalPrizeReadable = Number(totalPrizeRaw) / Math.pow(10, tokenDecimals);
        return res.status(200).json({
            success: true,
            data: {
                totalPrizeRaw,
                totalPrize: totalPrizeReadable,
                tokenDecimals,
                tournamentCount: adminTournaments.length,
            }
        });
    }
    catch (err) {
        console.error('Error in getAdminPrizesDistributedController:', err);
        return res.status(500).json({ success: false, message: 'Failed to aggregate prizes distributed', error: err.message });
    }
});
exports.getAdminPrizesDistributedController = getAdminPrizesDistributedController;
/**
 * Controller: Get aggregated distribution totals (prize, revenue, staking, burn)
 * across all tournaments created by an admin.
 */
const getAdminDistributionTotalsController = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { adminPubKey } = req.params;
        const { tokenType } = req.query;
        if (!adminPubKey || (tokenType === undefined || tokenType === null)) {
            return res.status(400).json({ success: false, message: 'adminPubKey and tokenType are required' });
        }
        const tt = Number(tokenType);
        if (tt !== getPDAs_1.TokenType.SPL && tt !== getPDAs_1.TokenType.SOL) {
            return res.status(400).json({ success: false, message: 'tokenType must be 0 (SPL) or 1 (SOL)' });
        }
        // Fetch all tournaments
        const tournamentsRef = (0, database_1.ref)(firebase_1.db, `tournaments/${tt}`);
        const tournamentsSnapshot = yield (0, database_1.get)(tournamentsRef);
        // Fetch revenue pool information (even if no tournaments exist)
        const revenuePoolStats = yield (0, dashboardStatsService_1.getRevenuePoolStatsService)(new web3_js_1.PublicKey(adminPubKey), tt);
        if (!tournamentsSnapshot.exists()) {
            return res.status(200).json({
                success: true,
                data: {
                    prizeAmountRaw: '0', revenueAmountRaw: '0', stakingAmountRaw: '0', burnAmountRaw: '0',
                    prizeAmount: 0, revenueAmount: 0, stakingAmount: 0, burnAmount: 0,
                    tokenDecimals: 9, tournamentCount: 0,
                    revenue: revenuePoolStats, // Include revenue pool information
                }
            });
        }
        const tournaments = tournamentsSnapshot.val();
        const adminTournaments = Object.values(tournaments).filter((t) => t.createdBy === adminPubKey && t.distributionCompleted === true);
        // Aggregate using BigInt
        let prize = BigInt(0);
        let revenue = BigInt(0);
        let staking = BigInt(0);
        let burn = BigInt(0);
        for (const t of adminTournaments) {
            // Check both 'distribution' and 'distributionDetails' for backward compatibility
            const d = (t === null || t === void 0 ? void 0 : t.distribution) || (t === null || t === void 0 ? void 0 : t.distributionDetails) || {};
            prize += BigInt(d.prizeAmount || 0);
            revenue += BigInt(d.revenueAmount || 0);
            staking += BigInt(d.stakingAmount || 0);
            burn += BigInt(d.burnAmount || 0);
        }
        const tokenDecimals = 9;
        const prizeAmountRaw = prize.toString();
        const revenueAmountRaw = revenue.toString();
        const stakingAmountRaw = staking.toString();
        const burnAmountRaw = burn.toString();
        const divisor = Math.pow(10, tokenDecimals);
        return res.status(200).json({
            success: true,
            data: {
                prizeAmount: Number(prizeAmountRaw) / divisor,
                revenueAmount: Number(revenueAmountRaw) / divisor,
                stakingAmount: Number(stakingAmountRaw) / divisor,
                burnAmount: Number(burnAmountRaw) / divisor,
                tournamentCount: adminTournaments.length,
                revenue: revenuePoolStats, // Include revenue pool information
            }
        });
    }
    catch (err) {
        console.error('Error in getAdminDistributionTotalsController:', err);
        return res.status(500).json({ success: false, message: 'Failed to aggregate distribution totals', error: err.message });
    }
});
exports.getAdminDistributionTotalsController = getAdminDistributionTotalsController;
/**
 * Controller function to confirm tournament revenue distribution after frontend signs transaction
 */
const confirmDistributionController = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { tournamentId, transactionSignature, distribution, tokenType } = req.body;
        // Validate required fields
        if (!tournamentId || !transactionSignature) {
            return res.status(400).json({
                success: false,
                message: 'Tournament ID and transaction signature are required'
            });
        }
        if (tokenType === undefined || tokenType === null) {
            return res.status(400).json({
                success: false,
                message: 'Token type is required'
            });
        }
        const tt = Number(tokenType);
        if (tt !== getPDAs_1.TokenType.SPL && tt !== getPDAs_1.TokenType.SOL) {
            return res.status(400).json({
                success: false,
                message: 'tokenType must be 0 (SPL) or 1 (SOL)'
            });
        }
        // Verify transaction exists on blockchain (optional but recommended)
        const { connection } = (0, services_2.getProgram)();
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
            console.warn('Could not verify transaction on blockchain:', err);
            // Continue anyway - transaction might be too recent
        }
        // Update tournament status in Firebase
        console.log("Updating tournament status in Firebase...");
        const tournamentRef = (0, database_1.ref)(firebase_1.db, `tournaments/${tt}/${tournamentId}`);
        // Check if tournament exists
        const tournamentSnapshot = yield (0, database_1.get)(tournamentRef);
        if (!tournamentSnapshot.exists()) {
            return res.status(404).json({
                success: false,
                message: 'Tournament not found'
            });
        }
        const tournament = tournamentSnapshot.val();
        // Prevent double distribution
        if (tournament.distributionCompleted) {
            return res.status(400).json({
                success: false,
                message: 'Tournament revenue has already been distributed'
            });
        }
        // Get developer wallet (adminPublicKey) from tournament
        const adminPublicKey = tournament.createdBy;
        if (!adminPublicKey) {
            return res.status(400).json({
                success: false,
                message: 'Tournament creator (adminPublicKey) not found'
            });
        }
        // Extract distribution details
        const distributionDetails = distribution || {};
        const developerShare = distributionDetails.developerShare || 0;
        const platformShare = distributionDetails.platformShare || 0;
        const revenueAmount = distributionDetails.revenueAmount || (developerShare + platformShare);
        const prizeAmount = distributionDetails.prizeAmount || 0;
        const stakingAmount = distributionDetails.stakingAmount || 0;
        const burnAmount = distributionDetails.burnAmount || 0;
        const totalFunds = distributionDetails.totalFunds || 0;
        // Calculate share percentages dynamically
        const developerSharePercent = revenueAmount > 0
            ? Math.round((developerShare / revenueAmount) * 100)
            : 90; // Default to 90% if revenueAmount is 0
        const platformSharePercent = revenueAmount > 0
            ? Math.round((platformShare / revenueAmount) * 100)
            : 10; // Default to 10% if revenueAmount is 0
        // Convert token type to string key
        const tokenKey = tt === getPDAs_1.TokenType.SOL ? "SOL" : "SPL";
        const currentTimestamp = Date.now();
        // Track DEVELOPER revenue in Firebase (non-blocking - transaction already succeeded on-chain)
        console.log("📊 Tracking developer revenue in Firebase...");
        try {
            const developerRef = (0, database_1.ref)(firebase_1.db, `developerRevenue/${adminPublicKey}`);
            const developerSnapshot = yield (0, database_1.get)(developerRef);
            const developerHistoryEntry = {
                tournamentId,
                tournamentName: tournament.name || tournament.tournamentName || tournamentId,
                gameId: tournament.gameId || tournament.game || "",
                amount: developerShare, // Amount in base units
                tokenType: tokenKey,
                sharePercent: developerSharePercent,
                timestamp: currentTimestamp,
                txSignature: transactionSignature
            };
            if (developerSnapshot.exists()) {
                const data = developerSnapshot.val();
                const existingHistory = data.history || [];
                const currentTotalEarned = data.totalEarned || { SOL: 0, SPL: 0 };
                yield (0, database_1.update)(developerRef, {
                    walletAddress: adminPublicKey,
                    totalEarned: Object.assign(Object.assign({}, currentTotalEarned), { [tokenKey]: (currentTotalEarned[tokenKey] || 0) + developerShare }),
                    tournamentsCount: (data.tournamentsCount || 0) + 1,
                    lastDistribution: currentTimestamp,
                    history: [...existingHistory, developerHistoryEntry]
                });
                console.log(`✅ Updated developer revenue for ${adminPublicKey}`);
            }
            else {
                yield (0, database_1.set)(developerRef, {
                    walletAddress: adminPublicKey,
                    totalEarned: {
                        SOL: tokenKey === "SOL" ? developerShare : 0,
                        SPL: tokenKey === "SPL" ? developerShare : 0
                    },
                    tournamentsCount: 1,
                    lastDistribution: currentTimestamp,
                    history: [developerHistoryEntry]
                });
                console.log(`✅ Created developer revenue record for ${adminPublicKey}`);
            }
        }
        catch (firebaseError) {
            console.warn(`⚠️ Failed to track developer revenue in Firebase (transaction succeeded on-chain):`, firebaseError.message);
            // Continue - transaction already succeeded on-chain, Firebase tracking is secondary
        }
        // Track PLATFORM revenue in Firebase (non-blocking - transaction already succeeded on-chain)
        console.log("📊 Tracking platform revenue in Firebase...");
        try {
            const platformRef = (0, database_1.ref)(firebase_1.db, `platformRevenue`);
            const platformSnapshot = yield (0, database_1.get)(platformRef);
            const platformHistoryEntry = {
                tournamentId,
                developerWallet: adminPublicKey,
                amount: platformShare, // Amount in base units
                tokenType: tokenKey,
                sharePercent: platformSharePercent,
                timestamp: currentTimestamp,
                txSignature: transactionSignature
            };
            if (platformSnapshot.exists()) {
                const data = platformSnapshot.val();
                const existingHistory = data.history || [];
                const currentTotalEarned = data.totalEarned || { SOL: 0, SPL: 0 };
                yield (0, database_1.update)(platformRef, {
                    totalEarned: Object.assign(Object.assign({}, currentTotalEarned), { [tokenKey]: (currentTotalEarned[tokenKey] || 0) + platformShare }),
                    tournamentsCount: (data.tournamentsCount || 0) + 1,
                    lastDistribution: currentTimestamp,
                    history: [...existingHistory, platformHistoryEntry]
                });
                console.log(`✅ Updated platform revenue`);
            }
            else {
                yield (0, database_1.set)(platformRef, {
                    totalEarned: {
                        SOL: tokenKey === "SOL" ? platformShare : 0,
                        SPL: tokenKey === "SPL" ? platformShare : 0
                    },
                    tournamentsCount: 1,
                    lastDistribution: currentTimestamp,
                    history: [platformHistoryEntry]
                });
                console.log(`✅ Created platform revenue record`);
            }
        }
        catch (firebaseError) {
            console.warn(`⚠️ Failed to track platform revenue in Firebase (transaction succeeded on-chain):`, firebaseError.message);
            // Continue - transaction already succeeded on-chain, Firebase tracking is secondary
        }
        // Update tournament with distribution info (non-blocking - transaction already succeeded on-chain)
        try {
            yield (0, database_1.update)(tournamentRef, {
                status: 'Distributed',
                distributionCompleted: true,
                distributionTimestamp: currentTimestamp,
                distributionTransaction: transactionSignature,
                distributionDetails: {
                    prizeAmount,
                    developerShare,
                    platformShare,
                    stakingAmount,
                    burnAmount,
                    totalFunds,
                    totalDistributed: prizeAmount + developerShare + platformShare + stakingAmount + burnAmount,
                    transactionSignature: transactionSignature
                }
            });
            console.log(`✅ Tournament ${tournamentId} distribution confirmed and revenue tracked`);
        }
        catch (firebaseError) {
            console.warn(`⚠️ Failed to update tournament status in Firebase (transaction succeeded on-chain):`, firebaseError.message);
            // Continue - transaction already succeeded on-chain, Firebase update is secondary
        }
        return res.status(200).json({
            success: true,
            message: 'Tournament revenue distribution confirmed successfully',
            tournamentId,
            transactionSignature,
            distribution
        });
    }
    catch (err) {
        console.error('Error confirming distribution:', err);
        return res.status(500).json({
            success: false,
            message: 'Failed to confirm distribution',
            error: err.message || err
        });
    }
});
exports.confirmDistributionController = confirmDistributionController;
/**
 * Controller function to confirm tournament prize distribution after frontend signs transaction
 */
const confirmPrizeDistributionController = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e, _f;
    try {
        const { tournamentId, transactionSignature, winnerData, tokenType } = req.body;
        // Validate required fields
        if (!tournamentId || !transactionSignature) {
            return res.status(400).json({
                success: false,
                message: 'Tournament ID and transaction signature are required'
            });
        }
        if (tokenType === undefined || tokenType === null) {
            return res.status(400).json({
                success: false,
                message: 'Token type is required'
            });
        }
        const tt = Number(tokenType);
        if (tt !== getPDAs_1.TokenType.SPL && tt !== getPDAs_1.TokenType.SOL) {
            return res.status(400).json({
                success: false,
                message: 'tokenType must be 0 (SPL) or 1 (SOL)'
            });
        }
        // Verify transaction exists on blockchain (optional but recommended)
        const { connection } = (0, services_2.getProgram)();
        try {
            const txInfo = yield connection.getTransaction(transactionSignature);
            if (!txInfo) {
                return res.status(400).json({
                    success: false,
                    message: 'Transaction not found on blockchain'
                });
            }
        }
        catch (err) {
            console.warn('Could not verify transaction on blockchain:', err);
            // Continue anyway - transaction might be too recent
        }
        // Update tournament status in Firebase
        console.log("Updating tournament prize distribution status in Firebase...");
        const tournamentRef = (0, database_1.ref)(firebase_1.db, `tournaments/${tt}/${tournamentId}`);
        // Check if tournament exists
        const tournamentSnapshot = yield (0, database_1.get)(tournamentRef);
        if (!tournamentSnapshot.exists()) {
            return res.status(404).json({
                success: false,
                message: 'Tournament not found'
            });
        }
        const tournament = tournamentSnapshot.val();
        // Check if prizes have already been distributed
        if (tournament.prizesDistributed) {
            return res.status(400).json({
                success: false,
                message: 'Tournament prizes have already been distributed'
            });
        }
        // Verify tournament revenue has been distributed first
        if (!tournament.distributionCompleted) {
            return res.status(400).json({
                success: false,
                message: 'Tournament revenue must be distributed before confirming prize distribution'
            });
        }
        // Update tournament with prize distribution details
        yield (0, database_1.update)(tournamentRef, {
            status: "Awarded",
            prizesDistributed: true,
            prizeDistributionTimestamp: Date.now(),
            prizeDistributionSignature: transactionSignature,
            winners: winnerData ? {
                firstPlace: {
                    publicKey: (_a = winnerData.firstPlace) === null || _a === void 0 ? void 0 : _a.publicKey,
                    amount: (_b = winnerData.firstPlace) === null || _b === void 0 ? void 0 : _b.amount
                },
                secondPlace: {
                    publicKey: (_c = winnerData.secondPlace) === null || _c === void 0 ? void 0 : _c.publicKey,
                    amount: (_d = winnerData.secondPlace) === null || _d === void 0 ? void 0 : _d.amount
                },
                thirdPlace: {
                    publicKey: (_e = winnerData.thirdPlace) === null || _e === void 0 ? void 0 : _e.publicKey,
                    amount: (_f = winnerData.thirdPlace) === null || _f === void 0 ? void 0 : _f.amount
                }
            } : undefined
        });
        return res.status(200).json({
            success: true,
            message: 'Tournament prize distribution confirmed successfully',
            tournamentId,
            transactionSignature,
            winnerData,
            distributedAt: new Date().toISOString()
        });
    }
    catch (err) {
        console.error('Error in confirm prize distribution controller:', err);
        return res.status(500).json({
            success: false,
            message: 'Failed to confirm tournament prize distribution',
            error: err.message || err
        });
    }
});
exports.confirmPrizeDistributionController = confirmPrizeDistributionController;
/**
 * Get aggregated developer revenue across all developers (admin only)
 * GET /api/revenue/developer/all
 */
const getAllDeveloperRevenueController = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const developerRevenueRef = (0, database_1.ref)(firebase_1.db, `developerRevenue`);
        const developerRevenueSnapshot = yield (0, database_1.get)(developerRevenueRef);
        if (!developerRevenueSnapshot.exists()) {
            return res.status(200).json({
                success: true,
                data: {
                    totalEarned: { SOL: 0, SPL: 0 },
                    tournamentsCount: 0,
                    lastDistribution: null,
                    history: []
                }
            });
        }
        const allDeveloperData = developerRevenueSnapshot.val();
        let totalSOL = 0;
        let totalSPL = 0;
        let totalTournamentsCount = 0;
        let lastDistribution = null;
        const allHistory = [];
        Object.values(allDeveloperData).forEach((developerData) => {
            if (developerData && developerData.totalEarned) {
                totalSOL += developerData.totalEarned.SOL || 0;
                totalSPL += developerData.totalEarned.SPL || 0;
                totalTournamentsCount += developerData.tournamentsCount || 0;
                if (developerData.lastDistribution) {
                    if (!lastDistribution || developerData.lastDistribution > lastDistribution) {
                        lastDistribution = developerData.lastDistribution;
                    }
                }
                if (developerData.history && Array.isArray(developerData.history)) {
                    allHistory.push(...developerData.history);
                }
            }
        });
        allHistory.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        const tokenDecimals = 9;
        const totalEarnedSOL = totalSOL / (Math.pow(10, tokenDecimals));
        const totalEarnedSPL = totalSPL / (Math.pow(10, tokenDecimals));
        return res.status(200).json({
            success: true,
            data: {
                totalEarned: {
                    SOL: totalEarnedSOL,
                    SPL: totalEarnedSPL
                },
                tournamentsCount: totalTournamentsCount,
                lastDistribution: lastDistribution,
                history: allHistory
            }
        });
    }
    catch (err) {
        console.error('Error fetching all developer revenue:', err);
        if (err.message && err.message.includes('Permission denied')) {
            return res.status(200).json({
                success: true,
                data: {
                    totalEarned: { SOL: 0, SPL: 0 },
                    tournamentsCount: 0,
                    lastDistribution: null,
                    history: []
                }
            });
        }
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch all developer revenue',
            error: err.message || err
        });
    }
});
exports.getAllDeveloperRevenueController = getAllDeveloperRevenueController;
/**
 * Get developer revenue statistics
 * GET /api/revenue/developer/:developerPublicKey
 */
const getDeveloperRevenueController = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const { developerPublicKey } = req.params;
    if (!developerPublicKey) {
        return res.status(400).json({
            success: false,
            message: 'Developer public key is required'
        });
    }
    try {
        const developerRef = (0, database_1.ref)(firebase_1.db, `developerRevenue/${developerPublicKey}`);
        const developerSnapshot = yield (0, database_1.get)(developerRef);
        if (!developerSnapshot.exists()) {
            return res.status(200).json({
                success: true,
                data: {
                    walletAddress: developerPublicKey,
                    totalEarned: { SOL: 0, SPL: 0 },
                    tournamentsCount: 0,
                    lastDistribution: null,
                    history: []
                }
            });
        }
        const developerData = developerSnapshot.val();
        // Convert amounts from base units to readable format
        const tokenDecimals = 9;
        const totalEarnedSOL = (((_a = developerData.totalEarned) === null || _a === void 0 ? void 0 : _a.SOL) || 0) / (Math.pow(10, tokenDecimals));
        const totalEarnedSPL = (((_b = developerData.totalEarned) === null || _b === void 0 ? void 0 : _b.SPL) || 0) / (Math.pow(10, tokenDecimals));
        return res.status(200).json({
            success: true,
            data: {
                walletAddress: developerData.walletAddress || developerPublicKey,
                totalEarned: {
                    SOL: totalEarnedSOL,
                    SPL: totalEarnedSPL
                },
                tournamentsCount: developerData.tournamentsCount || 0,
                lastDistribution: developerData.lastDistribution || null,
                history: developerData.history || []
            }
        });
    }
    catch (err) {
        console.error('Error fetching developer revenue:', err);
        // Handle Firebase permission errors gracefully - return empty data instead of error
        if (err.message && err.message.includes('Permission denied')) {
            return res.status(200).json({
                success: true,
                data: {
                    walletAddress: developerPublicKey,
                    totalEarned: { SOL: 0, SPL: 0 },
                    tournamentsCount: 0,
                    lastDistribution: null,
                    history: []
                }
            });
        }
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch developer revenue',
            error: err.message || err
        });
    }
});
exports.getDeveloperRevenueController = getDeveloperRevenueController;
/**
 * Get developer revenue history (paginated)
 * GET /api/revenue/developer/:developerPublicKey/history
 */
const getDeveloperRevenueHistoryController = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { developerPublicKey } = req.params;
        const { page = 1, limit: limitParam = 20, tokenType } = req.query;
        if (!developerPublicKey) {
            return res.status(400).json({
                success: false,
                message: 'Developer public key is required'
            });
        }
        const developerRef = (0, database_1.ref)(firebase_1.db, `developerRevenue/${developerPublicKey}`);
        const developerSnapshot = yield (0, database_1.get)(developerRef);
        if (!developerSnapshot.exists()) {
            return res.status(200).json({
                success: true,
                data: {
                    history: [],
                    total: 0,
                    page: Number(page),
                    limit: Number(limitParam)
                }
            });
        }
        const developerData = developerSnapshot.val();
        let history = developerData.history || [];
        // Filter by token type if provided
        if (tokenType) {
            history = history.filter((entry) => entry.tokenType === tokenType);
        }
        // Sort by timestamp descending (newest first)
        history.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        // Paginate
        const pageNum = Number(page);
        const limitNum = Number(limitParam);
        const startIndex = (pageNum - 1) * limitNum;
        const endIndex = startIndex + limitNum;
        const paginatedHistory = history.slice(startIndex, endIndex);
        // Convert amounts from base units to readable format
        const tokenDecimals = 9;
        const formattedHistory = paginatedHistory.map((entry) => (Object.assign(Object.assign({}, entry), { amount: entry.amount / (Math.pow(10, tokenDecimals)) })));
        return res.status(200).json({
            success: true,
            data: {
                history: formattedHistory,
                total: history.length,
                page: pageNum,
                limit: limitNum,
                totalPages: Math.ceil(history.length / limitNum)
            }
        });
    }
    catch (err) {
        console.error('Error fetching developer revenue history:', err);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch developer revenue history',
            error: err.message || err
        });
    }
});
exports.getDeveloperRevenueHistoryController = getDeveloperRevenueHistoryController;
/**
 * Get platform revenue statistics (admin only)
 * GET /api/revenue/platform
 */
const getPlatformRevenueController = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    try {
        const platformRef = (0, database_1.ref)(firebase_1.db, `platformRevenue`);
        const platformSnapshot = yield (0, database_1.get)(platformRef);
        if (!platformSnapshot.exists()) {
            return res.status(200).json({
                success: true,
                data: {
                    totalEarned: { SOL: 0, SPL: 0 },
                    tournamentsCount: 0,
                    lastDistribution: null,
                    history: []
                }
            });
        }
        const platformData = platformSnapshot.val();
        // Convert amounts from base units to readable format
        const tokenDecimals = 9;
        const totalEarnedSOL = (((_a = platformData.totalEarned) === null || _a === void 0 ? void 0 : _a.SOL) || 0) / (Math.pow(10, tokenDecimals));
        const totalEarnedSPL = (((_b = platformData.totalEarned) === null || _b === void 0 ? void 0 : _b.SPL) || 0) / (Math.pow(10, tokenDecimals));
        return res.status(200).json({
            success: true,
            data: {
                totalEarned: {
                    SOL: totalEarnedSOL,
                    SPL: totalEarnedSPL
                },
                tournamentsCount: platformData.tournamentsCount || 0,
                lastDistribution: platformData.lastDistribution || null,
                history: platformData.history || []
            }
        });
    }
    catch (err) {
        console.error('Error fetching platform revenue:', err);
        // Handle Firebase permission errors gracefully - return empty data instead of error
        if (err.message && err.message.includes('Permission denied')) {
            return res.status(200).json({
                success: true,
                data: {
                    totalEarned: { SOL: 0, SPL: 0 },
                    tournamentsCount: 0,
                    lastDistribution: null,
                    history: []
                }
            });
        }
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch platform revenue',
            error: err.message || err
        });
    }
});
exports.getPlatformRevenueController = getPlatformRevenueController;
/**
 * Get platform revenue history (paginated, admin only)
 * GET /api/revenue/platform/history
 */
const getPlatformRevenueHistoryController = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { page = 1, limit: limitParam = 20, tokenType } = req.query;
        const platformRef = (0, database_1.ref)(firebase_1.db, `platformRevenue`);
        const platformSnapshot = yield (0, database_1.get)(platformRef);
        if (!platformSnapshot.exists()) {
            return res.status(200).json({
                success: true,
                data: {
                    history: [],
                    total: 0,
                    page: Number(page),
                    limit: Number(limitParam)
                }
            });
        }
        const platformData = platformSnapshot.val();
        let history = platformData.history || [];
        // Filter by token type if provided
        if (tokenType) {
            history = history.filter((entry) => entry.tokenType === tokenType);
        }
        // Sort by timestamp descending (newest first)
        history.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        // Paginate
        const pageNum = Number(page);
        const limitNum = Number(limitParam);
        const startIndex = (pageNum - 1) * limitNum;
        const endIndex = startIndex + limitNum;
        const paginatedHistory = history.slice(startIndex, endIndex);
        // Convert amounts from base units to readable format
        const tokenDecimals = 9;
        const formattedHistory = paginatedHistory.map((entry) => (Object.assign(Object.assign({}, entry), { amount: entry.amount / (Math.pow(10, tokenDecimals)) })));
        return res.status(200).json({
            success: true,
            data: {
                history: formattedHistory,
                total: history.length,
                page: pageNum,
                limit: limitNum,
                totalPages: Math.ceil(history.length / limitNum)
            }
        });
    }
    catch (err) {
        console.error('Error fetching platform revenue history:', err);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch platform revenue history',
            error: err.message || err
        });
    }
});
exports.getPlatformRevenueHistoryController = getPlatformRevenueHistoryController;
/**
 * Get platform revenue grouped by developer (admin only)
 * GET /api/revenue/platform/by-developer
 */
const getPlatformRevenueByDeveloperController = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const platformRef = (0, database_1.ref)(firebase_1.db, `platformRevenue`);
        const platformSnapshot = yield (0, database_1.get)(platformRef);
        if (!platformSnapshot.exists()) {
            return res.status(200).json({
                success: true,
                data: []
            });
        }
        const platformData = platformSnapshot.val();
        const history = platformData.history || [];
        // Group by developer wallet
        const byDeveloper = {};
        history.forEach((entry) => {
            const devWallet = entry.developerWallet;
            if (!devWallet)
                return;
            if (!byDeveloper[devWallet]) {
                byDeveloper[devWallet] = {
                    developerWallet: devWallet,
                    totalSOL: 0,
                    totalSPL: 0,
                    count: 0
                };
            }
            if (entry.tokenType === 'SOL') {
                byDeveloper[devWallet].totalSOL += entry.amount || 0;
            }
            else if (entry.tokenType === 'SPL') {
                byDeveloper[devWallet].totalSPL += entry.amount || 0;
            }
            byDeveloper[devWallet].count += 1;
        });
        // Convert amounts from base units to readable format
        const tokenDecimals = 9;
        const result = Object.values(byDeveloper).map((dev) => (Object.assign(Object.assign({}, dev), { totalSOL: dev.totalSOL / (Math.pow(10, tokenDecimals)), totalSPL: dev.totalSPL / (Math.pow(10, tokenDecimals)) })));
        // Sort by total revenue (SOL + SPL combined)
        result.sort((a, b) => (b.totalSOL + b.totalSPL) - (a.totalSOL + a.totalSPL));
        return res.status(200).json({
            success: true,
            data: result
        });
    }
    catch (err) {
        console.error('Error fetching platform revenue by developer:', err);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch platform revenue by developer',
            error: err.message || err
        });
    }
});
exports.getPlatformRevenueByDeveloperController = getPlatformRevenueByDeveloperController;
//# sourceMappingURL=revenueController.js.map