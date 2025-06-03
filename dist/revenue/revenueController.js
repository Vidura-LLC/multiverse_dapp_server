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
exports.getTournamentPrizesDistributionController = exports.distributeTournamentPrizesController = exports.getTournamentDistributionController = exports.distributeTournamentRevenueController = exports.initializePrizePoolController = void 0;
const database_1 = require("firebase/database");
const firebase_1 = require("../config/firebase");
const web3_js_1 = require("@solana/web3.js");
const services_1 = require("../../src/revenue/services");
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
        // Return the result
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
        if (!firstPlacePublicKey || !secondPlacePublicKey || !thirdPlacePublicKey || adminPublicKey) {
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
        if (tournament.status !== 'Ended' && tournament.status !== 'Completed') {
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
//# sourceMappingURL=revenueController.js.map