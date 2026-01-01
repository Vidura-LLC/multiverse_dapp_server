
//src/adminDashboard/services.ts

import {
    PublicKey,
    SystemProgram,
    Transaction,
  } from "@solana/web3.js";
  import {
    TOKEN_2022_PROGRAM_ID,
  } from "@solana/spl-token";
  import dotenv from "dotenv";
  import { getProgram } from "../staking/services";
  dotenv.config();
import * as anchor from "@project-serum/anchor";
import { getStakingPoolPDA, getStakingEscrowPDA, getRewardPoolPDA, getRewardEscrowPDA, getTournamentPoolPDA, getPrizePoolPDA, getPrizeEscrowPDA, getPlatformConfigPDA, TokenType } from "../utils/getPDAs";


export interface StakingPoolAccount {
    admin: PublicKey;
    mint: PublicKey;
    totalStaked: anchor.BN;
    totalWeight: anchor.BN;
    accRewardPerWeight: anchor.BN;
    epochIndex: anchor.BN;
    tokenType: {spl?: {} | {sol?: {}}}
    bump: number;
}

export interface RewardPoolAccount {
  admin: PublicKey;
  mint: PublicKey;
  totalFunds: anchor.BN;
  lastDistribution: anchor.BN;
  tokenType: {spl?: {} | {sol?: {}}}
  bump: number;
}

