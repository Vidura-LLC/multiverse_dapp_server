import {
    Connection,
    PublicKey,
    Keypair,
    SystemProgram,
    clusterApiUrl,
    Transaction,
  } from "@solana/web3.js";
  import * as anchor from "@project-serum/anchor";
  import { createAssociatedTokenAccountInstruction, getAssociatedTokenAddressSync, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
  import dotenv from "dotenv";
  import { bs58 } from "@project-serum/anchor/dist/cjs/utils/bytes";
import { BN } from "bn.js";
  
  dotenv.config();
  
  // Helper function to get the program
  const getProgram = () => {
    const idl = require("../staking/idl.json");  // The IDL of your smart contract
    const walletKeypair = require("../staking/cosRayAdmin.json"); // Admin wallet keypair
  
    const adminKeypair = Keypair.fromSecretKey(new Uint8Array(walletKeypair));
    const adminPublicKey = adminKeypair.publicKey;
  
    const connection = new Connection(clusterApiUrl("devnet"), "confirmed");
  
    const programId = new PublicKey(
      "BmBAppuJQGGHmVizxKLBpJbFtq8yGe9v7NeVgHPEM4Vs" // Replace with your actual program ID
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
  
  // ✅ Function to create the tournament pool and escrow account
  export const createTournamentPoolService = async (
    tournamentId: string,
    entryFee: number,
    mintPublicKey: PublicKey
  ) => {
    try {
      const { program, adminPublicKey } = getProgram();
  
      // Find the program addresses (PDAs) for the tournament pool and escrow account
      const [tournamentPoolPublicKey] = await PublicKey.findProgramAddressSync(
        [Buffer.from("tournament_pool"), adminPublicKey.toBuffer()],
        program.programId
      );
      
      const [escrowAccountPublicKey] = await PublicKey.findProgramAddressSync(
        [Buffer.from("escrow"), tournamentPoolPublicKey.toBuffer()],
        program.programId
      );
      
  
      console.log("🔹 Tournament Pool PDA Address:", tournamentPoolPublicKey.toString());
      console.log("🔹 Escrow Account PDA Address:", escrowAccountPublicKey.toString());

      const entryFeeBN = new BN(entryFee);
  
      // Call the create_tournament_pool method from the program
      await program.methods
        .createTournamentPool(tournamentId, entryFeeBN, mintPublicKey)
        .accounts({
          admin: adminPublicKey,
          tournamentPool: tournamentPoolPublicKey,
          escrowAccount: escrowAccountPublicKey,
          mint: mintPublicKey,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .rpc();
  
      return { success: true, message: "Tournament pool created successfully!" };
    } catch (err) {
      console.error("❌ Error creating tournament pool:", err);
      return { success: false, message: "Error creating tournament pool" };
    }
  };
  


 // ✅ Function to register for a tournament
export const registerForTournamentService = async (
  mintPublicKey: PublicKey,
  entryFee: number // Assuming this is in the smallest token unit
) => {
  try {
    const { program, adminPublicKey, adminKeypair, connection } = getProgram();

    // Find the tournament pool and escrow account
    const [tournamentPoolPublicKey] = PublicKey.findProgramAddressSync(
      [Buffer.from("tournament_pool"), adminPublicKey.toBuffer()],
      program.programId
    );

    const [escrowAccountPublicKey] = PublicKey.findProgramAddressSync(
      [Buffer.from("escrow"), tournamentPoolPublicKey.toBuffer()],
      program.programId
    );

    // Get the user's token account (create if it doesn't exist)
    const userTokenAccountPublicKey = await getOrCreateAssociatedTokenAccount(
      connection,
      mintPublicKey,
      adminPublicKey
    );

    console.log("User PublicKey:", adminPublicKey.toBase58());
    console.log("Tournament Pool PublicKey:", tournamentPoolPublicKey.toBase58());
    console.log("Escrow Account PublicKey:", escrowAccountPublicKey.toBase58());

    // Get the latest blockhash
    const { blockhash } = await connection.getLatestBlockhash("finalized");

    // Create the unsigned transaction for registering the user
    const transaction = await program.methods
      .registerForTournament(new anchor.BN(entryFee)) // Assuming entryFee is the amount to send
      .accounts({
        user: adminPublicKey,
        tournamentPool: tournamentPoolPublicKey,
        userTokenAccount: userTokenAccountPublicKey,
        escrowAccount: escrowAccountPublicKey,
        mint: mintPublicKey,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .transaction(); // Create the transaction, don't sign it

    transaction.recentBlockhash = blockhash;
    transaction.feePayer = adminPublicKey;

    // Sign the transaction with the user's keypair
    console.log("Signing the transaction with the user's keypair...");
    await transaction.sign(adminKeypair); // Sign the transaction with the user keypair

    // Serialize the transaction and send it to the frontend for submission
    const serializedTransaction = transaction.serialize();
    const transactionBase64 = Buffer.from(serializedTransaction).toString("base64");

    console.log("Serialized Transaction (Base64):", transactionBase64);

    // Send the transaction to the Solana network and get the signature
    const transactionSignature = await connection.sendTransaction(transaction, [adminKeypair], {
      skipPreflight: false,
      preflightCommitment: "processed",
    });

    console.log("Transaction sent successfully, Transaction ID (Signature):", transactionSignature);

    // Confirm the transaction (optional)
    const confirmation = await connection.confirmTransaction(transactionSignature, "confirmed");
    console.log("Transaction confirmation:", confirmation);

    return {
      success: true,
      message: "Transaction created, signed, and sent successfully!",
      transaction: transactionBase64,
      transactionSignature: transactionSignature // Return the transaction ID for reference
    };
  } catch (err) {
    console.error("❌ Error registering for tournament:", err);
    return { success: false, message: "Error registering for tournament" };
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
