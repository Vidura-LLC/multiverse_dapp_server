// src/dashboard/dashboardService.ts

import { Connection, PublicKey, clusterApiUrl } from "@solana/web3.js";
import * as anchor from "@project-serum/anchor";
import { ref, get } from "firebase/database";
import { db } from "../config/firebase";
import { getTournamentPool } from "../gamehub/services";
import { getUserStakingAccount } from "../staking/services";
import { Tournament } from "../gamehub/gamehubController";
import { calculateAPY, formatTokenAmount, getActiveStakers, getStakingPoolData } from "./stakingStatsService";
import { getProgram } from "../staking/services";
import { getRevenueEscrowPDA, getRevenuePoolPDA, getRewardEscrowPDA, getRewardPoolPDA, TokenType } from "../utils/getPDAs";
import { RevenuePoolAccount, RewardPoolAccount } from "./services";
  
  export interface TournamentStats {
      activeTournaments: number;
      upcomingTournaments: number;
      endedTournaments: number;
      distributedTournaments: number;
      awardedTournaments: number;
      totalParticipants: number;
      totalBurnAmount: number;
  }
  
  
  // Interface for the RevenuePool account structur


/**
 * Get comprehensive tournament statistics from Firebase
 * @param tokenType - Token type to filter tournaments (0 for SPL, 1 for SOL)
 */
