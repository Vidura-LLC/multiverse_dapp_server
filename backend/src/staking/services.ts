//backend/src/staking/services.ts


import {
  Connection,
  PublicKey,
  Keypair,
  SystemProgram,
  clusterApiUrl,
} from "@solana/web3.js";
import { Metaplex, keypairIdentity } from "@metaplex-foundation/js";
import { Metadata } from "@metaplex-foundation/mpl-token-metadata"; // ✅ Import Metadata Module
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

// Load the user's secret key from `.env`
const userSecretBase58 =  process.env.SECRET_KEY;
if (!userSecretBase58) {
  throw new Error("USER_SECRET_KEY is missing in .env");
}
const userSecretKey = bs58.decode(userSecretBase58);
const userKeypair = Keypair.fromSecretKey(userSecretKey);
console.log("User Public Key:", userKeypair.publicKey.toBase58()); // Debugging

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
  amount: number
) => {
  try {
    const { program, adminPublicKey, connection } = getProgram();
    const userPublicKey = userKeypair.publicKey;

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

    // ✅ Ensure user token account exists
    const userTokenAccountPublicKey = await getOrCreateAssociatedTokenAccount(
      connection,
      mintPublicKey,
      userPublicKey
    );

    console.log("✅ Staking with:", {
      userPublicKey: userPublicKey.toBase58(),
      stakingPoolPublicKey: stakingPoolPublicKey.toBase58(),
      userStakingAccountPublicKey: userStakingAccountPublicKey.toBase58(),
      userTokenAccountPublicKey: userTokenAccountPublicKey.toBase58(),
      poolEscrowAccountPublicKey: poolEscrowAccountPublicKey.toBase58(),
    });

    await program.methods
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
      .signers([userKeypair])
      .rpc();

    return { success: true, message: "Tokens staked successfully!" };
  } catch (err) {
    console.error("❌ Error staking tokens:", err);
    return { success: false, message: "Error staking tokens" };
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

    await anchor.web3.sendAndConfirmTransaction(connection, transaction, [
      userKeypair,
    ]);
    console.log(`✅ Successfully created ATA: ${associatedTokenAddress.toBase58()}`);
  } else {
    console.log(`🔹 Token account exists: ${associatedTokenAddress.toBase58()}`);
  }

  return associatedTokenAddress;
}


export const unstakeTokenService = async (
  mintPublicKey: PublicKey,
  amount: number
) => {
  try {
    const { program, adminPublicKey, connection } = getProgram();
    const userPublicKey = userKeypair.publicKey;

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

    console.log("✅ Unstaking:", {
      userPublicKey: userPublicKey.toBase58(),
      stakingPoolPublicKey: stakingPoolPublicKey.toBase58(),
      userStakingAccountPublicKey: userStakingAccountPublicKey.toBase58(),
      userTokenAccountPublicKey: userTokenAccountPublicKey.toBase58(),
      poolEscrowAccountPublicKey: poolEscrowAccountPublicKey.toBase58(),
    });

    await program.methods
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
      .signers([userKeypair])
      .rpc();

    return { success: true, message: "Tokens unstaked successfully!" };
  } catch (err) {
    console.error("❌ Error unstaking tokens:", err);
    return { success: false, message: "Error unstaking tokens" };
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




export const getTokenMetadata = async (mintAddress: PublicKey) => {
  try {
    // ✅ Connect to Solana
    const connection = new Connection("https://api.devnet.solana.com", "confirmed");

    // ✅ Step 1: Fetch Mint Account Data (Ensures token exists)
    const mintAccountInfo = await connection.getAccountInfo(mintAddress);
    if (!mintAccountInfo) {
      return { success: false, message: "Mint address is invalid or does not exist." };
    }

    // ✅ Step 2: Ensure This Is a Token-2022 Mint
    if (!mintAccountInfo.owner.equals(TOKEN_2022_PROGRAM_ID)) {
      return { success: false, message: "This is not a Token-2022 mint." };
    }

    // ✅ Step 3: Extract Metadata Pointer (URI)
    const decoder = new TextDecoder("utf-8");
    const metadataRaw = decoder.decode(mintAccountInfo.data);
    const metadataUri = metadataRaw.trim(); // Trim any extra whitespace

    if (!metadataUri.startsWith("http")) {
      return { success: false, message: "Metadata URI not found in mint account." };
    }

    console.log("✅ Metadata URI found:", metadataUri);

    // ✅ Step 4: Fetch JSON Metadata from URI
    const response = await fetch(metadataUri);
    if (!response.ok) {
      return { success: false, message: "Failed to fetch metadata from URI." };
    }

    const metadataJson = await response.json();

    // ✅ Step 5: Return Token Metadata
    const metadata = {
      name: metadataJson.name || "Unknown",
      symbol: metadataJson.symbol || "Unknown",
      image: metadataJson.image || "",
      uri: metadataUri,
    };

    console.log("✅ Token Metadata:", metadata);
    return { success: true, data: metadata };
  } catch (err) {
    console.error("❌ Error fetching token metadata:", err);
    return { success: false, message: "Error retrieving token metadata." };
  }
};





