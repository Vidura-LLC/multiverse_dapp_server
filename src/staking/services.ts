//backend/src/staking/services.ts

import {
  Connection,
  PublicKey,
  Keypair,
  SystemProgram,
  clusterApiUrl,
  Transaction,
} from "@solana/web3.js";
import * as anchor from "@project-serum/anchor";
import {
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddressSync,
  TOKEN_2022_PROGRAM_ID,
  getMint,
  transferChecked
} from "@solana/spl-token";
import { bs58 } from "@project-serum/anchor/dist/cjs/utils/bytes";
import dotenv from "dotenv";

dotenv.config();

// Helper function to get the program
const getProgram = () => {
  const idl = require("./idl.json");
  const walletKeypair = require("./wallet-keypair.json");

  const adminKeypair = Keypair.fromSecretKey(new Uint8Array(walletKeypair));
  const adminPublicKey = adminKeypair.publicKey;

  const userWallet = require("./testWallet.json");

  const userKeypair = Keypair.fromSecretKey(new Uint8Array(userWallet));
  const userPublicKey = userKeypair.publicKey;

  const connection = new Connection(clusterApiUrl("devnet"), "confirmed");

  const programId = new PublicKey(
    "9zYBuWmk35JryeiwzuZK8fen2koGuxTKh3qDDWtnWBFq"
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
    userKeypair,
    userPublicKey
  };
};

