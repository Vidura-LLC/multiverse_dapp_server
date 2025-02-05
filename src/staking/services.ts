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
  getMint
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
  amount: number
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

    // ✅ Create an unsigned transaction
    const transaction = await program.methods
      .stake(new anchor.BN(amount))
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
    const { program } = getProgram();

    const [userStakingAccountPublicKey] = PublicKey.findProgramAddressSync(
      [Buffer.from("user_stake"), userPublicKey.toBuffer()],
      program.programId
    );

    const userStakingAccount = await program.account.userStakingAccount.fetch(
      userStakingAccountPublicKey
    ) as UserStakingAccount;

    // ✅ Convert stakedAmount from base units
    const tokenDecimals = 9;  // Change this if your token has different decimals
    const readableStakedAmount = userStakingAccount.stakedAmount.toNumber() / (10 ** tokenDecimals);

    // ✅ Convert Unix timestamp to readable date
    const stakeDate = new Date(userStakingAccount.stakeTimestamp.toNumber() * 1000).toISOString();

    const formattedData = {
      owner: userStakingAccount.owner.toBase58(),
      stakedAmount: readableStakedAmount,  // ✅ Now human-readable
      stakeTimestamp: stakeDate  // ✅ Now formatted as a date
    };

    console.log("✅ User Staking Account Data:", formattedData);
    
    return { success: true, data: formattedData };
  } catch (err) {
    console.error("❌ Error fetching user staking account:", err);
    return { success: false, message: "User staking account not found or does not exist." };
  }
};







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
