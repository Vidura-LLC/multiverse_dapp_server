"use strict";
// src/dashboard/dashboardService.ts
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
exports.getDashboardData = exports.getStakingStats = exports.getRevenuePoolStatsService = void 0;
exports.getTournamentStats = getTournamentStats;
const web3_js_1 = require("@solana/web3.js");
const anchor = __importStar(require("@project-serum/anchor"));
const database_1 = require("firebase/database");
const firebase_1 = require("../config/firebase");
const stakingStatsService_1 = require("./stakingStatsService");
const services_1 = require("../staking/services");
/**
 * Get comprehensive tournament statistics from Firebase
 */
function getTournamentStats() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const tournamentsRef = (0, database_1.ref)(firebase_1.db, 'tournaments');
            const snapshot = yield (0, database_1.get)(tournamentsRef);
            const stats = {
                activeTournaments: 0,
                upcomingTournaments: 0,
                endedTournaments: 0,
                distributedTournaments: 0,
                awardedTournaments: 0,
                totalParticipants: 0,
                totalBurnAmount: 0,
            };
            if (!snapshot.exists()) {
                return stats;
            }
            const tournaments = snapshot.val();
            const currentTime = new Date().getTime();
            Object.values(tournaments).forEach((tournamentData) => {
                var _a, _b;
                const tournament = tournamentData;
                // Count participants using the participantsCount field or calculate from participants object
                const participantCount = tournament.participantsCount ||
                    (tournament.participants ? Object.keys(tournament.participants).length : 0);
                stats.totalParticipants += participantCount;
                // Categorize tournaments based on status field
                switch (tournament.status) {
                    case "Active":
                        stats.activeTournaments++;
                        break;
                    case "Upcoming":
                    case "Draft":
                        stats.upcomingTournaments++;
                        break;
                    case "Ended":
                        stats.endedTournaments++;
                        break;
                    case "Distributed":
                        stats.distributedTournaments++;
                        // Distributed tournaments are also ended tournaments
                        stats.endedTournaments++;
                        // ✅ Calculate burn amount for distributed tournaments
                        if ((_a = tournament.distributionDetails) === null || _a === void 0 ? void 0 : _a.burnAmount) {
                            stats.totalBurnAmount += Number(tournament.distributionDetails.burnAmount) || 0;
                        }
                        break;
                    case "Awarded":
                        stats.awardedTournaments++;
                        // Awarded tournaments are also distributed and ended
                        stats.distributedTournaments++;
                        stats.endedTournaments++;
                        // ✅ Calculate burn amount for awarded tournaments
                        if ((_b = tournament.distributionDetails) === null || _b === void 0 ? void 0 : _b.burnAmount) {
                            stats.totalBurnAmount += Number(tournament.distributionDetails.burnAmount) || 0;
                        }
                        break;
                }
            });
            // ✅ Convert totalBurnAmount from base units (with 9 decimals) to readable format
            const tokenDecimals = 9;
            const totalBurnAmountDecimal = stats.totalBurnAmount / (Math.pow(10, tokenDecimals));
            // Update the stats with the converted amount
            stats.totalBurnAmount = Number(totalBurnAmountDecimal.toFixed(6)); // Keep 6 decimal places for precision
            console.log("✅ Tournament stats calculated:", Object.assign(Object.assign({}, stats), { totalBurnAmount: `${stats.totalBurnAmount} tokens burned across completed tournaments` }));
            console.log("✅ Tournament stats calculated:", stats);
            return stats;
        }
        catch (error) {
            console.error("❌ Error fetching tournament stats:", error);
            return {
                activeTournaments: 0,
                upcomingTournaments: 0,
                endedTournaments: 0,
                distributedTournaments: 0,
                awardedTournaments: 0,
                totalParticipants: 0,
                totalBurnAmount: 0,
            };
        }
    });
}
/**
 * Fetch revenue pool statistics and information
 * @param adminPublicKey - Optional admin public key, defaults to program admin
 * @returns Result object with revenue pool stats
 */