// ✅ Function to initialize the staking pool and escrow account
export const initializeAccountsService = async (mintPublicKey: PublicKey) => {
  try {
    const { program, adminPublicKey } = getProgram();

    const [stakingPoolPublicKey] = PublicKey.findProgramAddressSync(
      [Buffer.from("staking_pool"), adminPublicKey.toBuffer()],
      program.programId
    );

    const [poolEscrowAccountPublicKey] = PublicKey.findProgramAddressSync(
      [Buffer.from("escrow"), stakingPoolPublicKey.toBuffer()],
      program.programId
    );

    console.log("🔹 Staking Pool PDA Address:", stakingPoolPublicKey.toString());
    console.log(
      "🔹 Pool Escrow Account Address:",
      poolEscrowAccountPublicKey.toString()
    );

    await program.methods
      .initializeAccounts()
      .accounts({
        admin: adminPublicKey,
        stakingPool: stakingPoolPublicKey,
        mint: mintPublicKey,
        poolEscrowAccount: poolEscrowAccountPublicKey,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .rpc();

    return { success: true, message: "Staking pool initialized successfully!" };
  } catch (err) {
    console.error("❌ Error initializing staking pool:", err);
    return { success: false, message: "Error initializing staking pool" };
  }
};

// ✅ Function to stake tokens into the staking pool
export const stakeTokenService = async (
  mintPublicKey: PublicKey,
  userPublicKey: PublicKey,
  amount: number,
  lockDuration: number // New parameter for lock duration in seconds
) => {
  try {
    const { program, adminPublicKey, connection } = getProgram();

    const [stakingPoolPublicKey] = PublicKey.findProgramAddressSync(
      [Buffer.from("staking_pool"), adminPublicKey.toBuffer()],
      program.programId
    );

    const [userStakingAccountPublicKey] = PublicKey.findProgramAddressSync(
      [Buffer.from("user_stake"), userPublicKey.toBuffer()],
      program.programId
    );

    const [poolEscrowAccountPublicKey] = PublicKey.findProgramAddressSync(
      [Buffer.from("escrow"), stakingPoolPublicKey.toBuffer()],
      program.programId
    );

    const userTokenAccountPublicKey = await getOrCreateAssociatedTokenAccount(
      connection,
      mintPublicKey,
      userPublicKey
    );

    const { blockhash } = await connection.getLatestBlockhash("finalized");

    // Ensure we're calculating the lock timestamp in UTC (Unix timestamp in seconds)
    const currentUtcTimeInSeconds = Math.floor(Date.now() / 1000);  // UTC time in seconds
    const lockTimestamp = currentUtcTimeInSeconds + lockDuration; // lock duration in seconds

    // ✅ Create an unsigned transaction
    const transaction = await program.methods
      .stake(new anchor.BN(amount), new anchor.BN(lockTimestamp)) // Pass lockTimestamp to contract
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
      .transaction(); // ⬅️ Create transaction, don't sign

    transaction.recentBlockhash = blockhash;
    transaction.feePayer = userPublicKey;

    // Serialize transaction and send it to the frontend
    return {
      success: true,
      message: "Transaction created successfully!",
      transaction: transaction.serialize({ requireAllSignatures: false }),
    };
  } catch (err) {
    console.error("❌ Error creating staking transaction:", err);
    return { success: false, message: "Error creating staking transaction" };
  }
};



export const unstakeTokenService = async (
  mintPublicKey: PublicKey,
  userPublicKey: PublicKey,
  amount: number
) => {
  try {
    const { program, adminPublicKey, connection } = getProgram(); // Assuming getProgram() initializes necessary context

    // Find the staking pool, user staking account, and escrow account
    const [stakingPoolPublicKey] = PublicKey.findProgramAddressSync(
      [Buffer.from('staking_pool'), adminPublicKey.toBuffer()],
      program.programId
    );

    const [userStakingAccountPublicKey] = PublicKey.findProgramAddressSync(
      [Buffer.from('user_stake'), userPublicKey.toBuffer()],
      program.programId
    );

    const [poolEscrowAccountPublicKey] = PublicKey.findProgramAddressSync(
      [Buffer.from('escrow'), stakingPoolPublicKey.toBuffer()],
      program.programId
    );

    // Get the user's token account (create if it doesn't exist)
    const userTokenAccountPublicKey = await getOrCreateAssociatedTokenAccount(
      connection,
      mintPublicKey,
      userPublicKey
    );

    // Get the latest blockhash
    const { blockhash } = await connection.getLatestBlockhash('finalized');

    // ✅ Create an unsigned transaction
    const transaction = await program.methods
      .unstake(new anchor.BN(amount * 10 ** 9)) // Ensure correct decimals
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
      .transaction(); // ⬅️ Create transaction, don't sign

    // Add blockhash and fee payer to the transaction
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = userPublicKey;

    // Serialize transaction and send it to the frontend
    return {
      success: true,
      message: 'Transaction created successfully!',
      transaction: transaction.serialize({ requireAllSignatures: false }),
    };
  } catch (err) {
    console.error('❌ Error creating unstaking transaction:', err);
    return { success: false, message: 'Error creating unstaking transaction' };
  }
};


interface UserStakingAccount {
  owner: PublicKey;
  stakedAmount: anchor.BN;
  stakeTimestamp: anchor.BN;
}

export const getUserStakingAccount = async (userPublicKey: PublicKey) => {
  try {
    const { program, connection } = getProgram();

    // Derive the public key for the user staking account
    const [userStakingAccountPublicKey] = PublicKey.findProgramAddressSync(
      [Buffer.from("user_stake"), userPublicKey.toBuffer()],
      program.programId
    );

    // Check if the user staking account exists
    const accountExists = await connection.getAccountInfo(userStakingAccountPublicKey);
    
    if (!accountExists) {
      // Staking account does not exist, return a message
      return { success: false, message: "User has not staked any tokens yet." };
    }

    // If the account exists, fetch the staking data
    const userStakingAccount = await program.account.userStakingAccount.fetch(
      userStakingAccountPublicKey
    ) as UserStakingAccount;

    // ✅ Convert stakedAmount from base units
    const tokenDecimals = 9;  // Change this if your token has different decimals
    const readableStakedAmount = userStakingAccount.stakedAmount.toNumber() / (10 ** tokenDecimals);

    // ✅ Convert Unix timestamp to readable date
    const stakeTimestamp = userStakingAccount.stakeTimestamp.toNumber();
    const stakeDate = new Date(stakeTimestamp * 1000).toISOString();

    // ✅ Check if the stakeTimestamp is in the future and handle it
    const currentTimestamp = Math.floor(Date.now() / 1000); // Current timestamp in seconds

  

    // ✅ Calculate duration (in seconds)
    const stakingDuration = currentTimestamp - stakeTimestamp; // Duration in seconds

    // Convert duration to a human-readable format (e.g., days, hours, minutes)
    const durationInDays = Math.floor(stakingDuration / (60 * 60 * 24)); // Convert to days
    const durationInHours = Math.floor((stakingDuration % (60 * 60 * 24)) / (60 * 60)); // Convert remaining seconds to hours
    const durationInMinutes = Math.floor((stakingDuration % (60 * 60)) / 60); // Convert remaining seconds to minutes

    const formattedDuration = `${durationInDays} days, ${durationInHours} hours, ${durationInMinutes} minutes`;

    // Prepare the response with all necessary data
    const formattedData = {
      owner: userStakingAccount.owner.toBase58(),
      stakedAmount: readableStakedAmount,  // Human-readable amount
      stakeTimestamp: stakeDate,  // Formatted as a date string
      stakingDuration: formattedDuration,  // Duration in a human-readable format
    };

    console.log("✅ User Staking Account Data:", formattedData);
    
    return { success: true, data: formattedData };
  } catch (err) {
    console.error("❌ Error fetching user staking account:", err);
    return { success: false, message: "Error fetching user staking account." };
  }
};



// To create an associated token account for a user
export const createAssociatedTokenAccount = async (
  mintPublicKey: PublicKey,
  userPublicKey: PublicKey
) => {
  try {
    const { connection, program } = getProgram();  // You may need to adjust how you retrieve these
    
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
        userPublicKey,  // The user’s public key (as the owner)
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
      transaction: transaction.serialize({ requireAllSignatures: false }),
      associatedTokenAddress  // Send unsigned transaction as base64
    };

  }
} catch (err) {
    console.error("❌ Error creating the ATA transaction:", err);
    return { success: false, message: "Error creating the associated token account" };
  }
}





