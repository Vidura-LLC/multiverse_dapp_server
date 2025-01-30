import {
  Connection,
  PublicKey,
  Keypair,
  SystemProgram,
  clusterApiUrl,
} from "@solana/web3.js";
import * as anchor from "@project-serum/anchor";
import {
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddressSync,
  TOKEN_2022_PROGRAM_ID,
} from "@solana/spl-token";
import { bs58 } from "@project-serum/anchor/dist/cjs/utils/bytes";
import dotenv from "dotenv";

dotenv.config();

// Load the user's secret key from `.env`
const userSecretBase58 = process.env.SECRET_KEY;
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
