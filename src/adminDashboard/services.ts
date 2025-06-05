
//src/adminDashboard/services.ts

import {
  PublicKey,
  SystemProgram,
} from "@solana/web3.js";
import {
  TOKEN_2022_PROGRAM_ID,
} from "@solana/spl-token";
import { bs58 } from "@project-serum/anchor/dist/cjs/utils/bytes";
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


// ✅ Function to check pool status for staking, revenue, and prize pools
export const checkPoolStatus = async (adminPublicKey: PublicKey, tournamentId?: string) => {
    try {
        const { program } = getProgram();

        const result = {
            success: true,
            stakingPool: {
                status: false, // false = needs initialization, true = exists
                stakingPoolAddress: '',
                poolEscrowAccountAddress: '',
            },
            revenuePool: {
                status: false, // false = needs initialization, true = exists
                revenuePoolAddress: '',
                revenueEscrowAccountAddress: '',
            },
            adminAddress: adminPublicKey.toString()
        };

        // ✅ 1. Check Staking Pool
        const [stakingPoolPublicKey] = PublicKey.findProgramAddressSync(
            [Buffer.from("staking_pool"), adminPublicKey.toBuffer()],
            program.programId
        );

        const [stakingEscrowAccountPublicKey] = PublicKey.findProgramAddressSync(
            [Buffer.from("escrow"), stakingPoolPublicKey.toBuffer()],
            program.programId
        );

        console.log("🔹 Checking Staking Pool PDA:", stakingPoolPublicKey.toString());

        const stakingPoolAccount = await program.account.stakingPool.fetchNullable(stakingPoolPublicKey);

        result.stakingPool = {
            status: stakingPoolAccount !== null,
            stakingPoolAddress: stakingPoolPublicKey.toString(),
            poolEscrowAccountAddress: stakingEscrowAccountPublicKey.toString(),
        };

        // ✅ 2. Check Revenue Pool
        const [revenuePoolPublicKey] = PublicKey.findProgramAddressSync(
            [Buffer.from("revenue_pool"), adminPublicKey.toBuffer()],
            program.programId
        );

        const [revenueEscrowAccountPublicKey] = PublicKey.findProgramAddressSync(
            [Buffer.from("revenue_escrow"), revenuePoolPublicKey.toBuffer()],
            program.programId
        );

        console.log("🔹 Checking Revenue Pool PDA:", revenuePoolPublicKey.toString());

        const revenuePoolAccount = await program.account.revenuePool.fetchNullable(revenuePoolPublicKey);

        result.revenuePool = {
            status: revenuePoolAccount !== null,
            revenuePoolAddress: revenuePoolPublicKey.toString(),
            revenueEscrowAccountAddress: revenueEscrowAccountPublicKey.toString(),

        }

        return result;

    } catch (err) {
        console.error("❌ Error checking pool status:", err);
        return {
            success: false,
            message: `Error checking pool status: ${err.message || err}`
        };
    }
};


// ✅ Function to initialize the staking pool and escrow account
export const initializeStakingPoolService = async (mintPublicKey: PublicKey, adminPublicKey: PublicKey) => {
    try {
        const { program, connection } = getProgram();

        // ✅ Staking pool doesn't exist - create initialization transaction
        console.log("🔄 Creating staking pool initialization transaction...");
        
        console.log("Admin PublicKey:", adminPublicKey.toBase58());

        const [stakingPoolPublicKey] = PublicKey.findProgramAddressSync(
            [Buffer.from("staking_pool"), adminPublicKey.toBuffer()],
            program.programId
        );

        const [poolEscrowAccountPublicKey] = PublicKey.findProgramAddressSync(
            [Buffer.from("escrow"), stakingPoolPublicKey.toBuffer()],
            program.programId
        );

        console.log("🔹 Staking Pool PDA Address:", stakingPoolPublicKey.toString());
        console.log("🔹 Pool Escrow Account Address:", poolEscrowAccountPublicKey.toString());




        
        // Get the latest blockhash
        const { blockhash } = await connection.getLatestBlockhash("finalized");
        console.log("Latest Blockhash:", blockhash);

        // Create the transaction
        const transaction = await program.methods
            .initializeAccounts()
            .accounts({
                admin: adminPublicKey,
                stakingPool: stakingPoolPublicKey,
                mint: mintPublicKey,
                poolEscrowAccount: poolEscrowAccountPublicKey,
                systemProgram: SystemProgram.programId,
                tokenProgram: TOKEN_2022_PROGRAM_ID,
            })
            .transaction();

        // Set recent blockhash and fee payer
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = adminPublicKey;

        // Serialize transaction and send it to the frontend
        return {
            success: true,
            message: "Transaction created successfully!",
            stakingPoolPublicKey: stakingPoolPublicKey.toBase58(),
            poolEscrowAccountPublicKey: poolEscrowAccountPublicKey.toBase58(),
            transaction: transaction.serialize({ requireAllSignatures: false }).toString("base64"),
        };
    } catch (err) {
        console.error("❌ Error initializing staking pool:", err);
        return {
            success: false,
            message: `Error initializing staking pool: ${err.message || err}`
        };
    }
};

