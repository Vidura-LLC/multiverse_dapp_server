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
exports.confirmPrizeDistributionController = exports.confirmDistributionController = exports.getAdminDistributionTotalsController = exports.getAdminPrizesDistributedController = exports.getTournamentPrizesDistributionController = exports.distributeTournamentPrizesController = exports.getTournamentDistributionController = exports.distributeTournamentRevenueController = void 0;
const database_1 = require("firebase/database");
const firebase_1 = require("../config/firebase");
const web3_js_1 = require("@solana/web3.js");
const services_1 = require("./services");
const services_2 = require("../staking/services");
/**
 * Controller function to distribute tournament revenue according to the updated percentages
 */
const distributeTournamentRevenueController = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { tournamentId, prizePercentage, revenuePercentage, stakingPercentage, burnPercentage, adminPublicKey } = req.body;
        const adminPubKey = new web3_js_1.PublicKey(adminPublicKey);
        // Validate tournament ID
        if (!tournamentId) {
            return res.status(400).json({
                success: false,
                message: 'Tournament ID is required'
            });
        }
        // Validate custom percentages if provided
        const useCustomPercentages = prizePercentage !== undefined ||
            revenuePercentage !== undefined ||
            stakingPercentage !== undefined ||
            burnPercentage !== undefined;
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
                    message: "Percentages must add up to 100%"
                });
            }
            // Validate individual percentages are within reasonable ranges
            if (prizePercentage < 0 || prizePercentage > 100 ||
                revenuePercentage < 0 || revenuePercentage > 100 ||
                stakingPercentage < 0 || stakingPercentage > 100 ||
                burnPercentage < 0 || burnPercentage > 100) {
                return res.status(400).json({
                    success: false,
                    message: "All percentages must be between 0 and 100"
                });
            }
        }
        // Call the service function to distribute revenue with burn functionality
        const result = yield (0, services_1.distributeTournamentRevenueService)(tournamentId, prizePercentage, revenuePercentage, stakingPercentage, burnPercentage, adminPubKey);
        // Return the result
        if (result.success) {
            return res.status(200).json(result);
        }
        else {
            return res.status(400).json(result);
        }
    }
    catch (err) {
        console.error('Error in distribute tournament revenue controller:', err);
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
        // Format and return distribution details including burn information
        return res.status(200).json({
            success: true,
            tournamentId,
            tournamentName: tournament.name,
            distributionDetails: {
                completedAt: new Date(tournament.distributionTimestamp).toISOString(),
                totalDistributed: tournament.distributionDetails.totalDistributed,
                prizeAmount: tournament.distributionDetails.prizeAmount,
                revenueAmount: tournament.distributionDetails.revenueAmount,
                stakingAmount: tournament.distributionDetails.stakingAmount,
                burnAmount: tournament.distributionDetails.burnAmount, // New field
                transactionSignature: tournament.distributionDetails.transactionSignature,
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
        const { tournamentId, firstPlacePublicKey, secondPlacePublicKey, thirdPlacePublicKey, adminPublicKey } = req.body;
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
        // Verify tournament exists
        const tournamentRef = (0, database_1.ref)(firebase_1.db, `tournaments/${tournamentId}`);
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
        const result = yield (0, services_1.distributeTournamentPrizesService)(tournamentId, firstPlacePubkey, secondPlacePubkey, thirdPlacePubkey, adminPubKey);
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
        if (!adminPubKey) {
            return res.status(400).json({ success: false, message: 'adminPubKey is required' });
        }
        // Fetch all tournaments
        const tournamentsRef = (0, database_1.ref)(firebase_1.db, 'tournaments');
        const tournamentsSnapshot = yield (0, database_1.get)(tournamentsRef);
        if (!tournamentsSnapshot.exists()) {
            return res.status(200).json({
                success: true,
                data: {
                    prizeAmountRaw: '0', revenueAmountRaw: '0', stakingAmountRaw: '0', burnAmountRaw: '0',
                    prizeAmount: 0, revenueAmount: 0, stakingAmount: 0, burnAmount: 0,
                    tokenDecimals: 9, tournamentCount: 0
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
            const d = (t === null || t === void 0 ? void 0 : t.distributionDetails) || {};
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
    try {
        const { tournamentId, transactionSignature, distribution } = req.body;
        // Validate required fields
        if (!tournamentId || !transactionSignature) {
            return res.status(400).json({
                success: false,
                message: 'Tournament ID and transaction signature are required'
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
        console.log("Updating tournament status in Firebase...");
        const tournamentRef = (0, database_1.ref)(firebase_1.db, `tournaments/${tournamentId}`);
        // Check if tournament exists
        const tournamentSnapshot = yield (0, database_1.get)(tournamentRef);
        if (!tournamentSnapshot.exists()) {
            return res.status(404).json({
                success: false,
                message: 'Tournament not found'
            });
        }
        const tournament = tournamentSnapshot.val();
        // Check if already distributed
        if (tournament.distributionCompleted) {
            return res.status(400).json({
                success: false,
                message: 'Tournament revenue has already been distributed'
            });
        }
        // Update tournament with distribution details
        yield (0, database_1.update)(tournamentRef, {
            status: "Distributed",
            distributionCompleted: true,
            distributionTimestamp: Date.now(),
            distributionDetails: {
                totalDistributed: distribution.totalFunds,
                prizeAmount: distribution.prizeAmount,
                revenueAmount: distribution.revenueAmount,
                stakingAmount: distribution.stakingAmount,
                burnAmount: distribution.burnAmount,
                transactionSignature: transactionSignature
            }
        });
        return res.status(200).json({
            success: true,
            message: 'Tournament distribution confirmed successfully',
            tournamentId,
            transactionSignature,
            distribution
        });
    }
    catch (err) {
        console.error('Error in confirm distribution controller:', err);
        return res.status(500).json({
            success: false,
            message: 'Failed to confirm tournament distribution',
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
        const { tournamentId, transactionSignature, winnerData } = req.body;
        // Validate required fields
        if (!tournamentId || !transactionSignature) {
            return res.status(400).json({
                success: false,
                message: 'Tournament ID and transaction signature are required'
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
        const tournamentRef = (0, database_1.ref)(firebase_1.db, `tournaments/${tournamentId}`);
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
//# sourceMappingURL=revenueController.js.map