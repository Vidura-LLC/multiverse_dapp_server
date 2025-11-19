
//src/adminDashboard/stakingStatsService.ts

import {
  PublicKey,
} from "@solana/web3.js";

import dotenv from "dotenv";
import { getProgram } from "../staking/services";
dotenv.config();
import * as anchor from "@project-serum/anchor";
import { UserStakingAccount } from "../staking/services";
import { StakingPoolAccount } from "./services";
import { SEEDS, TokenType, getStakingPoolPDA, getUserStakingPDA } from "../utils/getPDAs";

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
export const getStakingPoolData = async (adminPublicKey: PublicKey, tokenType: TokenType) => {
    try {
        const { program, connection } = getProgram();

        // Derive the staking pool PDA
        const [stakingPoolPublicKey] = PublicKey.findProgramAddressSync(
            [Buffer.from(SEEDS.STAKING_POOL), adminPublicKey.toBuffer(), Buffer.from([tokenType])],
            program.programId
        );

        // Derive the staking pool escrow account (consistent seed)
        const [stakingEscrowPublicKey] = PublicKey.findProgramAddressSync(
            [Buffer.from(SEEDS.STAKING_POOL_ESCROW), stakingPoolPublicKey.toBuffer()],
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
                totalStaked: stakingPoolData.totalStaked.toString(),
                totalWeight: stakingPoolData.totalWeight.toString(),
                accRewardPerWeight: stakingPoolData.accRewardPerWeight.toString(),
                epochIndex: stakingPoolData.epochIndex.toString(),
                tokenType: stakingPoolData.tokenType.hasOwnProperty('spl') ? TokenType.SPL : TokenType.SOL,
                stakingPoolAddress: stakingPoolPublicKey.toString(),
                stakingEscrowPublicKey: stakingEscrowPublicKey.toString(),
                bump: stakingPoolData.bump.toString(),
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
 * Filters by tokenType to only return stakers for the specified pool
 */
export const getActiveStakers = async (adminPublicKey?: PublicKey, tokenType?: TokenType) => {
    // For backward compatibility, if no params provided, get all stakers
    if (!adminPublicKey || tokenType === undefined) {
        const { program } = getProgram();
        const userStakingAccounts = await program.account.userStakingAccount.all();
        const activeStakers = userStakingAccounts.filter(account => {
            const userData = account.account as UserStakingAccount;
            return userData.stakedAmount.gt(new anchor.BN(0));
        });
        // Return all stakers if no filter provided (old behavior)
        const stakersInfo = activeStakers.map(account => {
            const userData = account.account as UserStakingAccount;
            const tokenDecimals = 9;
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
                weight: userData.weight.toString(),
                rewardDebt: userData.rewardDebt.toString(),
                pendingRewards: userData.pendingRewards.toString(),
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
    }
    
    // New behavior: filter by tokenType
    try {
        const { program } = getProgram();

        // Derive the staking pool PDA for the given tokenType
        const stakingPoolPublicKey = getStakingPoolPDA(adminPublicKey, tokenType);
        
        console.log(`🔹 Filtering stakers for pool: ${stakingPoolPublicKey.toBase58()}`);
        console.log(`🔹 Token Type: ${tokenType === TokenType.SPL ? 'SPL' : 'SOL'}`);

        // Get all program accounts of type UserStakingAccount
        const userStakingAccounts = await program.account.userStakingAccount.all();

        console.log(`🔹 Found ${userStakingAccounts.length} total user staking accounts`);

        // Filter to only accounts that belong to this specific staking pool
        // We check if the account's PDA can be derived from our staking pool
        const poolStakingAccounts = userStakingAccounts.filter(account => {
            try {
                const userData = account.account as UserStakingAccount;
                // Derive what the PDA should be for this pool + owner
                const expectedPDA = getUserStakingPDA(stakingPoolPublicKey, userData.owner);
                // Check if this account matches our expected PDA
                return account.publicKey.equals(expectedPDA);
            } catch {
                return false;
            }
        });

        console.log(`🔹 Found ${poolStakingAccounts.length} staking accounts for this pool`);

        // Filter active stakers (those with staked amount > 0)
        const activeStakers = poolStakingAccounts.filter(account => {
            const userData = account.account as UserStakingAccount;
            return userData.stakedAmount.gt(new anchor.BN(0));
        });

        console.log(`🔹 Active stakers for ${tokenType === TokenType.SPL ? 'SPL' : 'SOL'}: ${activeStakers.length}`);

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
                weight: userData.weight.toString(),
                rewardDebt: userData.rewardDebt.toString(),
                pendingRewards: userData.pendingRewards.toString(),
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