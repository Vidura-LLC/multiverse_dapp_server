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
  const idl = require("../gamehub/gamehub_idl.json");
  const walletKeypair = require("../staking/saadat7s-wallet-keypair.json");

  const adminKeypair = Keypair.fromSecretKey(new Uint8Array(walletKeypair));
  const adminPublicKey = adminKeypair.publicKey;

  const userWallet = require("./hamad-wallet-keypair.json");

  const userKeypair = Keypair.fromSecretKey(new Uint8Array(userWallet));
  const userPublicKey = userKeypair.publicKey;

  const connection = new Connection(clusterApiUrl("devnet"), "confirmed");

  const programId = new PublicKey(
    "BmBAppuJQGGHmVizxKLBpJbFtq8yGe9v7NeVgHPEM4Vs"
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
export const initializeStakingPoolService = async (mintPublicKey: PublicKey, adminPublicKey: PublicKey) => {
  try {
    const { program, connection } = getProgram();

    // Log initial parameters for clarity
    console.log("Initializing Staking Pool:");
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
      transaction: transaction.serialize({ requireAllSignatures: false }).toString('base64'),
    };
  } catch (err) {
    console.error("❌ Error initializing staking pool:", err);
    return { 
      success: false, 
      message: `Error initializing staking pool: ${err.message || err}` 
    };
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

    // Log initial parameters for clarity
    console.log("Staking Details:");
    console.log("User PublicKey:", userPublicKey.toBase58());
    console.log("Mint PublicKey:", mintPublicKey.toBase58());
    console.log("Amount to stake:", amount);
    console.log("Lock Duration (in seconds):", lockDuration);

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

    // Check if the user already has a staking account
    const userStakingAccountResponse = await getUserStakingAccount(userPublicKey);
    console.log("User Staking Account Response:", userStakingAccountResponse);

    const userTokenAccountPublicKey = await getOrCreateAssociatedTokenAccount(
      connection,
      mintPublicKey,
      userPublicKey
    );
    console.log("User Token Account PublicKey:", userTokenAccountPublicKey.toBase58());

    const { blockhash } = await connection.getLatestBlockhash("finalized");
    console.log("Latest Blockhash:", blockhash);

    // Calculate the lock timestamp (current UTC time + lock duration in seconds)
    const currentTimestamp = Math.floor(Date.now() / 1000); // Current UTC timestamp in seconds
    const lockTimestamp = currentTimestamp + lockDuration;  // Add lockDuration to current timestamp
    console.log("Lock Timestamp (UTC):", lockTimestamp);

    // ✅ Create an unsigned transaction for staking
    const transaction = await program.methods
      .stake(new anchor.BN(amount), new anchor.BN(lockDuration)) // Pass lock duration to contract
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
      transaction: transaction.serialize({ requireAllSignatures: false }).toString('base64'),
    };
  } catch (err) {
    console.error("❌ Error creating staking transaction:", err);
    return { success: false, message: "Error creating staking transaction" };
  }
};






export const unstakeTokenService = async (
  mintPublicKey: PublicKey,
  userPublicKey: PublicKey
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

    // Fetch the user's staking account to get the staked amount
    const userStakingAccount = await program.account.userStakingAccount.fetch(
      userStakingAccountPublicKey
    );


    // Get the latest blockhash
    const { blockhash } = await connection.getLatestBlockhash('finalized');

    // ✅ Create an unsigned transaction to unstake all tokens
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
      .transaction(); // ⬅️ Create transaction, don't sign

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


interface UserStakingAccount {
  owner: PublicKey;
  stakedAmount: anchor.BN;
  stakeTimestamp: anchor.BN;
  lockDuration: anchor.BN;
}

export const getUserStakingAccount = async (userPublicKey: PublicKey) => {
  try {
    const { program, connection } = getProgram();

    // Derive the public key for the user staking account
    const [userStakingAccountPublicKey] = PublicKey.findProgramAddressSync(
      [Buffer.from("user_stake"), userPublicKey.toBuffer()],
      program.programId
    );

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



    // ✅ Convert stakedAmount from base units
    const tokenDecimals = 9;  // Adjust token decimals as needed
    const readableStakedAmount = userStakingAccount.stakedAmount.toNumber() / (10 ** tokenDecimals);

    // Ensure that the fields are defined and use safe .toString() calls
    const rawData = {
      owner: userStakingAccount.owner.toBase58(),
      stakedAmount: readableStakedAmount,
      stakeTimestamp: userStakingAccount.stakeTimestamp.toString(),
      stakeDuration: userStakingAccount.lockDuration.toString(),
    };

    console.log("✅ Raw User Staking Account Data:", rawData);

    return { success: true, data: rawData };
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
        transaction: Buffer.from(transaction.serialize({ requireAllSignatures: false })).toString("base64"),
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
    const { adminKeypair } = getProgram();
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
    const { userKeypair, userPublicKey, connection } = getProgram();


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
