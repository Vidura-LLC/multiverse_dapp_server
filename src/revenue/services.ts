import {
    Connection,
    PublicKey,
    ComputeBudgetProgram,
    Transaction,
    SystemProgram
  } from "@solana/web3.js";
  import * as anchor from "@project-serum/anchor";
  import {
    getAssociatedTokenAddressSync,
    TOKEN_2022_PROGRAM_ID,
  } from "@solana/spl-token";
  import dotenv from "dotenv";
  import { ref, get } from "firebase/database";
  import { db } from "../config/firebase";
import { getTournamentPool } from "../gamehub/services";
import { getProgram } from "../staking/services";
import { getPlatformConfigPDA, getPrizeEscrowPDA, getPrizePoolPDA, getRewardEscrowPDA, getRewardPoolPDA, getStakingPoolPDA, getTournamentEscrowPDA, getTournamentPoolPDA, TokenType } from "../utils/getPDAs";
import { PlatformConfigAccount } from "../adminDashboard/services";
dotenv.config();

// Default percentage splits based on updated requirements
export const DEFAULT_SPLITS = {
  PRIZE_POOL: 40,    // 40% to tournament's prize pool
  REVENUE_POOL: 50,  // 50% to global revenue pool
  STAKING_REWARD_POOL: 5,   // 5% to reward pool
  BURN: 5            // 5% to burn (2.5% Kaya and 2.5% CRD)
};

  
/**
 * Distribute tournament revenue according to the specified percentages
 */