export interface PlatformConfigAccount {
    superAdmin: PublicKey;
    platformWallet: PublicKey;
    developerShareBps: anchor.BN;
    platformShareBps: anchor.BN;
    isInitialized: boolean;
    bump: number;
}
      

  // ✅ Function to initialize the staking pool and escrow account
  export const initializeStakingPoolService = async (
    mintPublicKey: PublicKey,
    tokenType: TokenType = TokenType.SPL,
    adminPublicKey?: PublicKey
  ) => {
    try {
      const { program, connection } = getProgram();
  
      console.log("\n🔄 Creating staking pool initialization transaction...");
      console.log("Token Type:", tokenType === TokenType.SPL ? "SPL" : "SOL");
      console.log("Admin PublicKey:", adminPublicKey.toBase58());
  
      // Get staking pool PDA
      const stakingPoolPublicKey = getStakingPoolPDA(adminPublicKey, tokenType);
      console.log("🔹 Staking Pool PDA Address:", stakingPoolPublicKey.toBase58());
  
      // Get escrow PDA
      const poolEscrowAccountPublicKey = getStakingEscrowPDA(stakingPoolPublicKey);
      console.log("🔹 Pool Escrow Account Address:", poolEscrowAccountPublicKey.toBase58());
  
      const { blockhash } = await connection.getLatestBlockhash("finalized");
      console.log("Latest Blockhash:", blockhash);
  
      // ✅ KEY FIX: For SOL, use SystemProgram as mint
      const actualMint = tokenType === TokenType.SOL 
        ? SystemProgram.programId  // Dummy mint for SOL
        : mintPublicKey;
  
      // Build the transaction
      const tokenTypeArg = tokenType === TokenType.SPL ? {spl: {}} : {sol: {}};
      const transaction = await program.methods
        .initializeAccounts(tokenTypeArg)
        .accounts({
          stakingPool: stakingPoolPublicKey,
          poolEscrowAccount: poolEscrowAccountPublicKey,
          mint: actualMint,  // ✅ Use SystemProgram for SOL
          admin: adminPublicKey,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .transaction();
  
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = adminPublicKey;
  
      return {
        success: true,
        message: "Transaction created successfully!",
        stakingPoolPublicKey: stakingPoolPublicKey.toBase58(),
        poolEscrowAccountPublicKey: poolEscrowAccountPublicKey.toBase58(),
        tokenType: tokenType === TokenType.SPL ? "SPL" : "SOL",
        transaction: transaction.serialize({ requireAllSignatures: false }).toString('base64'),
      };
    } catch (err: any) {
      console.error("❌ Error creating staking pool initialization transaction:", err);
      return {
        success: false,
        message: `Error creating transaction: ${err.message || err}`,
      };
    }
  };
  
    /**
   * Initialize a prize pool for a specific tournament
   * @param tournamentId - The tournament ID
   * @param mintPublicKey - The token mint address
   * @param tokenType - The token type
   * @param adminPublicKey - The admin public key
   * @returns Result object with transaction details and addresses
   */
/**
 * Initialize a prize pool for a specific tournament
 */
export const initializePrizePoolService = async (
  tournamentId: string, 
  mintPublicKey: PublicKey, 
  adminPublicKey: PublicKey, 
  tokenType: TokenType
) => {
  try {
    const { program, connection } = getProgram();

    console.log("Initializing Prize Pool for Tournament:");
    console.log("Tournament ID:", tournamentId);
    console.log("Admin PublicKey:", adminPublicKey.toBase58());
    console.log("Token Type:", tokenType === TokenType.SPL ? "SPL" : "SOL");

    const tournamentPoolPublicKey = getTournamentPoolPDA(adminPublicKey, tournamentId, tokenType);
    console.log("🔹 Tournament Pool PDA Address:", tournamentPoolPublicKey.toString());

    const prizePoolPublicKey = getPrizePoolPDA(tournamentPoolPublicKey);
    console.log("🔹 Prize Pool PDA Address:", prizePoolPublicKey.toString());

    let prizeEscrowPublicKey: PublicKey;
    let finalMintPublicKey: PublicKey;

    if (tokenType === TokenType.SOL) {
      prizeEscrowPublicKey = SystemProgram.programId;
      finalMintPublicKey = SystemProgram.programId;
      console.log("🔹 SOL Prize Pool (no escrow needed)");
    } else {
      prizeEscrowPublicKey = getPrizeEscrowPDA(prizePoolPublicKey);
      finalMintPublicKey = mintPublicKey;
      console.log("🔹 Prize Escrow PDA Address:", prizeEscrowPublicKey.toString());
      console.log("🔹 Mint PublicKey:", mintPublicKey.toBase58());
    }

    const { blockhash } = await connection.getLatestBlockhash("finalized");

    // ✅ Build instruction first, then modify account metas
    const instruction = await program.methods
      .initializePrizePool(tournamentId)
      .accounts({
        prizePool: prizePoolPublicKey,
        tournamentPool: tournamentPoolPublicKey,
        prizeEscrowAccount: prizeEscrowPublicKey,
        mint: finalMintPublicKey,
        creator: adminPublicKey,
        systemProgram: SystemProgram.programId,
        tokenProgram: tokenType === TokenType.SPL ? TOKEN_2022_PROGRAM_ID : SystemProgram.programId,
      })
      .instruction();

    // ✅ For SPL tournaments, ensure prize_escrow_account and mint are writable
    if (tokenType === TokenType.SPL) {
      const escrowAccountIndex = instruction.keys.findIndex(
        key => key.pubkey.equals(prizeEscrowPublicKey)
      );
      if (escrowAccountIndex !== -1) {
        instruction.keys[escrowAccountIndex].isWritable = true;
        console.log("✅ Marked prize_escrow_account as writable");
      }

      const mintAccountIndex = instruction.keys.findIndex(
        key => key.pubkey.equals(finalMintPublicKey)
      );
      if (mintAccountIndex !== -1) {
        instruction.keys[mintAccountIndex].isWritable = true;
        console.log("✅ Marked mint as writable");
      }
    }

    const transaction = new Transaction().add(instruction);

    transaction.recentBlockhash = blockhash;
    transaction.feePayer = adminPublicKey;

    return {
      success: true,
      message: "Transaction created successfully!",
      transaction: transaction.serialize({ requireAllSignatures: false }).toString('base64'),
      prizePool: prizePoolPublicKey.toString(),
      prizeEscrowAccountPublicKey: prizeEscrowPublicKey.toString(),
      tokenType: tokenType === TokenType.SPL ? "SPL" : "SOL",
    };
  } catch (err) {
    console.error("❌ Error initializing prize pool:", err);
    return {
      success: false,
      message: `Error initializing prize pool: ${err.message || err}`
    };
  }
};


  // ✅ Initialize Reward Pool (admin-only)
export const initializeRewardPoolService = async (
  mintPublicKey: PublicKey,
  adminPublicKey: PublicKey,
  tokenType: TokenType = TokenType.SPL
) => {
  try {
    const { program, connection } = getProgram();

    // Derive PDAs
    const rewardPoolPublicKey = getRewardPoolPDA(adminPublicKey, tokenType);

    const rewardEscrowPublicKey = getRewardEscrowPDA(rewardPoolPublicKey);
    const actualMint = tokenType === TokenType.SOL 
      ? SystemProgram.programId  // Dummy mint for SOL
      : mintPublicKey;

    const tokenTypeArg = tokenType === TokenType.SPL ? {spl: {}} : {sol: {}};
    // Build unsigned tx
    const { blockhash } = await connection.getLatestBlockhash("finalized");
    const transaction = await program.methods
      .initializeRewardPool(tokenTypeArg)
      .accounts({
        rewardPool: rewardPoolPublicKey,
        rewardEscrowAccount: rewardEscrowPublicKey,
        mint: actualMint,
        admin: adminPublicKey,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .transaction();

    transaction.recentBlockhash = blockhash;
    transaction.feePayer = adminPublicKey;

    return {
      success: true,
      message: "Transaction created successfully!",
      rewardPool: rewardPoolPublicKey.toBase58(),
      rewardEscrow: rewardEscrowPublicKey.toBase58(),
      transaction: transaction.serialize({ requireAllSignatures: false }).toString("base64"),
      tokenType: tokenType === TokenType.SPL ? "SPL" : "SOL",
    };
  } catch (err: any) {
    console.error("❌ Error creating initializeRewardPool tx:", err);
    return { success: false, message: `Error creating tx: ${err.message || err}` };
  }
};

  
 // ✅ Function to check pool status for staking and reward pools
 // Uses super admin from platform config (pools are global)
 export const checkPoolStatus = async (tokenType: TokenType) => {
  try {
      const { program } = getProgram();

      // Get super admin from platform config (pools are global, initialized by super admin)
      const platformConfig = await getPlatformConfigService();
      if (!platformConfig.success || !platformConfig.data) {
          return {
              success: false,
              message: 'Platform config not initialized. Please initialize platform config first.'
          };
      }

      const superAdminPublicKey = new PublicKey(platformConfig.data.superAdmin);
      console.log("🔹 Using Super Admin for pool check:", superAdminPublicKey.toString());

      const result = {
          success: true,
          stakingPool: {
              status: false, // false = needs initialization, true = exists
              tokenType: null as string | null,
          },
          rewardPool: {
            status: false, // false = needs initialization, true = exists
            tokenType: null as string | null,
        },
          adminAddress: superAdminPublicKey.toString()
      };

      // ✅ 1. Check Staking Pool (using super admin)
      const stakingPoolPublicKey = getStakingPoolPDA(superAdminPublicKey, tokenType);
      console.log("🔹 Checking Staking Pool PDA:", stakingPoolPublicKey.toString());

      const stakingPoolAccount = await program.account.stakingPool.fetchNullable(stakingPoolPublicKey) as StakingPoolAccount | null;

      result.stakingPool = {
          status: stakingPoolAccount !== null,
          tokenType: stakingPoolAccount ? 
            (stakingPoolAccount.tokenType.hasOwnProperty('spl') ? 'SPL' : 'SOL') : 
            null,
      };

      // ✅ 2. Check Reward Pool (using super admin)
      const rewardPoolPublicKey = getRewardPoolPDA(superAdminPublicKey, tokenType);

    console.log("🔹 Checking Reward Pool PDA:", rewardPoolPublicKey.toString());

    const rewardPoolAccount = await program.account.rewardPool.fetchNullable(rewardPoolPublicKey) as RewardPoolAccount | null;

    result.rewardPool = {
        status: rewardPoolAccount !== null,
        tokenType: rewardPoolAccount ? 
          (rewardPoolAccount.tokenType.hasOwnProperty('spl') ? 'SPL' : 'SOL') : 
          null,
    }

      return result;

  } catch (err: any) {
      console.error("❌ Error checking pool status:", err);
      return {
          success: false,
          message: `Error checking pool status: ${err.message || err}`
      };
  }
};

// ==============================
// PLATFORM CONFIGURATION SERVICES
// ==============================

/**
 * Initialize platform configuration (super admin only, one-time)
 * Sets the revenue share split between developers and platform
 */
export const initializePlatformConfigService = async (
  superAdminPublicKey: PublicKey,
  platformWalletPublicKey: PublicKey,
  developerShareBps: number = 9000,
  platformShareBps: number = 1000
) => {
  try {
    const { program, connection } = getProgram();
    const platformConfigPDA = getPlatformConfigPDA();

    // Validate shares sum to 10000 (100%)
    if (developerShareBps + platformShareBps !== 10000) {
      return {
        success: false,
        message: `Share percentages must sum to 10000 (100%). Current total: ${developerShareBps + platformShareBps}`
      };
    }

    // Validate share ranges
    if (developerShareBps < 0 || developerShareBps > 10000 || 
        platformShareBps < 0 || platformShareBps > 10000) {
      return {
        success: false,
        message: "Share percentages must be between 0 and 10000"
      };
    }

    console.log("Initializing Platform Config:");
    console.log("🔹 Platform Config PDA:", platformConfigPDA.toString());
    console.log("🔹 Super Admin:", superAdminPublicKey.toString());
    console.log("🔹 Platform Wallet:", platformWalletPublicKey.toString());
    console.log(`🔹 Developer Share: ${developerShareBps / 100}%`);
    console.log(`🔹 Platform Share: ${platformShareBps / 100}%`);

    const instruction = await program.methods
      .initializePlatformConfig(developerShareBps, platformShareBps)
      .accounts({
        platformConfig: platformConfigPDA,
        platformWallet: platformWalletPublicKey,
        superAdmin: superAdminPublicKey,
        systemProgram: SystemProgram.programId,
      })
      .instruction();

    const transaction = new Transaction().add(instruction);
    const { blockhash } = await connection.getLatestBlockhash("finalized");
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = superAdminPublicKey;

    return {
      success: true,
      message: "Platform config initialization transaction prepared",
      platformConfigPDA: platformConfigPDA.toString(),
      transaction: transaction.serialize({ requireAllSignatures: false }).toString('base64')
    };
  } catch (error: any) {
    console.error("❌ Error initializing platform config:", error);
    return { 
      success: false, 
      message: `Error initializing platform config: ${error.message || error}` 
    };
  }
};

/**
 * Update platform configuration (super admin only)
 * Allows adjusting the revenue share percentages
 */
export const updatePlatformConfigService = async (
  superAdminPublicKey: PublicKey,
  developerShareBps: number,
  platformShareBps: number
) => {
  try {
    const { program, connection } = getProgram();
    const platformConfigPDA = getPlatformConfigPDA();

    // Validate shares sum to 10000 (100%)
    if (developerShareBps + platformShareBps !== 10000) {
      return {
        success: false,
        message: `Share percentages must sum to 10000 (100%). Current total: ${developerShareBps + platformShareBps}`
      };
    }

    // Validate share ranges
    if (developerShareBps < 0 || developerShareBps > 10000 || 
        platformShareBps < 0 || platformShareBps > 10000) {
      return {
        success: false,
        message: "Share percentages must be between 0 and 10000"
      };
    }

    console.log("Updating Platform Config:");
    console.log("🔹 Platform Config PDA:", platformConfigPDA.toString());
    console.log("🔹 Super Admin:", superAdminPublicKey.toString());
    console.log(`🔹 Developer Share: ${developerShareBps / 100}%`);
    console.log(`🔹 Platform Share: ${platformShareBps / 100}%`);

    const instruction = await program.methods
      .updatePlatformConfig(developerShareBps, platformShareBps)
      .accounts({
        platformConfig: platformConfigPDA,
        superAdmin: superAdminPublicKey,
      })
      .instruction();

    const transaction = new Transaction().add(instruction);
    const { blockhash } = await connection.getLatestBlockhash("finalized");
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = superAdminPublicKey;

    return {
      success: true,
      message: "Platform config update transaction prepared",
      transaction: transaction.serialize({ requireAllSignatures: false }).toString('base64')
    };
  } catch (error: any) {
    console.error("❌ Error updating platform config:", error);
    return { 
      success: false, 
      message: `Error updating platform config: ${error.message || error}` 
    };
  }
};

/**
 * Update platform wallet (super admin only)
 */
export const updatePlatformWalletService = async (
  superAdminPublicKey: PublicKey,
  newPlatformWalletPublicKey: PublicKey
) => {
  try {
    const { program, connection } = getProgram();
    const platformConfigPDA = getPlatformConfigPDA();

    console.log("Updating Platform Wallet:");
    console.log("🔹 Platform Config PDA:", platformConfigPDA.toString());
    console.log("🔹 Super Admin:", superAdminPublicKey.toString());
    console.log("🔹 New Platform Wallet:", newPlatformWalletPublicKey.toString());

    const instruction = await program.methods
      .updatePlatformWallet()
      .accounts({
        platformConfig: platformConfigPDA,
        newPlatformWallet: newPlatformWalletPublicKey,
        superAdmin: superAdminPublicKey,
      })
      .instruction();

    const transaction = new Transaction().add(instruction);
    const { blockhash } = await connection.getLatestBlockhash("finalized");
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = superAdminPublicKey;

    return {
      success: true,
      message: "Platform wallet update transaction prepared",
      transaction: transaction.serialize({ requireAllSignatures: false }).toString('base64')
    };
  } catch (error: any) {
    console.error("❌ Error updating platform wallet:", error);
    return { 
      success: false, 
      message: `Error updating platform wallet: ${error.message || error}` 
    };
  }
};

/**
 * Transfer super admin role (super admin only)
 */
export const transferSuperAdminService = async (
  superAdminPublicKey: PublicKey,
  newSuperAdminPublicKey: PublicKey
) => {
  try {
    const { program, connection } = getProgram();
    const platformConfigPDA = getPlatformConfigPDA();

    console.log("Transferring Super Admin:");
    console.log("🔹 Platform Config PDA:", platformConfigPDA.toString());
    console.log("🔹 Current Super Admin:", superAdminPublicKey.toString());
    console.log("🔹 New Super Admin:", newSuperAdminPublicKey.toString());

    const instruction = await program.methods
      .transferSuperAdmin()
      .accounts({
        platformConfig: platformConfigPDA,
        newSuperAdmin: newSuperAdminPublicKey,
        superAdmin: superAdminPublicKey,
      })
      .instruction();

    const transaction = new Transaction().add(instruction);
    const { blockhash } = await connection.getLatestBlockhash("finalized");
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = superAdminPublicKey;

    return {
      success: true,
      message: "Super admin transfer transaction prepared",
      transaction: transaction.serialize({ requireAllSignatures: false }).toString('base64')
    };
  } catch (error: any) {
    console.error("❌ Error transferring super admin:", error);
    return { 
      success: false, 
      message: `Error transferring super admin: ${error.message || error}` 
    };
  }
};

/**
 * Get platform configuration
 */
export const getPlatformConfigService = async () => {
  try {
    const { program } = getProgram();
    const platformConfigPDA = getPlatformConfigPDA();
    
    const config = (await program.account.platformConfig.fetch(platformConfigPDA)) as PlatformConfigAccount;

    return {
      success: true,
      data: {
        superAdmin: config.superAdmin.toString(),
        platformWallet: config.platformWallet.toString(),
        developerShareBps: Number(config.developerShareBps),
        platformShareBps: Number(config.platformShareBps),
        developerSharePercent: Number(config.developerShareBps) / 100,
        platformSharePercent: Number(config.platformShareBps) / 100,
        isInitialized: config.isInitialized,
        bump: config.bump,
      } as {
        superAdmin: string;
        platformWallet: string;
        developerShareBps: number;
        platformShareBps: number;
        developerSharePercent: number;
        platformSharePercent: number;
        isInitialized: boolean;
        bump: number;
      }
    };
  } catch (error: any) {
    console.error("❌ Error fetching platform config:", error);
    return { 
      success: false, 
      message: `Error fetching platform config: ${error.message || error}`,
      data: null as null
    };
  }
};


