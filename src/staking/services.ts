//backend/src/staking/services.ts



import {
  Connection,
  PublicKey,
  Keypair,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import * as anchor from "@project-serum/anchor";
import {
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddressSync,
  TOKEN_2022_PROGRAM_ID,
} from "@solana/spl-token";
import dotenv from "dotenv";
import { getStakingPoolPDA, getStakingEscrowPDA, getUserStakingPDA, getRewardPoolPDA, getRewardEscrowPDA, TokenType, getSOLVaultPDA } from "../utils/getPDAs";
dotenv.config();


export interface UserStakingAccount {
  owner: PublicKey;
  stakedAmount: anchor.BN;
  stakeTimestamp: anchor.BN;
  lockDuration: anchor.BN;
  weight: anchor.BN;
  rewardDebt: anchor.BN;
  pendingRewards: anchor.BN;
}



  // Helper function to get the program
export const getProgram = () => {
  const idl = require("../staking/idl-solxspl.json");
  const walletKeypair = require("../staking/SOLxSPL-Admin-wallet-keypair.json");

  const adminKeypair = Keypair.fromSecretKey(new Uint8Array(walletKeypair));
  const adminPublicKey = adminKeypair.publicKey;


  const connection = new Connection("https://api.devnet.solana.com", "confirmed");

  const programId = new PublicKey(
    "A5sbJW4hgVtaYU8TvfJc8bxeWsvFgapc88qX1VruTfq4"
  );

  const provider = new anchor.AnchorProvider(
    connection,
    new anchor.Wallet(adminKeypair),
    anchor.AnchorProvider.defaultOptions()
  );
  anchor.setProvider(provider);

  return {
    program: new anchor.Program(idl, programId, provider),
    adminPublicKey,
    adminKeypair,
    connection,    
  };
};



// Function to stake tokens into the staking pool
export const stakeTokenService = async (
  mintPublicKey: PublicKey,
  userPublicKey: PublicKey,
  amount: number,
  lockDuration: number,
  adminPublicKey: PublicKey,
  tokenType: TokenType
) => {
  try {
    const { program, connection } = getProgram();

    console.log("Staking Details:");
    console.log("User PublicKey:", userPublicKey.toBase58());
    console.log("Admin PublicKey:", adminPublicKey.toBase58());
    console.log("Amount to stake:", amount);
    console.log("Lock Duration (in seconds):", lockDuration);
    console.log("Token Type:", tokenType === TokenType.SPL ? "SPL" : "SOL");

    if (!lockDuration || typeof lockDuration !== 'number') {
      throw new Error('Invalid lock duration provided');
    }

    const stakingPoolPublicKey = getStakingPoolPDA(adminPublicKey, tokenType);
    const userStakingAccountPublicKey = getUserStakingPDA(stakingPoolPublicKey, userPublicKey);

    // ✅ FIX: Use actual SOL vault PDA
    const poolEscrowAccountPublicKey = tokenType === TokenType.SOL 
      ? getSOLVaultPDA(stakingPoolPublicKey)  // ✅ Use actual SOL vault
      : getStakingEscrowPDA(stakingPoolPublicKey);

    const actualMint = tokenType === TokenType.SOL 
      ? SystemProgram.programId
      : mintPublicKey;

    let userTokenAccountPublicKey: PublicKey;
    
    if (tokenType === TokenType.SPL) {
      userTokenAccountPublicKey = getAssociatedTokenAddressSync(
        mintPublicKey, 
        userPublicKey, 
        false, 
        TOKEN_2022_PROGRAM_ID
      );
      console.log("User Token Account PublicKey:", userTokenAccountPublicKey.toBase58());

      const ataInfo = await connection.getAccountInfo(userTokenAccountPublicKey);
      if (!ataInfo) {
        console.log("⚠️ User Token Account does not exist. User needs to create ATA first.");
      }
    } else {
      userTokenAccountPublicKey = SystemProgram.programId;
    }

    const { blockhash } = await connection.getLatestBlockhash("finalized");

    const tokenDecimals = 9;
    const amountInBaseUnits = Math.floor(amount * Math.pow(10, tokenDecimals));
    console.log(`Converting ${amount} tokens to ${amountInBaseUnits} base units`);

    console.log("Pool Escrow Account:", poolEscrowAccountPublicKey.toBase58());

    // Build instruction
    const instruction = await program.methods
      .stake(new anchor.BN(amountInBaseUnits), new anchor.BN(lockDuration))
      .accounts({
        user: userPublicKey,
        stakingPool: stakingPoolPublicKey,
        userStakingAccount: userStakingAccountPublicKey,
        userTokenAccount: userTokenAccountPublicKey,
        poolEscrowAccount: poolEscrowAccountPublicKey,
        mint: actualMint,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .instruction();

    // ✅ Mark pool_escrow_account as writable for BOTH token types
    const escrowIndex = instruction.keys.findIndex(k => k.pubkey.equals(poolEscrowAccountPublicKey));
    if (escrowIndex !== -1) {
      instruction.keys[escrowIndex].isWritable = true;
      console.log(`✅ Marked pool_escrow_account as writable`);
    }
    
    // ✅ For SPL, also mark user_token_account as writable
    if (tokenType === TokenType.SPL) {
      const userTokenIndex = instruction.keys.findIndex(k => k.pubkey.equals(userTokenAccountPublicKey));
      if (userTokenIndex !== -1) {
        instruction.keys[userTokenIndex].isWritable = true;
        console.log(`✅ Marked user_token_account as writable for SPL`);
      }
    }

    const transaction = new Transaction();
    transaction.add(instruction);
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = userPublicKey;

    console.log("✅ Transaction accounts:");
    instruction.keys.forEach((key, idx) => {
      console.log(`  ${idx}: ${key.pubkey.toBase58()} - Signer: ${key.isSigner}, Writable: ${key.isWritable}`);
    });

    return {
      success: true,
      message: "Transaction created successfully!",
      transaction: transaction.serialize({ requireAllSignatures: false }).toString('base64'),
    };
  } catch (err) {
    console.error("❌ Error creating staking transaction:", err);
    return { 
      success: false, 
      message: `Error creating staking transaction: ${err.message || err}` 
    };
  }
};

// Function to unstake tokens from the staking pool
export const unstakeTokenService = async (
  mintPublicKey: PublicKey,
  userPublicKey: PublicKey,
  adminPublicKey: PublicKey,
  tokenType: TokenType
) => {
  try {
    const { program, connection } = getProgram();

    console.log("Unstaking Details:");
    console.log("User PublicKey:", userPublicKey.toBase58());
    console.log("Admin PublicKey:", adminPublicKey.toBase58());
    console.log("Token Type:", tokenType === TokenType.SPL ? "SPL" : "SOL");

    const stakingPoolPublicKey = getStakingPoolPDA(adminPublicKey, tokenType);
    const userStakingAccountPublicKey = getUserStakingPDA(stakingPoolPublicKey, userPublicKey);

    // ✅ FIX: Use actual SOL vault PDA, not SystemProgram
    const poolEscrowAccountPublicKey = tokenType === TokenType.SOL
      ? getSOLVaultPDA(stakingPoolPublicKey)  // ✅ Use actual SOL vault
      : getStakingEscrowPDA(stakingPoolPublicKey);

    const userStakingAccountResponse = await getUserStakingAccount(userPublicKey, adminPublicKey, tokenType);
    console.log("User Staking Account Response:", userStakingAccountResponse);
    
    if (userStakingAccountResponse.success && userStakingAccountResponse.data) {
      const stakedAmount = userStakingAccountResponse.data.stakedAmount;
      const stakedAmountRaw = userStakingAccountResponse.data.stakedAmountRaw || '0';
      console.log(`Unstaking ${stakedAmount} tokens (${stakedAmountRaw} base units)`);
    }

    const actualMint = tokenType === TokenType.SOL 
      ? SystemProgram.programId
      : mintPublicKey;

    let userTokenAccountPublicKey: PublicKey;
    
    if (tokenType === TokenType.SPL) {
      userTokenAccountPublicKey = getAssociatedTokenAddressSync(
        mintPublicKey, 
        userPublicKey, 
        false, 
        TOKEN_2022_PROGRAM_ID
      );
      console.log("User Token Account PublicKey:", userTokenAccountPublicKey.toBase58());

      const ataInfo = await connection.getAccountInfo(userTokenAccountPublicKey);
      if (!ataInfo) {
        console.log("⚠️ User Token Account does not exist. User needs to create ATA first.");
      }
    } else {
      userTokenAccountPublicKey = SystemProgram.programId;
    }

    const { blockhash } = await connection.getLatestBlockhash('finalized');

    console.log("Pool Escrow Account:", poolEscrowAccountPublicKey.toBase58());

    // Build instruction
    const instruction = await program.methods
      .unstake()
      .accounts({
        user: userPublicKey,
        stakingPool: stakingPoolPublicKey,
        userStakingAccount: userStakingAccountPublicKey,
        userTokenAccount: userTokenAccountPublicKey,
        poolEscrowAccount: poolEscrowAccountPublicKey,
        mint: actualMint,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .instruction();
    
    // ✅ Mark pool_escrow_account as writable for BOTH token types
    const escrowIndex = instruction.keys.findIndex(k => k.pubkey.equals(poolEscrowAccountPublicKey));
    if (escrowIndex !== -1) {
      instruction.keys[escrowIndex].isWritable = true;
      console.log(`✅ Marked pool_escrow_account as writable`);
    }
    
    // ✅ For SPL, also mark user_token_account as writable
    if (tokenType === TokenType.SPL) {
      const userTokenIndex = instruction.keys.findIndex(k => k.pubkey.equals(userTokenAccountPublicKey));
      if (userTokenIndex !== -1) {
        instruction.keys[userTokenIndex].isWritable = true;
        console.log(`✅ Marked user_token_account as writable for SPL`);
      }
    }
    
    const transaction = new Transaction();
    transaction.add(instruction);
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = userPublicKey;

    console.log("✅ Transaction accounts:");
    instruction.keys.forEach((key, idx) => {
      console.log(`  ${idx}: ${key.pubkey.toBase58()} - Signer: ${key.isSigner}, Writable: ${key.isWritable}`);
    });

    return {
      success: true,
      message: "Transaction created successfully!",
      tokenType: tokenType === TokenType.SPL ? "SPL" : "SOL",
      transaction: transaction.serialize({ requireAllSignatures: false }).toString('base64'),
    };
  } catch (err) {
    console.error("❌ Error creating unstake transaction:", err);
    return { 
      success: false, 
      message: `Error creating unstake transaction: ${err.message || err}` 
    };
  }
};


// Function to claim staking rewards
export const claimRewardsService = async (
  userPublicKey: PublicKey,
  adminPublicKey: PublicKey,
  tokenType: TokenType
) => {
  try {
    const { program, connection } = getProgram();

    const stakingPoolPublicKey = getStakingPoolPDA(adminPublicKey, tokenType);

    const userStakingAccountPublicKey = getUserStakingPDA(stakingPoolPublicKey, userPublicKey);

    const rewardPoolPublicKey = getRewardPoolPDA(adminPublicKey, tokenType);

    const rewardEscrowPublicKey = getRewardEscrowPDA(rewardPoolPublicKey);

    // Fetch staking pool to obtain mint
    const stakingPoolAccount: any = await program.account.stakingPool.fetch(stakingPoolPublicKey);
    const mintPublicKey: PublicKey = stakingPoolAccount.mint as PublicKey;

    // Ensure the user has an ATA
    let userTokenAccountPublicKey = await getAssociatedTokenAddressSync(mintPublicKey, userPublicKey, false, TOKEN_2022_PROGRAM_ID);
    const accountInfo = await connection.getAccountInfo(userTokenAccountPublicKey);
    if (!accountInfo) {
      const createATA = await createAssociatedTokenAccount(mintPublicKey, userPublicKey);
      if (!createATA.success) {
        throw new Error('Failed to create associated token account');
      }
      userTokenAccountPublicKey = createATA.associatedTokenAddress;
    }

    const { blockhash } = await connection.getLatestBlockhash('finalized');

    const transaction = await program.methods
      .claimRewards()
      .accounts({
        user: userPublicKey,
        stakingPool: stakingPoolPublicKey,
        userStakingAccount: userStakingAccountPublicKey,
        rewardPool: rewardPoolPublicKey,
        userTokenAccount: userTokenAccountPublicKey,
        rewardEscrowAccount: rewardEscrowPublicKey,
        mint: mintPublicKey,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .transaction();

    transaction.recentBlockhash = blockhash;
    transaction.feePayer = userPublicKey;

    return {
      success: true,
      message: 'Transaction created successfully!',
      transaction: transaction.serialize({ requireAllSignatures: false }).toString('base64'),
    };
  } catch (err: any) {
    console.error('❌ Error creating claim transaction:', err);
    return { success: false, message: `Error creating claim transaction: ${err.message || err}` };
  }
};




export const getUserStakingAccount = async (userPublicKey: PublicKey, adminPublicKey: PublicKey, tokenType: TokenType) => {
  try {
    const { program, connection } = getProgram();


    const stakingPoolPublicKey = getStakingPoolPDA(adminPublicKey, tokenType);

    console.log("Token Type:", tokenType === TokenType.SPL ? "SPL" : "SOL");
    console.log("Staking Pool PublicKey:", stakingPoolPublicKey.toBase58());
    console.log("User PublicKey:", userPublicKey.toBase58());
    console.log("Admin PublicKey:", adminPublicKey.toBase58());

    // Derive the public key for the user staking account
    const userStakingAccountPublicKey = getUserStakingPDA(stakingPoolPublicKey, userPublicKey);

    console.log(userStakingAccountPublicKey);

    // Check if the user staking account exists
    const accountExists = await connection.getAccountInfo(userStakingAccountPublicKey);

    if (!accountExists) {
      return { success: false, message: "User has not staked any tokens yet." };
    }

    // Fetch staking data
    const userStakingAccount = await program.account.userStakingAccount.fetch(
      userStakingAccountPublicKey
    ) as UserStakingAccount;

    console.log("Raw userStakingAccount:", userStakingAccount);
    console.log("Raw stakedAmount (base units):", userStakingAccount.stakedAmount.toString());
    console.log("Raw stakedAmount as number:", userStakingAccount.stakedAmount.toNumber());

    // Helper function to convert BN to decimal with proper precision
    // This avoids JavaScript floating point precision issues by using string manipulation
    const convertBaseUnitsToReadable = (amountBN: anchor.BN, decimals: number): number => {
      const amountStr = amountBN.toString();
      
      // Handle zero case
      if (amountStr === '0') {
        return 0;
      }
      
      // Pad the string with leading zeros if needed to ensure we have enough digits
      const paddedAmount = amountStr.padStart(decimals, '0');
      
      // Split into integer and decimal parts
      let integerPart: string;
      let decimalPart: string;
      
      if (paddedAmount.length <= decimals) {
        // Amount is smaller than 1 full unit
        integerPart = '0';
        decimalPart = paddedAmount;
      } else {
        // Split at the decimal point
        integerPart = paddedAmount.slice(0, -decimals) || '0';
        decimalPart = paddedAmount.slice(-decimals);
      }
      
      // Remove trailing zeros from decimal part for cleaner output
      const trimmedDecimal = decimalPart.replace(/0+$/, '');
      
      // Construct the final number string
      let numberString: string;
      if (trimmedDecimal === '') {
        numberString = integerPart;
      } else {
        numberString = integerPart + '.' + trimmedDecimal;
      }
      
      // Convert to number - this preserves precision better than simple division
      const result = Number(numberString);
      console.log(`Converting ${amountStr} base units: ${numberString} -> ${result}`);
      
      return result;
    };

    // Convert amounts from base units to human-readable tokens
    const tokenDecimals = 9;  // SOL and most tokens use 9 decimals
    const readableStakedAmount = convertBaseUnitsToReadable(userStakingAccount.stakedAmount, tokenDecimals);
    const readableRewardDebt = convertBaseUnitsToReadable(userStakingAccount.rewardDebt, tokenDecimals);
    const readablePendingRewards = convertBaseUnitsToReadable(userStakingAccount.pendingRewards, tokenDecimals);

    // Ensure that the fields are defined and use safe .toString() calls
    const rawData = {
      owner: userStakingAccount.owner.toBase58(),
      stakedAmount: readableStakedAmount,
      stakedAmountRaw: userStakingAccount.stakedAmount.toString(), // Raw base units for debugging
      stakeTimestamp: userStakingAccount.stakeTimestamp.toString(),
      stakeDuration: userStakingAccount.lockDuration.toString(),
      weight: userStakingAccount.weight.toString(),
      rewardDebt: readableRewardDebt,
      pendingRewards: readablePendingRewards,
    };

    console.log("Converted User Staking Account Data:", rawData);
    console.log(`Staked Amount: ${readableStakedAmount} tokens (${userStakingAccount.stakedAmount.toString()} base units)`);

    return { success: true, data: rawData };
  } catch (err) {
    console.error("❌ Error fetching user staking account:", err);
    return { success: false, message: "Error fetching user staking account." };
  }
};







// Function to accrue pending rewards for a specific staker
export const accrueRewardsService = async (
  userPublicKey: PublicKey,
  adminPublicKey: PublicKey,
  tokenType: TokenType
) => {
  try {
    const { program, connection } = getProgram();

    console.log("Accruing rewards for user:", userPublicKey.toBase58());

    // Get the staking pool PDA
    const stakingPoolPublicKey = getStakingPoolPDA(adminPublicKey, tokenType);

    // Get the user staking account PDA
    const userStakingPublicKey = getUserStakingPDA(stakingPoolPublicKey, userPublicKey);

    // Build an unsigned transaction for the user to sign
    const { blockhash } = await connection.getLatestBlockhash('finalized');
    const transaction = await program.methods
      .accrueRewards()
      .accounts({
        user: userPublicKey,
        stakingPool: stakingPoolPublicKey,
        userStakingAccount: userStakingPublicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .transaction();

    transaction.recentBlockhash = blockhash;
    transaction.feePayer = userPublicKey;

    return {
      success: true,
      message: 'Transaction created successfully! Please sign to accrue rewards.',
      transaction: transaction.serialize({ requireAllSignatures: false }).toString('base64'),
    };

  } catch (error) {
    console.error("❌ Error accruing rewards:", error);
    return {
      success: false,
      message: "Failed to accrue rewards",
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
};



// To create an associated token account for a user
export const createAssociatedTokenAccount = async (
  mintPublicKey: PublicKey,
  userPublicKey: PublicKey
) => {
  try {
    const { connection } = getProgram();  // You may need to adjust how you retrieve these

    // Get or create the associated token account for the user
    const associatedTokenAddress = await getAssociatedTokenAddressSync(
      mintPublicKey,
      userPublicKey,
      false,
      TOKEN_2022_PROGRAM_ID
    );

    // Check if the associated token account already exists
    const accountInfo = await connection.getAccountInfo(associatedTokenAddress);

    if (!accountInfo) {
      console.log(
        `🔹 Token account does not exist. Creating ATA: ${associatedTokenAddress.toBase58()}`
      );

      // Get the recent blockhash
      const { blockhash } = await connection.getLatestBlockhash("finalized");

      // Create the unsigned transaction to create ATA
      const transaction = new Transaction().add(
        createAssociatedTokenAccountInstruction(
          userPublicKey,  // The wallet to create the ATA for
          associatedTokenAddress,  // The ATA to be created
          userPublicKey,  // The user's public key (as the owner)
          mintPublicKey,  // The token mint
          TOKEN_2022_PROGRAM_ID  // Token program ID (default)
        )
      );

      // Set the recent blockhash and fee payer (user will pay the transaction fees)
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = userPublicKey;

      // Serialize the transaction to send to frontend (unsigned)
      return {
        success: true,
        message: 'Transaction created successfully! Please sign it with your wallet.',
        transaction: Buffer.from(transaction.serialize({ requireAllSignatures: false })).toString("base64"),
        associatedTokenAddress  // Send unsigned transaction as base64
      };

    }
  } catch (err) {
    console.error("❌ Error creating the ATA transaction:", err);
    return { success: false, message: "Error creating the associated token account" };
  }
}
