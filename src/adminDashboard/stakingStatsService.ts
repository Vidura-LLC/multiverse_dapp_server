
//src/adminDashboard/stakingStatsService.ts

import {
  PublicKey,
} from "@solana/web3.js";

import dotenv from "dotenv";
import { getProgram } from "../staking/services";
dotenv.config();
import * as anchor from "@project-serum/anchor";
import { getLockMultiplierFromSeconds } from "../staking/rewardCalculationService";

export interface StakingPoolAccount {
    admin: PublicKey;
    mint: PublicKey;
    totalStaked: anchor.BN;
    totalWeightedStake: anchor.BN;
    currentEventId: anchor.BN;
    totalAccumulatedRevenue: anchor.BN;
    lastDistributionTimestamp: anchor.BN;
    activeStakersCount: number;
    bump: number;
    maxStake: anchor.BN;
}

export interface UserStakingAccount {
    owner: PublicKey;
    stakedAmount: anchor.BN;
    stakeTimestamp: anchor.BN;
    lockDuration: anchor.BN;
    joinedAtEvent: anchor.BN;
    accumulatedRewards: anchor.BN;
    bump: number;
}

/**
 * Helper function to format token amounts properly
 */
export const formatTokenAmount = (amount: number, decimals: number = 9): number => {
    if (amount === 0) return 0;

    // For very small amounts, show more decimal places
    if (amount < 1) {
        return parseFloat(amount.toFixed(6).replace(/\.?0+$/, ''));
    }

    // For larger amounts, use standard locale formatting
    if (amount >= 1000000) {
        return Number((amount / 1000000).toFixed(2));
    } else if (amount >= 1000) {
        return Number((amount / 1000).toFixed(2));
    }

    return amount
};

/**
 * Get the staking pool data from the blockchain
 */
export const getStakingPoolData = async (adminPublicKey: PublicKey) => {
    try {
        const { program, connection } = getProgram();

        // Derive the staking pool PDA
        const [stakingPoolPublicKey] = PublicKey.findProgramAddressSync(
            [Buffer.from("staking_pool"), adminPublicKey.toBuffer()],
            program.programId
        );

        // Derive the staking pool escrow account
        const [stakingEscrowPublicKey] = PublicKey.findProgramAddressSync(
            [Buffer.from("escrow"), stakingPoolPublicKey.toBuffer()],
            program.programId
        );
        console.log("🔹 Fetching Staking Pool PDA:", stakingPoolPublicKey.toString());


        // Check if the revenue pool account exists
        const accountExists = await connection.getAccountInfo(stakingPoolPublicKey);

        if (!accountExists) {
            return {
                success: false,
                message: "Staking pool has not been initialized yet."
            };
        }     
        // Fetch the staking pool data
        const stakingPoolData = await program.account.stakingPool.fetch(
            stakingPoolPublicKey
        ) as StakingPoolAccount;

        return {
            success: true,
            data: {
                admin: stakingPoolData.admin.toString(),
                mint: stakingPoolData.mint.toString(),
                totalStaked: stakingPoolData.totalStaked.toNumber(),
                totalWeightedStake: stakingPoolData.totalWeightedStake.toNumber(),
                currentEventId: stakingPoolData.currentEventId.toNumber(),
                totalAccumulatedRevenue: stakingPoolData.totalAccumulatedRevenue.toNumber(),
                activeStakersCount: stakingPoolData.activeStakersCount,
                lastDistributionTimestamp: stakingPoolData.lastDistributionTimestamp.toNumber(),
                stakingPoolAddress: stakingPoolPublicKey.toString(),
                stakingEscrowPublicKey: stakingEscrowPublicKey.toString(),
            }
        };
    } catch (err) {
        console.error("❌ Error fetching staking pool data:", err);
        return {
            success: false,
            message: `Error fetching staking pool data: ${err.message || err}`
        };
    }
};

/**
 * Get all active stakers by scanning user staking accounts
 * Note: This is a simplified approach. In production, you might want to maintain
 * a list of stakers in your database for better performance.
 */
export const getActiveStakers = async () => {
    try {
        const { program } = getProgram();

        // Get all program accounts of type UserStakingAccount
        const userStakingAccounts = await program.account.userStakingAccount.all();

        console.log(`🔹 Found ${userStakingAccounts.length} user staking accounts`);

        // Filter active stakers (those with staked amount > 0)
        const activeStakers = userStakingAccounts.filter(account => {
            const userData = account.account as UserStakingAccount;
            return userData.stakedAmount.gt(new anchor.BN(0));
        });

        console.log(`🔹 Active stakers: ${activeStakers.length}`);

        // Calculate detailed staker information
        const stakersInfo = activeStakers.map(account => {
            const userData = account.account as UserStakingAccount;
            const tokenDecimals = 9; // Adjust based on your token decimals
            const readableStakedAmount = userData.stakedAmount.toNumber() / (10 ** tokenDecimals);

            return {
                publicKey: account.publicKey.toString(),
                owner: userData.owner.toString(),
                stakedAmount: readableStakedAmount,
                stakedAmountFormatted: formatTokenAmount(readableStakedAmount),
                stakeTimestamp: userData.stakeTimestamp.toNumber(), // Unix timestamp (number)
                lockDuration: userData.lockDuration.toNumber(), // Number in seconds
                lockDurationDays: Math.floor(userData.lockDuration.toNumber() / (24 * 60 * 60)),
                multiplier: getLockMultiplierFromSeconds(userData.lockDuration.toNumber()),
                weightedStake: readableStakedAmount * getLockMultiplierFromSeconds(userData.lockDuration.toNumber()),
                weightedStakeFormatted: formatTokenAmount(readableStakedAmount * getLockMultiplierFromSeconds(userData.lockDuration.toNumber())),
                joinedAtEvent: userData.joinedAtEvent?.toNumber() || 0,
                accumulatedRewards: userData.accumulatedRewards?.toNumber() / (10 ** 9) || 0,
                accumulatedRewardsFormatted: formatTokenAmount(userData.accumulatedRewards?.toNumber() / (10 ** 9) || 0),
            };
        });

        return {
            success: true,
            data: {
                activeStakersCount: activeStakers.length,
                totalStakers: userStakingAccounts.length,
                stakers: stakersInfo
            }
        };
    } catch (err) {
        console.error("❌ Error fetching active stakers:", err);
        return {
            success: false,
            message: `Error fetching active stakers: ${err.message || err}`
        };
    }
};

/**
 * Calculate APY based on staking rewards and time
 * This is a simplified calculation - you may need to adjust based on your reward mechanism
 */
export const calculateAPY = async () => {
    try {
        // For now, we'll return a calculated APY based on your tokenomics
        // You might want to calculate this based on:
        // 1. Revenue from tournaments going to staking rewards
        // 2. Time-based multipliers for different lock periods
        // 3. Total staked amount vs circulating supply

        // Example calculation (adjust based on your actual reward mechanism):
        const baseAPY = 8.0; // Base 8% APY
        const tournamentBonusAPY = 4.4; // Additional 4.4% from tournament revenue

        const totalAPY = baseAPY + tournamentBonusAPY;

        return {
            success: true,
            data: {
                currentAPY: totalAPY,
                baseAPY: baseAPY,
                tournamentBonusAPY: tournamentBonusAPY,
                calculatedAt: new Date().toISOString()
            }
        };
    } catch (err) {
        console.error("❌ Error calculating APY:", err);
        return {
            success: false,
            message: `Error calculating APY: ${err.message || err}`
        };
    }
};

