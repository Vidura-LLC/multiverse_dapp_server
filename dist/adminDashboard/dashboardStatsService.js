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
exports.getDashboardData = exports.getStakingStats = exports.getRewardPoolStatsService = exports.getRevenuePoolStatsService = void 0;
exports.getTournamentStats = getTournamentStats;
const web3_js_1 = require("@solana/web3.js");
const anchor = __importStar(require("@project-serum/anchor"));
const database_1 = require("firebase/database");
const firebase_1 = require("../config/firebase");
const stakingStatsService_1 = require("./stakingStatsService");
const services_1 = require("../staking/services");
const getPDAs_1 = require("../utils/getPDAs");
// Interface for the RevenuePool account structur
/**
 * Get comprehensive tournament statistics from Firebase
 * @param tokenType - Token type to filter tournaments (0 for SPL, 1 for SOL)
 */
function getTournamentStats(tokenType) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // Read from tournaments/{tokenType} path
            const tournamentsRef = (0, database_1.ref)(firebase_1.db, `tournaments/${tokenType}`);
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
            // tournaments is an object with tournament IDs as keys
            Object.values(tournaments).forEach((tournamentData) => {
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
                    case "Not Started":
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
                        // Check both 'distribution' and 'distributionDetails' for backward compatibility
                        const distForDistributed = tournament.distribution || tournament.distributionDetails || {};
                        if (distForDistributed.burnAmount) {
                            stats.totalBurnAmount += Number(distForDistributed.burnAmount) || 0;
                        }
                        break;
                    case "Awarded":
                        stats.awardedTournaments++;
                        // Awarded tournaments are also distributed and ended
                        stats.distributedTournaments++;
                        stats.endedTournaments++;
                        // ✅ Calculate burn amount for awarded tournaments
                        // Check both 'distribution' and 'distributionDetails' for backward compatibility
                        const distForAwarded = tournament.distribution || tournament.distributionDetails || {};
                        if (distForAwarded.burnAmount) {
                            stats.totalBurnAmount += Number(distForAwarded.burnAmount) || 0;
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
 * Fetch revenue statistics from Firebase
 * Revenue is now tracked off-chain in Firebase since funds go directly to developer/platform wallets
 * @param adminPublicKey - Developer/admin public key to fetch revenue for
 * @param tokenType - Token type (SPL or SOL)
 * @returns Result object with revenue stats from Firebase
 */
const getRevenuePoolStatsService = (adminPublicKey, tokenType) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    try {
        console.log("Fetching Revenue Stats from Firebase:");
        console.log("Admin PublicKey:", adminPublicKey.toBase58());
        console.log("Token Type:", tokenType === getPDAs_1.TokenType.SPL ? "SPL" : "SOL");
        // Convert token type to string key
        const tokenKey = tokenType === getPDAs_1.TokenType.SOL ? "SOL" : "SPL";
        // Fetch developer revenue from Firebase
        const developerRef = (0, database_1.ref)(firebase_1.db, `developerRevenue/${adminPublicKey.toString()}`);
        const developerSnapshot = yield (0, database_1.get)(developerRef);
        // Fetch platform revenue from Firebase
        const platformRef = (0, database_1.ref)(firebase_1.db, `platformRevenue`);
        const platformSnapshot = yield (0, database_1.get)(platformRef);
        let developerTotal = 0;
        let platformTotal = 0;
        let lastDistribution = null;
        // Get developer revenue for the specific token type
        if (developerSnapshot.exists()) {
            const developerData = developerSnapshot.val();
            // Get totalEarned for the specific token type
            developerTotal = ((_a = developerData.totalEarned) === null || _a === void 0 ? void 0 : _a[tokenKey]) || 0;
            // Get most recent distribution timestamp from history
            if (developerData.history && Array.isArray(developerData.history)) {
                // Filter history by token type and get latest
                const tokenHistory = developerData.history.filter((entry) => entry.tokenType === tokenKey);
                if (tokenHistory.length > 0) {
                    const latest = tokenHistory[tokenHistory.length - 1];
                    if (latest.timestamp) {
                        lastDistribution = new Date(latest.timestamp).toISOString();
                    }
                }
            }
            else if (developerData.lastDistribution) {
                lastDistribution = new Date(developerData.lastDistribution).toISOString();
            }
        }
        // Get platform revenue for the specific token type
        if (platformSnapshot.exists()) {
            const platformData = platformSnapshot.val();
            // Get totalEarned for the specific token type
            platformTotal = ((_b = platformData.totalEarned) === null || _b === void 0 ? void 0 : _b[tokenKey]) || 0;
        }
        // Convert from base units to readable format
        const tokenDecimals = 9;
        const developerTotalReadable = developerTotal / (Math.pow(10, tokenDecimals));
        const platformTotalReadable = platformTotal / (Math.pow(10, tokenDecimals));
        const totalRevenueReadable = developerTotalReadable + platformTotalReadable;
        console.log("✅ Revenue Stats from Firebase:", {
            developerTotal: developerTotalReadable,
            platformTotal: platformTotalReadable,
            totalRevenue: totalRevenueReadable
        });
        return {
            success: true,
            totalFunds: totalRevenueReadable,
            developerRevenue: developerTotalReadable,
            platformRevenue: platformTotalReadable,
            revenuePoolAddress: "N/A (Firebase-based tracking)",
            revenueEscrowAddress: "N/A (Direct wallet transfers)",
            lastDistribution: lastDistribution,
            tokenType: tokenType
        };
    }
    catch (err) {
        console.error("❌ Error fetching revenue stats from Firebase:", err);
        return {
            success: false,
            message: `Error fetching revenue stats: ${err.message || err}`
        };
    }
});
exports.getRevenuePoolStatsService = getRevenuePoolStatsService;
const getRewardPoolStatsService = (tokenType) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { program, connection } = (0, services_1.getProgram)();
        // Get super admin from platform config (pools are global, initialized by super admin)
        const { getPlatformConfigService } = yield Promise.resolve().then(() => __importStar(require('./services')));
        const platformConfig = yield getPlatformConfigService();
        if (!platformConfig.success || !platformConfig.data) {
            return {
                success: false,
                message: 'Platform config not initialized. Please initialize platform config first.'
            };
        }
        const superAdminPublicKey = new web3_js_1.PublicKey(platformConfig.data.superAdmin);
        console.log("Fetching Reward Pool Stats:");
        console.log("Using Super Admin PublicKey:", superAdminPublicKey.toBase58());
        // Derive the reward pool PDA using super admin
        const rewardPoolPublicKey = (0, getPDAs_1.getRewardPoolPDA)(superAdminPublicKey, tokenType);
        // Derive the reward pool escrow account
        const rewardEscrowPublicKey = (0, getPDAs_1.getRewardEscrowPDA)(rewardPoolPublicKey);
        // Check if the reward account exists
        const accountExists = yield connection.getAccountInfo(rewardPoolPublicKey);
        if (!accountExists) {
            return {
                success: false,
                message: "Reward pool has not been initialized yet."
            };
        }
        // Fetch the reward pool data
        const rewardPoolData = (yield program.account.rewardPool.fetch(rewardPoolPublicKey));
        console.log("✅ Raw Reward Pool Data:", rewardPoolData);
        // Convert data to readable format
        const tokenDecimals = 9; // Adjust based on your token decimals
        const readableTotalFunds = rewardPoolData.totalFunds.toNumber() / (Math.pow(10, tokenDecimals));
        // Convert timestamps to readable dates
        const lastDistributionTimestamp = rewardPoolData.lastDistribution.toNumber();
        const lastDistributionDate = lastDistributionTimestamp > 0
            ? new Date(lastDistributionTimestamp * 1000).toISOString()
            : null;
        return {
            success: true,
            totalFunds: readableTotalFunds,
            lastDistribution: lastDistributionTimestamp,
            lastDistributionDate: lastDistributionDate,
            rewardPoolAddress: rewardPoolPublicKey.toString(),
            rewardEscrowAddress: rewardEscrowPublicKey.toString(),
            tokenType: tokenType
        };
    }
    catch (err) {
        console.error("❌ Error fetching reward pool stats:", err);
        return {
            success: false,
            message: `Error fetching reward pool stats: ${err.message || err}`
        };
    }
});
exports.getRewardPoolStatsService = getRewardPoolStatsService;
/**
* Get comprehensive staking statistics
*/
const getStakingStats = (adminPublicKey, tokenType) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        console.log("📊 Fetching comprehensive staking statistics...");
        // Fetch all data in parallel (pools are global, use super admin from platform config)
        const [poolResult, stakersResult, apyResult] = yield Promise.all([
            (0, stakingStatsService_1.getStakingPoolData)(tokenType),
            (0, stakingStatsService_1.getActiveStakers)(undefined, tokenType), // getActiveStakers will use super admin internally
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
            stakingPoolEscrowAddress: poolResult.data.stakingEscrowPublicKey,
            totalWeight: poolResult.data.totalWeight,
            accRewardPerWeight: poolResult.data.accRewardPerWeight,
            epochIndex: poolResult.data.epochIndex,
            tokenType: poolResult.data.tokenType
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
const getDashboardData = (adminPublicKey, tokenType) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        console.log("📊 Fetching comprehensive dashboard data...");
        // Fetch tournament stats filtered by tokenType
        const tournamentStats = yield getTournamentStats(tokenType);
        // Fetch revenue pool stats
        const revenuePoolStats = yield (0, exports.getRevenuePoolStatsService)(adminPublicKey, tokenType);
        // Fetch reward pool stats (pools are global, use super admin from platform config)
        const rewardPoolStats = yield (0, exports.getRewardPoolStatsService)(tokenType);
        // Fetch staking stats
        const stakingStats = yield (0, exports.getStakingStats)(adminPublicKey, tokenType);
        return {
            tournament: tournamentStats,
            revenue: revenuePoolStats,
            staking: stakingStats,
            reward: rewardPoolStats
        };
    }
    catch (err) {
        console.error("❌ Error fetching dashboard data:", err);
        throw new Error(`Error fetching dashboard data: ${err.message || err}`);
    }
});
exports.getDashboardData = getDashboardData;
//# sourceMappingURL=dashboardStatsService.js.map