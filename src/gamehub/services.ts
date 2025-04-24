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
import dotenv from "dotenv";
import { BN } from "bn.js";


dotenv.config();


// 🔹 Helper function to get the program
const getProgram = () => {
  const idl = require("../gamehub/gamehub_idl.json");
  const walletKeypair = require("../staking/saadat7s-wallet-keypair.json");

  const adminKeypair = Keypair.fromSecretKey(new Uint8Array(walletKeypair));
  const adminPublicKey = adminKeypair.publicKey;

  const burnWalletKeypair = require("../staking/testWallet.json");

  const burnKeypair = Keypair.fromSecretKey(new Uint8Array(burnWalletKeypair));
  const burnPublicKey = burnKeypair.publicKey;
  const connection = new Connection(clusterApiUrl("devnet"), "confirmed");

  const programId = new PublicKey(
    "BmBAppuJQGGHmVizxKLBpJbFtq8yGe9v7NeVgHPEM4Vs" // Updated to match the program ID from contract
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
    burnKeypair,
    burnPublicKey
  };
};

// ✅ Function to initialize the tournament pool
export const initializeTournamentPool = async (
  adminPublicKey: PublicKey,
  tournamentId: string,
  entryFee: number,
  maxParticipants: number,
  endTime: number,
  mintPublicKey: PublicKey
) => {
  try {
    const { program, connection, adminKeypair } = getProgram();

    // 🔹 Convert tournamentId correctly
    const tournamentIdBytes = Buffer.from(tournamentId, "utf8"); // Ensure UTF-8 encoding

    // 🔹 Derive the correct PDA for the tournament pool
    const [tournamentPoolPublicKey] = PublicKey.findProgramAddressSync(
      [Buffer.from("tournament_pool"), adminPublicKey.toBuffer(), tournamentIdBytes],
      program.programId
    );

    // 🔹 Derive the escrow PDA correctly
    const [poolEscrowAccountPublicKey] = PublicKey.findProgramAddressSync(
      [Buffer.from("escrow"), tournamentPoolPublicKey.toBuffer()],
      program.programId
    );

    console.log("✅ Tournament Pool PDA:", tournamentPoolPublicKey.toString());
    console.log("✅ Pool Escrow PDA:", poolEscrowAccountPublicKey.toString());

    const { blockhash } = await connection.getLatestBlockhash("finalized");
    const entryFeeBN = new BN(entryFee);
    const maxParticipantsBN = new BN(maxParticipants);
    const endTimeBN = new BN(endTime);

    // 🔹 Create and sign the transaction
    const transaction = await program.methods
      .createTournamentPool(
        tournamentId,
        entryFeeBN,
        maxParticipantsBN,
        endTimeBN
      )
      .accounts({
        admin: adminPublicKey,
        tournamentPool: tournamentPoolPublicKey,
        poolEscrowAccount: poolEscrowAccountPublicKey,
        mint: mintPublicKey,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .transaction();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = adminPublicKey;
      // Sign the transaction with the user's keypair
      await transaction.sign(adminKeypair); // Sign the transaction with the user keypair
  
      // Send the transaction to the Solana network and get the signature
      const transactionSignature = await connection.sendTransaction(transaction, [adminKeypair], {
        skipPreflight: false,
        preflightCommitment: 'processed',
      });
  
   // Confirm the transaction
   const confirmation = await connection.confirmTransaction(transactionSignature, 'confirmed');
  
      return {
        success: true,
        message: "Tournament pool created successfully",
        transactionSignature
      };
    } catch (err) {
      console.error("❌ Error creating tournament pool:", err);
      return {
        success: false,
        message: `Error creating tournament pool: ${err.message || err}`
      };
    }
  };
  

// Get tournament pool data
export const getTournamentPool = async (tournamentId: string, adminPublicKey: PublicKey) => {
  try {
    const { program } = getProgram();

    const tournamentIdBytes = Buffer.from(tournamentId, "utf8");

    const [tournamentPoolPublicKey] = PublicKey.findProgramAddressSync(
      [Buffer.from("tournament_pool"), adminPublicKey.toBuffer(), tournamentIdBytes],
      program.programId
    );
    // 🔹 Fetch the tournament pool data
    const tournamentPoolData = (await program.account.tournamentPool.fetch(
      tournamentPoolPublicKey
    )) as TournamentPoolAccount;

    return {
      success: true,
      data: {
        admin: tournamentPoolData.admin.toString(),
        mint: tournamentPoolData.mint.toString(),
        tournamentId: Buffer.from(tournamentPoolData.tournamentId).toString().replace(/\0+$/, ""),
        entryFee: tournamentPoolData.entryFee.toString(),
        totalFunds: tournamentPoolData.totalFunds.toString(),
        participantCount: tournamentPoolData.participantCount,
        maxParticipants: tournamentPoolData.maxParticipants,
        endTime: new Date(tournamentPoolData.endTime * 1000).toISOString(),
        isActive: tournamentPoolData.isActive,
      }
    };
  } catch (err) {
    console.error("❌ Error fetching tournament pool:", err);
    return { success: false, message: "Error fetching tournament data" };
  }
};

// Register for tournament
export const registerForTournament = async (
  tournamentId: string,
  userPublicKey: PublicKey,
  adminPublicKey: PublicKey
) => {
  try {
    const { program, connection } = getProgram();

    const tournamentIdBytes = Buffer.from(tournamentId, "utf8");

    // Get tournament pool PDA
    const [tournamentPoolPublicKey] = PublicKey.findProgramAddressSync(
      [Buffer.from("tournament_pool"), adminPublicKey.toBuffer(), tournamentIdBytes],
      program.programId
    );
    // 🔹 Fetch the tournament pool data
    const tournamentPoolData = (await program.account.tournamentPool.fetch(
      tournamentPoolPublicKey
    )) as TournamentPoolAccount;
    const mintPublicKey = tournamentPoolData.mint;

    // Get escrow PDA
    const [poolEscrowAccountPublicKey] = PublicKey.findProgramAddressSync(
      [Buffer.from("escrow"), tournamentPoolPublicKey.toBuffer()],
      program.programId
    );

    // Get registration PDA
    const [registrationAccountPublicKey] = PublicKey.findProgramAddressSync(
      [Buffer.from("registration"), tournamentPoolPublicKey.toBuffer(), userPublicKey.toBuffer()],
      program.programId
    );

    const userTokenAccount = await getOrCreateAssociatedTokenAccount(connection, mintPublicKey, userPublicKey);

    console.log('User Token Account Public:', userTokenAccount);

    const transaction = await program.methods
      .registerForTournament(tournamentId)
      .accounts({
        user: userPublicKey,
        tournamentPool: tournamentPoolPublicKey,
        registrationAccount: registrationAccountPublicKey,
        userTokenAccount: userTokenAccount,
        poolEscrowAccount: poolEscrowAccountPublicKey,
        mint: mintPublicKey,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .transaction();

    const { blockhash } = await connection.getLatestBlockhash("finalized");
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = userPublicKey;



    return {
      success: true,
      message: "Successfully created transaction for registering for tournament",
      transaction: transaction.serialize({ requireAllSignatures: false }),
    };
  } catch (err) {
    console.error("❌ Error registering for tournament:", err);
    return {
      success: false,
      message: `Error registering for tournament: ${err.message || err}`
    };
  }
};

// End tournament
export const endTournament = async (
  tournamentId: string,
  winnerPercentages: number[],
  winnerAddresses: string[]
) => {
  try {
    const { program, connection, adminKeypair, adminPublicKey } = getProgram();

    const tournamentIdBytes = Buffer.from(tournamentId, "utf8");

    // Get tournament pool PDA
    const [tournamentPoolPublicKey] = PublicKey.findProgramAddressSync(
      [Buffer.from("tournament_pool"), adminPublicKey.toBuffer(), tournamentIdBytes],
      program.programId
    );

    // Get tournament data to access mint
    // 🔹 Fetch the tournament pool data
    const tournamentPoolData = (await program.account.tournamentPool.fetch(
      tournamentPoolPublicKey
    )) as TournamentPoolAccount;
    const mintPublicKey = tournamentPoolData.mint;

    // Get escrow PDA
    const [poolEscrowAccountPublicKey] = PublicKey.findProgramAddressSync(
      [Buffer.from("escrow"), tournamentPoolPublicKey.toBuffer()],
      program.programId
    );

    // Convert winner addresses to PublicKey objects
    const winnerPublicKeys = winnerAddresses.map(address => new PublicKey(address));

    // Convert percentages to u8 array
    const winnerPercentagesU8 = Uint8Array.from(winnerPercentages);

    const tx = await program.methods
      .endTournament(tournamentId, winnerPercentagesU8, winnerPublicKeys)
      .accounts({
        admin: adminPublicKey,
        tournamentPool: tournamentPoolPublicKey,
        poolEscrowAccount: poolEscrowAccountPublicKey,
        mint: mintPublicKey,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .transaction();

    const { blockhash } = await connection.getLatestBlockhash("finalized");
    tx.recentBlockhash = blockhash;
    tx.feePayer = adminPublicKey;

    tx.sign(adminKeypair);
    const signature = await connection.sendRawTransaction(tx.serialize());
    await connection.confirmTransaction(signature);

    return {
      success: true,
      message: "Tournament ended successfully",
      signature
    };
  } catch (err) {
    console.error("❌ Error ending tournament:", err);
    return {
      success: false,
      message: `Error ending tournament: ${err.message || err}`
    };
  }
};

// Cancel tournament
export const cancelTournament = async (tournamentId: string) => {
  try {
    const { program, connection, adminKeypair, adminPublicKey } = getProgram();

    const tournamentIdBytes = Buffer.from(tournamentId, "utf8");

    // Get tournament pool PDA
    const [tournamentPoolPublicKey] = PublicKey.findProgramAddressSync(
      [Buffer.from("tournament_pool"), adminPublicKey.toBuffer(), tournamentIdBytes],
      program.programId
    );

    // Get tournament data to access mint
    // 🔹 Fetch the tournament pool data
    const tournamentPoolData = (await program.account.tournamentPool.fetch(
      tournamentPoolPublicKey
    )) as TournamentPoolAccount;
    const mintPublicKey = tournamentPoolData.mint;

    // Get escrow PDA
    const [poolEscrowAccountPublicKey] = PublicKey.findProgramAddressSync(
      [Buffer.from("escrow"), tournamentPoolPublicKey.toBuffer()],
      program.programId
    );

    const tx = await program.methods
      .cancelTournament(tournamentId)
      .accounts({
        admin: adminPublicKey,
        tournamentPool: tournamentPoolPublicKey,
        poolEscrowAccount: poolEscrowAccountPublicKey,
        mint: mintPublicKey,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .transaction();

    const { blockhash } = await connection.getLatestBlockhash("finalized");
    tx.recentBlockhash = blockhash;
    tx.feePayer = adminPublicKey;

    tx.sign(adminKeypair);
    const signature = await connection.sendRawTransaction(tx.serialize());
    await connection.confirmTransaction(signature);

    return {
      success: true,
      message: "Tournament cancelled successfully",
      signature
    };
  } catch (err) {
    console.error("❌ Error cancelling tournament:", err);
    return {
      success: false,
      message: `Error cancelling tournament: ${err.message || err}`
    };
  }
};










// Helper function to create a token account if it doesn't exist
export const createTokenAccountIfNeeded = async (
  owner: PublicKey,
  mint: PublicKey
) => {
  const { connection, adminKeypair } = getProgram();

  try {
    // Get the associated token address
    const tokenAddress = getAssociatedTokenAddressSync(
      mint,
      owner,
      false,
      TOKEN_2022_PROGRAM_ID
    );

    // Check if the account exists
    const accountInfo = await connection.getAccountInfo(tokenAddress);

    if (!accountInfo) {
      // Create the account if it doesn't exist
      const instruction = createAssociatedTokenAccountInstruction(
        adminKeypair.publicKey,
        tokenAddress,
        owner,
        mint,
        TOKEN_2022_PROGRAM_ID
      );

      const transaction = new anchor.web3.Transaction().add(instruction);
      transaction.feePayer = adminKeypair.publicKey;

      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;

      transaction.sign(adminKeypair);
      const signature = await connection.sendRawTransaction(transaction.serialize());
      await connection.confirmTransaction(signature);

      console.log("✅ Token account created:", tokenAddress.toString());
    } else {
      console.log("✅ Token account already exists:", tokenAddress.toString());
    }

    return { success: true, tokenAddress };
  } catch (err) {
    console.error("❌ Error creating token account:", err);
    return { success: false, message: "Error creating token account" };
  }
};

interface TournamentPoolAccount {
  isActive: any;
  endTime: number;
  participantCount: any;
  maxParticipants: any;
  admin: PublicKey;
  mint: PublicKey, // Admin public key
  tournamentId: string; // Tournament ID
  entryFee: anchor.BN; // Entry fee in base units (e.g., lamports or token units)
  totalFunds: anchor.BN; // Total funds accumulated in the pool
  bump: number; // Bump seed for the tournament pool account
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

// ✅ Function to initialize the tournament pool
export const initializeTournamentPoolWithKeypair = async (
  adminPublicKey: PublicKey,
  tournamentId: string,
  entryFee: number,
  maxParticipants: number,
  endTime: number,
  mintPublicKey: PublicKey
) => {
  try {
    const { program, connection, adminKeypair } = getProgram();

    // 🔹 Convert tournamentId correctly
    const tournamentIdBytes = Buffer.from(tournamentId, "utf8"); // Ensure UTF-8 encoding

    // 🔹 Derive the correct PDA for the tournament pool
    const [tournamentPoolPublicKey] = PublicKey.findProgramAddressSync(
      [Buffer.from("tournament_pool"), adminPublicKey.toBuffer(), tournamentIdBytes],
      program.programId
    );

    // 🔹 Derive the escrow PDA correctly
    const [poolEscrowAccountPublicKey] = PublicKey.findProgramAddressSync(
      [Buffer.from("escrow"), tournamentPoolPublicKey.toBuffer()],
      program.programId
    );

    console.log("✅ Tournament Pool PDA:", tournamentPoolPublicKey.toString());
    console.log("✅ Pool Escrow PDA:", poolEscrowAccountPublicKey.toString());

    const slot = await connection.getSlot();
    const blockTime = await connection.getBlockTime(slot);
    console.log("Current Solana blockchain time:", blockTime);
    console.log("Provided end time:", endTime);
    console.log("Time difference (seconds):", endTime - blockTime);
    console.log("Time difference (days):", (endTime - blockTime) / 86400);

    const { blockhash } = await connection.getLatestBlockhash("finalized");
    const entryFeeBN = new BN(entryFee);
    const maxParticipantsBN = new BN(maxParticipants);
    const endTimeBN = new BN(endTime);

    // 🔹 Create and sign the transaction
    const transaction = await program.methods
      .createTournamentPool(
        tournamentId,
        entryFeeBN,
        maxParticipantsBN,
        endTimeBN
      )
      .accounts({
        admin: adminPublicKey,
        tournamentPool: tournamentPoolPublicKey,
        poolEscrowAccount: poolEscrowAccountPublicKey,
        mint: mintPublicKey,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .transaction();

    transaction.recentBlockhash = blockhash;
    transaction.feePayer = adminPublicKey;
    // Sign the transaction with the user's keypair
    await transaction.sign(adminKeypair); // Sign the transaction with the user keypair

    // Send the transaction to the Solana network and get the signature
    const transactionSignature = await connection.sendTransaction(transaction, [adminKeypair], {
      skipPreflight: false,
      preflightCommitment: 'processed',
    });

 // Confirm the transaction
 const confirmation = await connection.confirmTransaction(transactionSignature, 'confirmed');

    return {
      success: true,
      message: "Tournament pool created successfully",
      transactionSignature
    };
  } catch (err) {
    console.error("❌ Error creating tournament pool:", err);
    return {
      success: false,
      message: `Error creating tournament pool: ${err.message || err}`
    };
  }
};



// export const registerForTournamentServiceWithKeypair = async (
//   tournamentId: string,
//   userPublicKey: PublicKey,
//   adminPublicKey: PublicKey
// ) => {
//   try {
//     const { program, connection, adminKeypair } = getProgram();

//     const tournamentIdBytes = Buffer.from(tournamentId, "utf8");

//     // Get tournament pool PDA
//     const [tournamentPoolPublicKey] = PublicKey.findProgramAddressSync(
//       [Buffer.from("tournament_pool"), adminPublicKey.toBuffer(), tournamentIdBytes],
//       program.programId
//     );
//     // 🔹 Fetch the tournament pool data
//     const tournamentPoolData = (await program.account.tournamentPool.fetch(
//       tournamentPoolPublicKey
//     )) as TournamentPoolAccount;
//     const mintPublicKey = tournamentPoolData.mint;

//     // Get escrow PDA
//     const [poolEscrowAccountPublicKey] = PublicKey.findProgramAddressSync(
//       [Buffer.from("escrow"), tournamentPoolPublicKey.toBuffer()],
//       program.programId
//     );

//     // Get registration PDA
//     const [registrationAccountPublicKey] = PublicKey.findProgramAddressSync(
//       [Buffer.from("registration"), tournamentPoolPublicKey.toBuffer(), userPublicKey.toBuffer()],
//       program.programId
//     );

//     const userTokenAccount = await getOrCreateAssociatedTokenAccount(connection, mintPublicKey, userPublicKey);

//     console.log('User Token Account Public:', userTokenAccount);

//     const transaction = await program.methods
//       .registerForTournament(tournamentId)
//       .accounts({
//         user: userPublicKey,
//         tournamentPool: tournamentPoolPublicKey,
//         registrationAccount: registrationAccountPublicKey,
//         userTokenAccount: userTokenAccount,
//         poolEscrowAccount: poolEscrowAccountPublicKey,
//         mint: mintPublicKey,
//         tokenProgram: TOKEN_2022_PROGRAM_ID,
//         systemProgram: SystemProgram.programId,
//       })
//       .transaction();

//     const { blockhash } = await connection.getLatestBlockhash("finalized");
//     transaction.recentBlockhash = blockhash;
//     transaction.feePayer = userPublicKey;

//     // Sign the transaction with the user's keypair
//     await transaction.sign(adminKeypair); // Sign the transaction with the user keypair

//     // Send the transaction to the Solana network and get the signature
//     const transactionSignature = await connection.sendTransaction(transaction, [adminKeypair], {
//       skipPreflight: false,
//       preflightCommitment: 'processed',
//     });

//     // Confirm the transaction
//     const confirmation = await connection.confirmTransaction(transactionSignature, 'confirmed');



//     return {
//       success: true,
//       message: 'Transaction created, signed, and sent successfully!',
//       transactionSignature,
//     };
//   } catch (err) {
//     console.error('❌ Error registering for tournament:', err);
//     return { success: false, message: 'Error registering for tournament' };
//   }
// };