/**
 * Initialize the global revenue pool
 * @param mintPublicKey - The token mint address
 * @returns Result object with transaction details and addresses
 */
export const initializeRevenuePoolService = async (mintPublicKey: PublicKey, adminPublicKey: PublicKey) => {
    try {
        const { program, connection } = getProgram();

        // Log initial parameters for clarity
        console.log("Initializing Revenue Pool:");
        console.log("Admin PublicKey:", adminPublicKey.toBase58());
        console.log("Mint PublicKey:", mintPublicKey.toBase58());

        // Derive the PDA for the revenue pool
        const [revenuePoolPublicKey] = PublicKey.findProgramAddressSync(
            [Buffer.from("revenue_pool"), adminPublicKey.toBuffer()],
            program.programId
        );

        // Derive the PDA for the revenue escrow account
        const [revenueEscrowPublicKey] = PublicKey.findProgramAddressSync(
            [Buffer.from("revenue_escrow"), revenuePoolPublicKey.toBuffer()],
            program.programId
        );

        console.log("🔹 Revenue Pool PDA Address:", revenuePoolPublicKey.toString());
        console.log("🔹 Revenue Escrow PDA Address:", revenueEscrowPublicKey.toString());

        // Get the latest blockhash
        const { blockhash } = await connection.getLatestBlockhash("finalized");
        console.log("Latest Blockhash:", blockhash);

        // Create the transaction
        const transaction = await program.methods
            .initializeRevenuePool()
            .accounts({
                revenuePool: revenuePoolPublicKey,
                revenueEscrowAccount: revenueEscrowPublicKey,
                mint: mintPublicKey,
                admin: adminPublicKey,
                systemProgram: anchor.web3.SystemProgram.programId,
                tokenProgram: TOKEN_2022_PROGRAM_ID,
            })
            .transaction();

        // Set recent blockhash and fee payer
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = adminPublicKey;

        // Serialize transaction and send it to the frontend
        return {
            success: true,
            message: "Transaction created successfully!",
            transaction: transaction.serialize({ requireAllSignatures: false }).toString('base64'),
        };
    } catch (err) {
        console.error("❌ Error initializing revenue pool:", err);
        return {
            success: false,
            message: `Error initializing revenue pool: ${err.message || err}`
        };
    }
};

/**
* Get the staking pool data from the blockchain
*/
export const getStakingPoolData = async () => {
    try {
        const { program, adminPublicKey } = getProgram();

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
        const { program, connection } = getProgram();

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
                stakeTimestamp: userData.stakeTimestamp.toString(),
                lockDuration: userData.lockDuration.toString(),
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
export const getStakingStats = async () => {
    try {
        console.log("📊 Fetching comprehensive staking statistics...");

        // Fetch all data in parallel
        const [poolResult, stakersResult, apyResult] = await Promise.all([
            getStakingPoolData(),
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

        return {
            success: true,
            data: {
                totalStaked: {
                    raw: poolResult.data.totalStaked,
                    formatted: totalStakedReadable.toLocaleString(),
                    readable: totalStakedReadable
                },
                activeStakers: stakersResult.data.activeStakersCount,
                totalStakers: stakersResult.data.totalStakers,
                currentAPY: apyResult.data.currentAPY,
                apyBreakdown: {
                    baseAPY: apyResult.data.baseAPY,
                    tournamentBonusAPY: apyResult.data.tournamentBonusAPY
                },
                stakingPoolAddress: poolResult.data.stakingPoolAddress,
                mintAddress: poolResult.data.mint,
                lastUpdated: new Date().toISOString()
            }
        };
    } catch (err) {
        console.error("❌ Error fetching staking statistics:", err);
        return {
            success: false,
            message: `Error fetching staking statistics: ${err.message || err}`
        };
    }
};