const getRevenuePoolStatsService = (adminPublicKey) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { program, connection } = (0, services_1.getProgram)();
        // Use provided admin public key or default to program admin
        const adminPubkey = adminPublicKey;
        console.log("Fetching Revenue Pool Stats:");
        console.log("Admin PublicKey:", adminPubkey.toBase58());
        // Derive the revenue pool PDA
        const [revenuePoolPublicKey] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("revenue_pool"), adminPubkey.toBuffer()], program.programId);
        // Derive the revenue pool escrow account
        const [revenueEscrowPublicKey] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("revenue_escrow"), revenuePoolPublicKey.toBuffer()], program.programId);
        console.log("🔹 Revenue Pool PDA:", revenuePoolPublicKey.toString());
        // Check if the revenue pool account exists
        const accountExists = yield connection.getAccountInfo(revenuePoolPublicKey);
        if (!accountExists) {
            return {
                success: false,
                message: "Revenue pool has not been initialized yet."
            };
        }
        // Fetch the revenue pool data
        const revenuePoolData = (yield program.account.revenuePool.fetch(revenuePoolPublicKey));
        console.log("✅ Raw Revenue Pool Data:", revenuePoolData);
        // Convert data to readable format
        const tokenDecimals = 9; // Adjust based on your token decimals
        const readableTotalFunds = revenuePoolData.totalFunds.toNumber() / (Math.pow(10, tokenDecimals));
        // Convert timestamps to readable dates
        const lastDistributionTimestamp = revenuePoolData.lastDistribution.toNumber();
        const lastDistributionDate = lastDistributionTimestamp > 0
            ? new Date(lastDistributionTimestamp * 1000).toISOString()
            : null;
        // Calculate time since last distribution
        const currentTimestamp = Math.floor(Date.now() / 1000);
        const timeSinceLastDistribution = lastDistributionTimestamp > 0
            ? currentTimestamp - lastDistributionTimestamp
            : null;
        return {
            success: true,
            totalFunds: readableTotalFunds,
            revenuePoolAddress: revenuePoolPublicKey.toString(),
            revenueEscrowAddress: revenueEscrowPublicKey.toString(),
            lastDistribution: lastDistributionDate
        };
    }
    catch (err) {
        console.error("❌ Error fetching revenue pool stats:", err);
        return {
            success: false,
            message: `Error fetching revenue pool stats: ${err.message || err}`
        };
    }
});
exports.getRevenuePoolStatsService = getRevenuePoolStatsService;
/**
* Get comprehensive staking statistics
*/
const getStakingStats = (adminPublicKey) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        console.log("📊 Fetching comprehensive staking statistics...");
        // Fetch all data in parallel
        const [poolResult, stakersResult, apyResult] = yield Promise.all([
            (0, stakingStatsService_1.getStakingPoolData)(adminPublicKey),
            (0, stakingStatsService_1.getActiveStakers)(),
            (0, stakingStatsService_1.calculateAPY)()
        ]);
        // Check if any requests failed
        if (!poolResult.success) {
            return {
                success: false,
                message: `Failed to fetch pool data: ${poolResult.message}`
            };
        }
        if (!stakersResult.success) {
            return {
                success: false,
                message: `Failed to fetch stakers data: ${stakersResult.message}`
            };
        }
        if (!apyResult.success) {
            return {
                success: false,
                message: `Failed to calculate APY: ${apyResult.message}`
            };
        }
        // Convert total staked to readable format
        const tokenDecimals = 9; // Adjust based on your token decimals
        const totalStakedRaw = new anchor.BN(poolResult.data.totalStaked);
        const totalStakedReadable = totalStakedRaw.toNumber() / (Math.pow(10, tokenDecimals));
        // Calculate some additional statistics
        const avgStakePerUser = stakersResult.data.activeStakersCount > 0
            ? totalStakedReadable / stakersResult.data.activeStakersCount
            : 0;
        return {
            success: true,
            totalStaked: (0, stakingStatsService_1.formatTokenAmount)(totalStakedReadable),
            activeStakers: stakersResult.data.activeStakersCount,
            currentAPY: apyResult.data.currentAPY,
            avgStakePerUser,
            stakingPoolAddress: poolResult.data.stakingPoolAddress,
            stakingPoolEscrowAddress: poolResult.data.stakingEscrowPublicKey
        };
    }
    catch (err) {
        console.error("❌ Error fetching staking statistics:", err);
        return {
            success: false,
            message: `Error fetching staking statistics: ${err.message || err}`
        };
    }
});
exports.getStakingStats = getStakingStats;
/**
 * Get comprehensive dashboard data including tournament, revenue, and staking stats
 */
const getDashboardData = (adminPublicKey) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        console.log("📊 Fetching comprehensive dashboard data...");
        // Fetch tournament stats
        const tournamentStats = yield getTournamentStats();
        // Fetch revenue pool stats
        const revenuePoolStats = yield (0, exports.getRevenuePoolStatsService)(adminPublicKey);
        // Fetch staking stats
        const stakingStats = yield (0, exports.getStakingStats)(adminPublicKey);
        return {
            tournament: tournamentStats,
            revenue: revenuePoolStats,
            staking: stakingStats
        };
    }
    catch (err) {
        console.error("❌ Error fetching dashboard data:", err);
        throw new Error(`Error fetching dashboard data: ${err.message || err}`);
    }
});
exports.getDashboardData = getDashboardData;
//# sourceMappingURL=dashboardStatsService.js.map