// ✅ Helper function to get or create an associated token account
async function getOrCreateAssociatedTokenAccount(
  connection: Connection,
  mint: PublicKey,
  owner: PublicKey
): Promise<PublicKey> {
  const associatedTokenAddress = getAssociatedTokenAddressSync(
    mint,
    owner,
    false, // ✅ Not a PDA
    TOKEN_2022_PROGRAM_ID
  );

  const accountInfo = await connection.getAccountInfo(associatedTokenAddress);

  if (!accountInfo) {
    console.log(
      `🔹 Token account does not exist. Creating ATA: ${associatedTokenAddress.toBase58()}`
    );

    const transaction = new anchor.web3.Transaction().add(
      createAssociatedTokenAccountInstruction(
        owner,
        associatedTokenAddress,
        owner,
        mint,
        TOKEN_2022_PROGRAM_ID
      )
    );
    const {adminKeypair} = getProgram();
    await anchor.web3.sendAndConfirmTransaction(connection, transaction, [
      adminKeypair
    ]);
    console.log(`✅ Successfully created ATA: ${associatedTokenAddress.toBase58()}`);
  } else {
    console.log(`🔹 Token account exists: ${associatedTokenAddress.toBase58()}`);
  }

  return associatedTokenAddress;
}



// ✅ Helper function to get or create an associated token account (using the server's keypair for testing purpose)
export const createAssociatedTokenAccountWithKeypair = async (
  mintPublicKey: PublicKey,
  userPublicKey: PublicKey
) => {
  try {
    // Load the user's keypair from file
    const {userKeypair, userPublicKey, connection} = getProgram();


    // Get the associated token address for the user
    const associatedTokenAddress = await getAssociatedTokenAddressSync(
      mintPublicKey,
      userPublicKey,
      false, // Not a PDA
      TOKEN_2022_PROGRAM_ID
    );

    // Check if the associated token account exists
    const accountInfo = await connection.getAccountInfo(associatedTokenAddress);
    if (accountInfo) {
      console.log(`🔹 Token account exists: ${associatedTokenAddress.toBase58()}`);
      return { success: true, message: "Token account already exists.", associatedTokenAddress };
    }

    console.log(`🔹 Token account does not exist. Creating ATA: ${associatedTokenAddress.toBase58()}`);

    // Get the recent blockhash for the transaction
    const { blockhash } = await connection.getLatestBlockhash("finalized");

    // Create the transaction to create the ATA
    const transaction = new Transaction().add(
      createAssociatedTokenAccountInstruction(
        userPublicKey, // Wallet address to create the ATA for
        associatedTokenAddress, // ATA address to be created
        userPublicKey, // User's public key as owner
        mintPublicKey, // The mint of the token
        TOKEN_2022_PROGRAM_ID // Token program ID
      )
    );

    // Set the recent blockhash and fee payer (user will pay the transaction fees)
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = userPublicKey;

    // Sign the transaction with the server's keypair (for testing purpose)
    transaction.sign(userKeypair);

    // Send the transaction to the network and confirm it
    const signature = await connection.sendTransaction(transaction, [userKeypair], { skipPreflight: false, preflightCommitment: "confirmed" });

    console.log(`✅ Transaction sent successfully! Signature: ${signature}`);

    // Optionally, confirm the transaction
    const confirmation = await connection.confirmTransaction(signature);
    console.log('Transaction confirmed:', confirmation);

    return { success: true, message: "ATA created successfully.", signature, associatedTokenAddress };
  } catch (err) {
    console.error("❌ Error creating ATA:", err);
    return { success: false, message: "Error creating the associated token account" };
  }
};


