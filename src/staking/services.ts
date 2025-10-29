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
import { getStakingPoolPDA, getStakingEscrowPDA, getUserStakingPDA, getRewardPoolPDA, getRewardEscrowPDA, TokenType } from "../utils/getPDAs";
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
  lockDuration: number, // Lock duration in seconds
  adminPublicKey: PublicKey, // Admin public key from client
  tokenType: TokenType
) => {
  try {
    const { program, connection } = getProgram();

    // Log initial parameters for clarity
    console.log("Staking Details:");
    console.log("User PublicKey:", userPublicKey.toBase58());
    console.log("Admin PublicKey:", adminPublicKey.toBase58());
    console.log("Mint PublicKey:", mintPublicKey.toBase58());
    console.log("Amount to stake:", amount);
    console.log("Lock Duration (in seconds):", lockDuration);

    // Validate lockDuration
    if (!lockDuration || typeof lockDuration !== 'number') {
      throw new Error('Invalid lock duration provided');
    }

    const stakingPoolPublicKey = getStakingPoolPDA(adminPublicKey, tokenType);

    const userStakingAccountPublicKey = getUserStakingPDA(stakingPoolPublicKey, userPublicKey);

    const poolEscrowAccountPublicKey = getStakingEscrowPDA(stakingPoolPublicKey);

    // Check if the user already has a staking account
    const userStakingAccountResponse = await getUserStakingAccount(userPublicKey, adminPublicKey, tokenType);
    console.log("User Staking Account Response:", userStakingAccountResponse);

    let userTokenAccountPublicKey = await getAssociatedTokenAddressSync(mintPublicKey, userPublicKey, false, TOKEN_2022_PROGRAM_ID);
    console.log("User Token Account PublicKey:", userTokenAccountPublicKey.toBase58());

    if (!userTokenAccountPublicKey) {
      console.log("User Token Account PublicKey does not exist. Creating ATA...");
      const createATAResponse = await createAssociatedTokenAccount(mintPublicKey, userPublicKey);
      console.log("Create ATA Response:", createATAResponse);
      userTokenAccountPublicKey = createATAResponse.associatedTokenAddress;
    }


    const { blockhash } = await connection.getLatestBlockhash("finalized");
    console.log("Latest Blockhash:", blockhash);

    // Create an unsigned transaction for staking
    const transaction = await program.methods
      .stake(new anchor.BN(amount), new anchor.BN(lockDuration))
      .accounts({
        user: userPublicKey,
        stakingPool: stakingPoolPublicKey,
        userStakingAccount: userStakingAccountPublicKey,
        userTokenAccount: userTokenAccountPublicKey,
        poolEscrowAccount: poolEscrowAccountPublicKey,
        mint: mintPublicKey,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .transaction();

    transaction.recentBlockhash = blockhash;
    transaction.feePayer = userPublicKey;

    // Serialize transaction and send it to the frontend
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






export const unstakeTokenService = async (
  mintPublicKey: PublicKey,
  userPublicKey: PublicKey,
  adminPublicKey: PublicKey,
  tokenType: TokenType
) => {
  try {
    const { program, connection } = getProgram(); // Assuming getProgram() initializes necessary context

    // Find the staking pool, user staking account, and escrow account
    const stakingPoolPublicKey = getStakingPoolPDA(adminPublicKey, tokenType);

    const userStakingAccountPublicKey = getUserStakingPDA(stakingPoolPublicKey, userPublicKey);

    const poolEscrowAccountPublicKey = getStakingEscrowPDA(stakingPoolPublicKey);

    // Check if the user already has a staking account
    const userStakingAccountResponse = await getUserStakingAccount(userPublicKey, adminPublicKey, tokenType);
    console.log("User Staking Account Response:", userStakingAccountResponse);

    let userTokenAccountPublicKey = await getAssociatedTokenAddressSync(mintPublicKey, userPublicKey, false, TOKEN_2022_PROGRAM_ID);
    console.log("User Token Account PublicKey:", userTokenAccountPublicKey.toBase58());

    if (!userTokenAccountPublicKey) {
      console.log("User Token Account PublicKey does not exist. Creating ATA...");
      const createATAResponse = await createAssociatedTokenAccount(mintPublicKey, userPublicKey);
      console.log("Create ATA Response:", createATAResponse);
      userTokenAccountPublicKey = createATAResponse.associatedTokenAddress;
    }


    // Get the latest blockhash
    const { blockhash } = await connection.getLatestBlockhash('finalized');

    // Create an unsigned transaction to unstake all tokens
    const transaction = await program.methods
      .unstake() // No need to pass amount, as unstake now operates on the full staked amount
      .accounts({
        user: userPublicKey,
        stakingPool: stakingPoolPublicKey,
        userStakingAccount: userStakingAccountPublicKey,
        userTokenAccount: userTokenAccountPublicKey,
        poolEscrowAccount: poolEscrowAccountPublicKey,
        mint: mintPublicKey,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .transaction(); // Create transaction, don't sign

    transaction.recentBlockhash = blockhash;
    transaction.feePayer = userPublicKey;

    // Serialize transaction and send it to the frontend
    return {
      success: true,
      message: "Transaction created successfully!",
      transaction: transaction.serialize({ requireAllSignatures: false }).toString('base64'),
    };
  } catch (err) {
    console.error("❌ Error creating unstake transaction:", err);
    return { success: false, message: "Error creating unstake transaction" };
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

    const rewardPoolPublicKey = getRewardPoolPDA(adminPublicKey);

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

    console.log(userStakingAccount);



    // Convert stakedAmount from base units
    const tokenDecimals = 9;  // Adjust token decimals as needed
    const readableStakedAmount = userStakingAccount.stakedAmount.toNumber() / (10 ** tokenDecimals);

    // Ensure that the fields are defined and use safe .toString() calls
    const rawData = {
      owner: userStakingAccount.owner.toBase58(),
      stakedAmount: readableStakedAmount,
      stakeTimestamp: userStakingAccount.stakeTimestamp.toString(),
      stakeDuration: userStakingAccount.lockDuration.toString(),
      weight: userStakingAccount.weight.toString(),
      rewardDebt: userStakingAccount.rewardDebt.toNumber() / (10 ** tokenDecimals),
      pendingRewards: userStakingAccount.pendingRewards.toNumber() / (10 ** tokenDecimals),
    };

    console.log("Raw User Staking Account Data:", rawData);

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