export const distributeTournamentRevenueService = async (
  tournamentId: string,
  prizePercentage: number = DEFAULT_SPLITS.PRIZE_POOL,
  revenuePercentage: number = DEFAULT_SPLITS.REVENUE_POOL,
  stakingPercentage: number = DEFAULT_SPLITS.STAKING_REWARD_POOL,
  burnPercentage: number = DEFAULT_SPLITS.BURN,
  adminPublicKey: PublicKey,
  tokenType: TokenType
) => {
  try {
    const { program, connection } = getProgram();

    // 1. Verify tournament in Firebase
    console.log("Verifying tournament in Firebase...");
    const tournamentRef = ref(db, `tournaments/${tokenType}/${tournamentId}`);
    const tournamentSnapshot = await get(tournamentRef);
    
    if (!tournamentSnapshot.exists()) {
      return {
        success: false,
        message: `Tournament with ID ${tournamentId} not found in database`
      };
    }
    
    const tournament = tournamentSnapshot.val();
    
    if (tournament.status !== "Active" && tournament.status !== "Ended") {
      return {
        success: false,
        message: `Tournament cannot be distributed because it is in '${tournament.status}' status`
      };
    }

    if (tournament.distributionCompleted) {
      return {
        success: false,
        message: "Tournament revenue has already been distributed"
      };
    }

    // 2. Get platform config for wallet addresses
    console.log("Fetching platform config...");
    const platformConfigPDA = getPlatformConfigPDA();
    let platformConfig;
    try {
      platformConfig = await program.account.platformConfig.fetch(platformConfigPDA) as PlatformConfigAccount;
      console.log("🔹 Platform Config PDA:", platformConfigPDA.toString());
      console.log("🔹 Developer Share BPS:", platformConfig.developerShareBps.toString());
      console.log("🔹 Platform Share BPS:", platformConfig.platformShareBps.toString());
      console.log("🔹 Platform Wallet:", platformConfig.platformWallet.toString());
    } catch (error) {
      return {
        success: false,
        message: `Platform config not initialized. Please initialize platform config first. Error: ${error.message || error}`
      };
    }

    // 3. Derive all necessary PDAs
    console.log("Deriving program addresses...");
    const tournamentPoolPublicKey = getTournamentPoolPDA(adminPublicKey, tournamentId, tokenType);
    console.log("🔹 Tournament Pool PDA:", tournamentPoolPublicKey.toString());

    const prizePoolPublicKey = getPrizePoolPDA(tournamentPoolPublicKey);
    console.log("🔹 Prize Pool PDA:", prizePoolPublicKey.toString());

    const stakingPoolPublicKey = getStakingPoolPDA(adminPublicKey, tokenType);
    console.log("🔹 Staking Pool PDA:", stakingPoolPublicKey.toString());

    const rewardPoolPublicKey = getRewardPoolPDA(adminPublicKey, tokenType);
    console.log("🔹 Reward Pool PDA:", rewardPoolPublicKey.toString());

    // 4. Fetch tournament data from blockchain
    console.log("Fetching tournament data from blockchain...");
    const tournamentPoolResult = await getTournamentPool(tournamentId, adminPublicKey, tokenType);
    
    if (!tournamentPoolResult.success) {
      return {
        success: false,
        message: `Failed to fetch tournament data: ${tournamentPoolResult.message || "Unknown error"}`
      };
    }
    
    const tournamentPoolData = tournamentPoolResult.data;
    const totalFunds = Number(tournamentPoolData.totalFunds);
    
    console.log("🔹 Total Tournament Funds:", totalFunds);
    
    if (totalFunds <= 0) {
      return {
        success: false,
        message: "Tournament has no funds to distribute"
      };
    }

    // 5. Set up developer and platform wallets
    // Developer wallet = tournament creator (adminPublicKey)
    const developerWallet = adminPublicKey;
    const platformWallet = platformConfig.platformWallet as PublicKey;
    console.log("🔹 Developer Wallet:", developerWallet.toString());
    console.log("🔹 Platform Wallet:", platformWallet.toString());

    // 6. Determine accounts based on token type
    let mintPublicKey: PublicKey;
    let tournamentEscrowPublicKey: PublicKey;
    let prizeEscrowPublicKey: PublicKey;
    let rewardEscrowPublicKey: PublicKey;
    let tokenProgramId: PublicKey;

    // Token accounts for developer and platform (for SPL only)
    let developerTokenAccount: PublicKey = SystemProgram.programId;
    let platformTokenAccount: PublicKey = SystemProgram.programId;

    if (tokenType === TokenType.SOL) {
      mintPublicKey = SystemProgram.programId;
      tournamentEscrowPublicKey = SystemProgram.programId;
      prizeEscrowPublicKey = SystemProgram.programId;
      rewardEscrowPublicKey = SystemProgram.programId;
      tokenProgramId = SystemProgram.programId;
      
      console.log("🔹 Token Type: SOL (no escrow accounts needed)");
      console.log("   Distribution via System Program transfers");
    } else {
      mintPublicKey = new PublicKey(tournamentPoolData.mint);
      tournamentEscrowPublicKey = getTournamentEscrowPDA(tournamentPoolPublicKey);
      prizeEscrowPublicKey = getPrizeEscrowPDA(prizePoolPublicKey);
      rewardEscrowPublicKey = getRewardEscrowPDA(rewardPoolPublicKey);
      tokenProgramId = TOKEN_2022_PROGRAM_ID;
      
      // Get associated token accounts for developer and platform
      developerTokenAccount = getAssociatedTokenAddressSync(
        mintPublicKey,
        developerWallet,
        false,
        TOKEN_2022_PROGRAM_ID
      );
      platformTokenAccount = getAssociatedTokenAddressSync(
        mintPublicKey,
        platformWallet,
        false,
        TOKEN_2022_PROGRAM_ID
      );
      
      console.log("🔹 Token Type: SPL");
      console.log("🔹 Token Mint:", mintPublicKey.toString());
      console.log("🔹 Tournament Escrow:", tournamentEscrowPublicKey.toString());
      console.log("🔹 Prize Escrow:", prizeEscrowPublicKey.toString());
      console.log("🔹 Reward Escrow:", rewardEscrowPublicKey.toString());
      console.log("🔹 Developer Token Account:", developerTokenAccount.toString());
      console.log("🔹 Platform Token Account:", platformTokenAccount.toString());
    }

    // 7. Validate percentages
    const totalPercentage = prizePercentage + revenuePercentage + stakingPercentage + burnPercentage;
    if (totalPercentage !== 100) {
      return {
        success: false,
        message: `Percentages must add up to 100. Current total: ${totalPercentage}%`
      };
    }

    console.log("📊 Distribution Percentages:");
    console.log(`   Prize Pool: ${prizePercentage}%`);
    console.log(`   Revenue Pool: ${revenuePercentage}%`);
    console.log(`   Staking Rewards: ${stakingPercentage}%`);
    console.log(`   Burn: ${burnPercentage}%`);

    // 8. Create transaction with compute budget
    console.log("Creating distribution transaction...");
    
    const computeBudgetInstruction = ComputeBudgetProgram.setComputeUnitLimit({
      units: 400_000,
    });

    const distributionInstruction = await program.methods
      .distributeTournamentRevenue(
        tournamentId,
        prizePercentage,
        revenuePercentage,
        stakingPercentage,
        burnPercentage
      )
      .accounts({
        creator: adminPublicKey,
        tournamentPool: tournamentPoolPublicKey,
        platformConfig: platformConfigPDA,
        prizePool: prizePoolPublicKey,
        rewardPool: rewardPoolPublicKey,
        stakingPool: stakingPoolPublicKey,
        developerWallet: developerWallet,
        platformWallet: platformWallet,
        developerTokenAccount: developerTokenAccount,
        platformTokenAccount: platformTokenAccount,
        tournamentEscrowAccount: tournamentEscrowPublicKey,
        prizeEscrowAccount: prizeEscrowPublicKey,
        rewardEscrowAccount: rewardEscrowPublicKey,
        mint: mintPublicKey,
        tokenProgram: tokenProgramId,
        systemProgram: SystemProgram.programId,
      })
      .instruction();

    // ✅ CRITICAL: Ensure recipient pools are NOT signers (they receive funds, don't sign)
    console.log("🔧 Adjusting account properties for distribution...");

    const nonSignerAccounts = [
      { pubkey: prizePoolPublicKey, name: 'prize_pool' },
      { pubkey: rewardPoolPublicKey, name: 'reward_pool' }
    ];

    nonSignerAccounts.forEach(({ pubkey, name }) => {
      const accountIndex = distributionInstruction.keys.findIndex(
        key => key.pubkey.equals(pubkey)
      );
      if (accountIndex !== -1) {
        distributionInstruction.keys[accountIndex].isSigner = false;
        distributionInstruction.keys[accountIndex].isWritable = true;
        console.log(`   ✅ Marked ${name} as non-signer and writable`);
      }
    });

    // Additional writable accounts
    const writableAccountsBase = [
      { pubkey: tournamentPoolPublicKey, name: 'tournament_pool' },
      { pubkey: stakingPoolPublicKey, name: 'staking_pool' }
    ];

    let writableAccounts = [...writableAccountsBase];

    if (tokenType === TokenType.SPL) {
      writableAccounts = [
        ...writableAccounts,
        { pubkey: tournamentEscrowPublicKey, name: 'tournament_escrow' },
        { pubkey: prizeEscrowPublicKey, name: 'prize_escrow' },
        { pubkey: rewardEscrowPublicKey, name: 'reward_escrow' },
        { pubkey: developerTokenAccount, name: 'developer_token_account' },
        { pubkey: platformTokenAccount, name: 'platform_token_account' },
        { pubkey: mintPublicKey, name: 'mint' }
      ];
    } else {
      // For SOL, mark developer and platform wallets as writable
      writableAccounts = [
        ...writableAccounts,
        { pubkey: developerWallet, name: 'developer_wallet' },
        { pubkey: platformWallet, name: 'platform_wallet' }
      ];
    }

    writableAccounts.forEach(({ pubkey, name }) => {
      const accountIndex = distributionInstruction.keys.findIndex(
        key => key.pubkey.equals(pubkey)
      );
      if (accountIndex !== -1) {
        distributionInstruction.keys[accountIndex].isWritable = true;
        console.log(`   ✅ Marked ${name} as writable`);
      } else {
        console.log(`   ⚠️ Warning: ${name} account not found in instruction`);
      }
    });

    // Create transaction with both instructions
    const transaction = new Transaction()
      .add(computeBudgetInstruction)
      .add(distributionInstruction);

    // Set transaction metadata
    const { blockhash } = await connection.getLatestBlockhash("finalized");
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = adminPublicKey;

    // Calculate distribution amounts for response
    const prizeAmount = Math.floor((totalFunds * prizePercentage) / 100);
    const revenueAmount = Math.floor((totalFunds * revenuePercentage) / 100);
    const stakingAmount = Math.floor((totalFunds * stakingPercentage) / 100);
    const burnAmount = Math.floor((totalFunds * burnPercentage) / 100);

    // Calculate developer and platform shares from revenue
    const developerShareBps = Number(platformConfig.developerShareBps);
    const platformShareBps = Number(platformConfig.platformShareBps);
    const developerShare = Math.floor((revenueAmount * developerShareBps) / 10000);
    const platformShare = revenueAmount - developerShare;

    console.log("💰 Distribution Breakdown:");
    console.log(`   Prize Pool: ${prizeAmount}`);
    console.log(`   Revenue Split:`);
    console.log(`     Developer (${developerShareBps / 100}%): ${developerShare}`);
    console.log(`     Platform (${platformShareBps / 100}%): ${platformShare}`);
    console.log(`   Staking Rewards: ${stakingAmount}`);
    console.log(`   Burn: ${burnAmount}`);
    console.log(`   Total: ${prizeAmount + revenueAmount + stakingAmount + burnAmount}`);

    return {
      success: true,
      message: "Tournament revenue distribution transaction created successfully!",
      tournamentId,
      transaction: transaction.serialize({ requireAllSignatures: false }).toString('base64'),
      distribution: {
        totalFunds,
        prizeAmount,
        revenueAmount,
        developerShare,
        platformShare,
        stakingAmount,
        burnAmount
      },
      tournamentRef: tournamentRef.toString(),
      status: "Pending Signature",
      tokenType: tokenType === TokenType.SOL ? "SOL" : "SPL"
    };
  } catch (err) {
    console.error("❌ Error distributing tournament revenue:", err);
    return {
      success: false,
      message: `Error distributing tournament revenue: ${err.message || err}`
    };
  }
};
/**
 * Prepares an unsigned transaction to distribute prizes to tournament winners
 * @param tournamentId - The ID of the tournament
 * @param firstPlacePublicKey - Public key of the first place winner
 * @param secondPlacePublicKey - Public key of the second place winner
 * @param thirdPlacePublicKey - Public key of the third place winner
 * @param adminPublicKey - The admin's public key who will sign the transaction
 * @returns Result object with unsigned transaction for frontend signing
 */