// ✅ Function to stake tokens into the staking pool
export const stakeTokenServiceWithKeypair = async (
  mintPublicKey: PublicKey,
  amount: number,
  duration: number,
) => {
  try {
    const { program, adminPublicKey, userKeypair, userPublicKey, connection } = getProgram();


    // Ensure 'amount' is a valid number and positive
    if (isNaN(amount) || amount <= 0) {
      throw new Error("Invalid amount provided");
    }

    // Ensure 'duration' is a valid number and positive
    if (isNaN(duration) || duration <= 0) {
      throw new Error("Invalid time frame provided");
    }
    
    const [stakingPoolPublicKey] = PublicKey.findProgramAddressSync(
      [Buffer.from("staking_pool"), adminPublicKey.toBuffer()],
      program.programId
    );

    const [userStakingAccountPublicKey] = PublicKey.findProgramAddressSync(
      [Buffer.from("user_stake"), userPublicKey.toBuffer()],
      program.programId
    );

    const [poolEscrowAccountPublicKey] = PublicKey.findProgramAddressSync(
      [Buffer.from("escrow"), stakingPoolPublicKey.toBuffer()],
      program.programId
    );

    const userTokenAccountPublicKey = await getOrCreateAssociatedTokenAccount(
      connection,
      mintPublicKey,
      userPublicKey
    );

    const { blockhash } = await connection.getLatestBlockhash("finalized");

    // Ensure amount and duration are valid BN inputs
    const amountBN = new anchor.BN(amount.toString()); // Convert to string before passing to BN
    const durationBN = new anchor.BN(duration.toString()); // Convert to string before passing to BN

    // ✅ Create an unsigned transaction with the added duration parameter
    const transaction = await program.methods
      .stake(new anchor.BN(amountBN), new anchor.BN(durationBN)) // Pass both amount and duration
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
      .transaction(); // ⬅️ Create transaction, don't sign

    // Set the recent blockhash and fee payer
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = userPublicKey; // Use admin as fee payer

    // ✅ Sign the transaction fully with admin's keypair (no partial signing)
    transaction.sign(userKeypair); // Fully sign the transaction with the admin's keypair

    // Serialize transaction and send it to the frontend
    const serializedTransaction = transaction.serialize(); // Serialize the fully signed transaction

    // Send the serialized transaction to the network
    const txId = await connection.sendRawTransaction(serializedTransaction, { skipPreflight: false });

    // Wait for confirmation
    await connection.confirmTransaction(txId, 'finalized');

    return {
      success: true,
      message: "Transaction created and executed successfully!",
      transactionId: txId, // Return the transaction ID for logging
    };
  } catch (err) {
    console.error("❌ Error creating staking transaction:", err);
    return { success: false, message: `Error creating staking transaction: ${err.message}` };
  }
};
