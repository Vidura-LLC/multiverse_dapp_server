
//src/adminDashboard/stakingStatsService.ts

import {
  PublicKey,
} from "@solana/web3.js";

import dotenv from "dotenv";
import { getProgram } from "../staking/services";
dotenv.config();
import * as anchor from "@project-serum/anchor";

interface StakingPoolAccount {
    admin: PublicKey;
    mint: PublicKey;
    totalStaked: anchor.BN;
    bump: number;
}

interface UserStakingAccount {
    owner: PublicKey;
    stakedAmount: anchor.BN;
    stakeTimestamp: anchor.BN;
    lockDuration: anchor.BN;
}

/**
 * Helper function to format token amounts properly
 */
const formatTokenAmount = (amount: number, decimals: number = 9): string => {
    if (amount === 0) return "0";

    // For very small amounts, show more decimal places
    if (amount < 1) {
        return amount.toFixed(6).replace(/\.?0+$/, '');
    }

    // For larger amounts, use standard locale formatting
    if (amount >= 1000000) {
        return (amount / 1000000).toFixed(2) + "M";
    } else if (amount >= 1000) {
        return (amount / 1000).toFixed(2) + "K";
    }

    return amount.toLocaleString(undefined, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 6
    });
};

/**
 * Get the staking pool data from the blockchain
 */
export const getStakingPoolData = async (adminPublicKey: PublicKey) => {
    try {
        const { program } = getProgram();

        // Derive the staking pool PDA
        const [stakingPoolPublicKey] = PublicKey.findProgramAddressSync(
            [Buffer.from("staking_pool"), adminPublicKey.toBuffer()],
            program.programId
        );

        console.log("🔹 Fetching Staking Pool PDA:", stakingPoolPublicKey.toString());

        // Fetch the staking pool data
        const stakingPoolData = await program.account.stakingPool.fetch(
            stakingPoolPublicKey
        ) as StakingPoolAccount;

        return {
            success: true,
            data: {
                admin: stakingPoolData.admin.toString(),
                mint: stakingPoolData.mint.toString(),
                totalStaked: stakingPoolData.totalStaked.toString(),
                stakingPoolAddress: stakingPoolPublicKey.toString(),
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
                stakeTimestamp: userData.stakeTimestamp.toString(),
                stakeDate: new Date(userData.stakeTimestamp.toNumber() * 1000).toISOString(),
                lockDuration: userData.lockDuration.toString(),
                lockDurationDays: Math.floor(userData.lockDuration.toNumber() / (24 * 60 * 60)),
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

/**
 * Get comprehensive staking statistics
 */
export const getStakingStats = async (adminPublicKey: PublicKey) => {
    try {
        console.log("📊 Fetching comprehensive staking statistics...");

        // Fetch all data in parallel
        const [poolResult, stakersResult, apyResult] = await Promise.all([
            getStakingPoolData(adminPublicKey),
            getActiveStakers(),
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
                mintAddress: poolResult.data.mint,
        };
    } catch (err) {
        console.error("❌ Error fetching staking statistics:", err);
        return {
            success: false,
            message: `Error fetching staking statistics: ${err.message || err}`
        };
    }
};