export const distributeTournamentPrizesService = async (
  tournamentId: string,
  firstPlacePublicKey: PublicKey,
  secondPlacePublicKey: PublicKey,
  thirdPlacePublicKey: PublicKey,
  adminPublicKey: PublicKey,
  tokenType: TokenType
) => {
  try {
    const { program, connection } = getProgram();

    console.log("Preparing prize distribution for tournament:", tournamentId);
    console.log("Token Type:", tokenType === TokenType.SOL ? "SOL" : "SPL");
    console.log("Winners:");
    console.log("1st Place:", firstPlacePublicKey.toString());
    console.log("2nd Place:", secondPlacePublicKey.toString());
    console.log("3rd Place:", thirdPlacePublicKey.toString());

    // 1. Verify tournament in Firebase (use correct path with tokenType)
    console.log("Verifying tournament in Firebase...");
    const tournamentRef = ref(db, `tournaments/${tokenType}/${tournamentId}`);
    const tournamentSnapshot = await get(tournamentRef);
    
    if (!tournamentSnapshot.exists()) {
      return {
        success: false,
        message: `Tournament with ID ${tournamentId} not found in database`
      };
    }
    
    const tournament = tournamentSnapshot.val();
    
    // Check if prizes have already been distributed
    if (tournament.prizesDistributed) {
      return {
        success: false,
        message: "Tournament prizes have already been distributed"
      };
    }

    // Check if the tournament revenue has been distributed (required before prize distribution)
    if (!tournament.distributionCompleted) {
      return {
        success: false,
        message: "Tournament revenue must be distributed before prizes can be distributed"
      };
    }

    // 2. Derive all the necessary PDAs
    console.log("Deriving program addresses...");
    const tournamentPoolPublicKey = getTournamentPoolPDA(adminPublicKey, tournamentId, tokenType);
    console.log("🔹 Tournament Pool PDA:", tournamentPoolPublicKey.toString());

    const prizePoolPublicKey = getPrizePoolPDA(tournamentPoolPublicKey);
    console.log("🔹 Prize Pool PDA:", prizePoolPublicKey.toString());

    // 3. Get tournament data from blockchain
    const tournamentPoolResult = await getTournamentPool(tournamentId, adminPublicKey, tokenType);
    if (!tournamentPoolResult.success) {
      return {
        success: false,
        message: `Failed to fetch tournament data: ${tournamentPoolResult.message || "Unknown error"}`
      };
    }

    // 4. Prepare accounts based on token type
    let mintPublicKey: PublicKey;
    let prizeEscrowPublicKey: PublicKey;
    let firstPlaceTokenAccount: PublicKey;
    let secondPlaceTokenAccount: PublicKey;
    let thirdPlaceTokenAccount: PublicKey;
    let tokenProgramId: PublicKey;

    if (tokenType === TokenType.SOL) {
      // For SOL, use SystemProgram as dummy values
      mintPublicKey = SystemProgram.programId;
      prizeEscrowPublicKey = SystemProgram.programId;
      firstPlaceTokenAccount = SystemProgram.programId;
      secondPlaceTokenAccount = SystemProgram.programId;
      thirdPlaceTokenAccount = SystemProgram.programId;
      tokenProgramId = SystemProgram.programId;
      
      console.log("🔹 Token Type: SOL (winners receive lamports directly)");
    } else {
      // For SPL, derive actual escrow and get token accounts
      mintPublicKey = new PublicKey(tournamentPoolResult.data.mint);
      prizeEscrowPublicKey = getPrizeEscrowPDA(prizePoolPublicKey);
      tokenProgramId = TOKEN_2022_PROGRAM_ID;

      console.log("🔹 Token Type: SPL");
      console.log("🔹 Token Mint:", mintPublicKey.toString());
      console.log("🔹 Prize Escrow:", prizeEscrowPublicKey.toString());

      // Get associated token accounts for winners
      console.log("Getting associated token accounts for winners...");
      
      firstPlaceTokenAccount = await getOrCreateAssociatedTokenAccount(
        connection,
        mintPublicKey,
        firstPlacePublicKey
      );
      console.log("1st Place Token Account:", firstPlaceTokenAccount.toString());

      secondPlaceTokenAccount = await getOrCreateAssociatedTokenAccount(
        connection,
        mintPublicKey,
        secondPlacePublicKey
      );
      console.log("2nd Place Token Account:", secondPlaceTokenAccount.toString());

      thirdPlaceTokenAccount = await getOrCreateAssociatedTokenAccount(
        connection,
        mintPublicKey,
        thirdPlacePublicKey
      );
      console.log("3rd Place Token Account:", thirdPlaceTokenAccount.toString());
    }

    // 5. Create the instruction
    console.log("Creating prize distribution transaction...");

    const computeBudgetInstruction = ComputeBudgetProgram.setComputeUnitLimit({
      units: 400_000,
    });

    const prizeDistributionInstruction = await program.methods
      .distributeTournamentPrizes(tournamentId)
      .accounts({
        creator: adminPublicKey,
        tournamentPool: tournamentPoolPublicKey,
        prizePool: prizePoolPublicKey,
        prizeEscrowAccount: prizeEscrowPublicKey,
        firstPlaceWinner: firstPlacePublicKey,
        secondPlaceWinner: secondPlacePublicKey,
        thirdPlaceWinner: thirdPlacePublicKey,
        firstPlaceTokenAccount: firstPlaceTokenAccount,
        secondPlaceTokenAccount: secondPlaceTokenAccount,
        thirdPlaceTokenAccount: thirdPlaceTokenAccount,
        mint: mintPublicKey,
        tokenProgram: tokenProgramId,
        systemProgram: SystemProgram.programId,
      })
      .instruction();

    // ✅ Mark accounts as writable based on token type
    console.log("🔧 Adjusting account mutability...");

    if (tokenType === TokenType.SOL) {
      // For SOL, mark winner accounts as writable (they receive lamports)
      const writableAccounts = [
        { pubkey: firstPlacePublicKey, name: 'first_place_winner' },
        { pubkey: secondPlacePublicKey, name: 'second_place_winner' },
        { pubkey: thirdPlacePublicKey, name: 'third_place_winner' }
      ];

      writableAccounts.forEach(({ pubkey, name }) => {
        const accountIndex = prizeDistributionInstruction.keys.findIndex(
          key => key.pubkey.equals(pubkey)
        );
        if (accountIndex !== -1) {
          prizeDistributionInstruction.keys[accountIndex].isWritable = true;
          console.log(`   ✅ Marked ${name} as writable`);
        }
      });
    } else {
      // For SPL, mark escrow and token accounts as writable
      const writableAccounts = [
        { pubkey: prizeEscrowPublicKey, name: 'prize_escrow' },
        { pubkey: firstPlaceTokenAccount, name: 'first_place_token' },
        { pubkey: secondPlaceTokenAccount, name: 'second_place_token' },
        { pubkey: thirdPlaceTokenAccount, name: 'third_place_token' },
        { pubkey: mintPublicKey, name: 'mint' }
      ];

      writableAccounts.forEach(({ pubkey, name }) => {
        const accountIndex = prizeDistributionInstruction.keys.findIndex(
          key => key.pubkey.equals(pubkey)
        );
        if (accountIndex !== -1) {
          prizeDistributionInstruction.keys[accountIndex].isWritable = true;
          console.log(`   ✅ Marked ${name} as writable`);
        }
      });
    }

    // Create transaction
    const transaction = new Transaction()
      .add(computeBudgetInstruction)
      .add(prizeDistributionInstruction);

    // Set transaction metadata
    const { blockhash } = await connection.getLatestBlockhash("finalized");
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = adminPublicKey;

    // Calculate prize amounts
    const distributionDetails = tournament.distributionDetails || {};
    const totalPrizeAmount = distributionDetails.prizeAmount || 0;
    
    const firstPlaceAmount = Math.floor(totalPrizeAmount * 0.5);
    const secondPlaceAmount = Math.floor(totalPrizeAmount * 0.3);
    const thirdPlaceAmount = Math.floor(totalPrizeAmount * 0.2);

    console.log("💰 Prize Distribution:");
    console.log(`   1st Place: ${firstPlaceAmount}`);
    console.log(`   2nd Place: ${secondPlaceAmount}`);
    console.log(`   3rd Place: ${thirdPlaceAmount}`);

    return {
      success: true,
      message: "Prize distribution transaction created successfully!",
      tournamentId,
      transaction: transaction.serialize({ requireAllSignatures: false }).toString('base64'),
      winnerData: {
        firstPlace: {
          publicKey: firstPlacePublicKey.toString(),
          tokenAccount: tokenType === TokenType.SPL ? firstPlaceTokenAccount.toString() : "N/A (SOL)",
          amount: firstPlaceAmount
        },
        secondPlace: {
          publicKey: secondPlacePublicKey.toString(),
          tokenAccount: tokenType === TokenType.SPL ? secondPlaceTokenAccount.toString() : "N/A (SOL)",
          amount: secondPlaceAmount
        },
        thirdPlace: {
          publicKey: thirdPlacePublicKey.toString(),
          tokenAccount: tokenType === TokenType.SPL ? thirdPlaceTokenAccount.toString() : "N/A (SOL)",
          amount: thirdPlaceAmount
        }
      },
      tokenType: tokenType === TokenType.SOL ? "SOL" : "SPL",
      status: "Pending Signature"
    };

  } catch (err) {
    console.error("❌ Error preparing tournament prize distribution:", err);
    return {
      success: false,
      message: `Error preparing tournament prize distribution: ${err.message || err}`
    };
  }
};

// Helper function to get or create an associated token account
async function getOrCreateAssociatedTokenAccount(
  connection: Connection,
  mint: PublicKey,
  owner: PublicKey
): Promise<PublicKey> {
  try {
    // Use getAssociatedTokenAddressSync from @solana/spl-token
    const associatedTokenAddress = getAssociatedTokenAddressSync(
      mint,
      owner,
      false,
      TOKEN_2022_PROGRAM_ID  // Use TOKEN_2022_PROGRAM_ID as we're working with token-2022
    );

    console.log(`Token address for ${owner.toString()}: ${associatedTokenAddress.toString()}`);

    // Check if the account exists
    const accountInfo = await connection.getAccountInfo(associatedTokenAddress);
    
    if (!accountInfo) {
      console.log(`Token account for ${owner.toString()} does not exist. It will be created during the transaction.`);
    } else {
      console.log(`Token account for ${owner.toString()} exists with ${accountInfo.lamports} lamports`);
    }

    return associatedTokenAddress;
  } catch (err) {
    console.error("Error in getOrCreateAssociatedTokenAccount:", err);
    throw err;
  }
} 