export async function getTournamentStats(tokenType: TokenType): Promise<any> {
    try {
        // Read from tournaments/{tokenType} path
        const tournamentsRef = ref(db, `tournaments/${tokenType}`);
        const snapshot = await get(tournamentsRef);

        const stats: TournamentStats = {
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
        Object.values(tournaments).forEach((tournamentData: any) => {
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
        const totalBurnAmountDecimal = stats.totalBurnAmount / (10 ** tokenDecimals);

        // Update the stats with the converted amount
        stats.totalBurnAmount = Number(totalBurnAmountDecimal.toFixed(6)); // Keep 6 decimal places for precision

        console.log("✅ Tournament stats calculated:", {
            ...stats,
            totalBurnAmount: `${stats.totalBurnAmount} tokens burned across completed tournaments`
        });

        console.log("✅ Tournament stats calculated:", stats);
        return stats;
    } catch (error) {
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
}


/**
 * Fetch revenue pool statistics and information
 * @param adminPublicKey - Optional admin public key, defaults to program admin
 * @returns Result object with revenue pool stats
 */
export const getRevenuePoolStatsService = async (adminPublicKey: PublicKey, tokenType: TokenType) => {
    try {
        const { program, connection } = getProgram();

        // Use provided admin public key or default to program admin
        const adminPubkey = adminPublicKey;

        console.log("Fetching Revenue Pool Stats:");
        console.log("Admin PublicKey:", adminPubkey.toBase58());

        // Derive the revenue pool PDA
        const revenuePoolPublicKey = getRevenuePoolPDA(adminPublicKey, tokenType);

        // Derive the revenue pool escrow account
        const revenueEscrowPublicKey = getRevenueEscrowPDA(revenuePoolPublicKey);

        console.log("🔹 Revenue Pool PDA:", revenuePoolPublicKey.toString());

        // Check if the revenue pool account exists
        const accountExists = await connection.getAccountInfo(revenuePoolPublicKey);

        if (!accountExists) {
            return {
                success: false,
                message: "Revenue pool has not been initialized yet."
            };
        }

        // Fetch the revenue pool data
        const revenuePoolData = (await program.account.revenuePool.fetch(
            revenuePoolPublicKey
        )) as RevenuePoolAccount;

        console.log("✅ Raw Revenue Pool Data:", revenuePoolData);

        // Convert data to readable format
        const tokenDecimals = 9; // Adjust based on your token decimals
        const readableTotalFunds = revenuePoolData.totalFunds.toNumber() / (10 ** tokenDecimals);

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
            lastDistribution: lastDistributionDate,
            tokenType: tokenType
        };

    } catch (err) {
        console.error("❌ Error fetching revenue pool stats:", err);
        return {
            success: false,
            message: `Error fetching revenue pool stats: ${err.message || err}`
        };
    }
};


export const getRewardPoolStatsService = async (adminPublicKey: PublicKey, tokenType: TokenType) => {
    try {
        const { program, connection } = getProgram();

        // Use provided admin public key or default to program admin
        const adminPubkey = adminPublicKey;

        console.log("Fetching Reward Pool Stats:");
        console.log("Admin PublicKey:", adminPubkey.toBase58());

        // Derive the reward pool PDA
        const rewardPoolPublicKey = getRewardPoolPDA(adminPublicKey, tokenType);
        // Derive the reward pool escrow account
        const rewardEscrowPublicKey = getRewardEscrowPDA(rewardPoolPublicKey);

                // Check if the reward account exists
                const accountExists = await connection.getAccountInfo(rewardPoolPublicKey);

                if (!accountExists) {
                    return {
                        success: false,
                        message: "Reward pool has not been initialized yet."
                    };
                }
        
                // Fetch the reward pool data
                const rewardPoolData = (await program.account.rewardPool.fetch(
                    rewardPoolPublicKey
                )) as RewardPoolAccount;
        
                console.log("✅ Raw Reward Pool Data:", rewardPoolData);

                // Convert data to readable format
                const tokenDecimals = 9; // Adjust based on your token decimals
                const readableTotalFunds = rewardPoolData.totalFunds.toNumber() / (10 ** tokenDecimals);

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
    } catch (err) {
        console.error("❌ Error fetching reward pool stats:", err);
        return {
            success: false,
            message: `Error fetching reward pool stats: ${err.message || err}`
        };
    }
}


/**
* Get comprehensive staking statistics
*/
export const getStakingStats = async (adminPublicKey: PublicKey, tokenType: TokenType) => {
    try {
        console.log("📊 Fetching comprehensive staking statistics...");

        // Fetch all data in parallel
        const [poolResult, stakersResult, apyResult] = await Promise.all([
            getStakingPoolData(adminPublicKey, tokenType),
            getActiveStakers(adminPublicKey, tokenType),
            calculateAPY()
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
        const totalStakedReadable = totalStakedRaw.toNumber() / (10 ** tokenDecimals);

        // Calculate some additional statistics
        const avgStakePerUser = stakersResult.data.activeStakersCount > 0
            ? totalStakedReadable / stakersResult.data.activeStakersCount
            : 0;

        return {
            success: true,
            totalStaked: formatTokenAmount(totalStakedReadable),
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
    } catch (err) {
        console.error("❌ Error fetching staking statistics:", err);
        return {
            success: false,
            message: `Error fetching staking statistics: ${err.message || err}`
        };
    }
};





/**
 * Get comprehensive dashboard data including tournament, revenue, and staking stats
 */

export const getDashboardData = async (adminPublicKey: PublicKey, tokenType: TokenType): Promise<any> => {
    try {
        console.log("📊 Fetching comprehensive dashboard data...");

        // Fetch tournament stats filtered by tokenType
        const tournamentStats = await getTournamentStats(tokenType);

        // Fetch revenue pool stats
        const revenuePoolStats = await getRevenuePoolStatsService(adminPublicKey, tokenType);

        // Fetch reward pool stats
        const rewardPoolStats = await getRewardPoolStatsService(adminPublicKey, tokenType);

        // Fetch staking stats
        const stakingStats = await getStakingStats(adminPublicKey, tokenType);

        return {
            tournament: tournamentStats,
            revenue: revenuePoolStats,
            staking: stakingStats,
            reward: rewardPoolStats
        };
    } catch (err) {
        console.error("❌ Error fetching dashboard data:", err);
        throw new Error(`Error fetching dashboard data: ${err.message || err}`);
    }
}

