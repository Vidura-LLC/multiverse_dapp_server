import {
    Connection,
    PublicKey,
    Keypair,
    SystemProgram,
    clusterApiUrl,
    Transaction,
  } from "@solana/web3.js";
  import * as anchor from "@project-serum/anchor";
  import { TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
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
  


  