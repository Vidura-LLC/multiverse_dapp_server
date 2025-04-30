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
  import { ref, get, update } from "firebase/database";
  import { db } from "../config/firebase";
  import { getUserStakingAccount } from "../staking/services";
import { getTournamentPool } from "../gamehub/services";

dotenv.config();

// Default percentage splits based on updated requirements
const DEFAULT_SPLITS = {
  PRIZE_POOL: 40,    // 40% to tournament's prize pool
  REVENUE_POOL: 50,  // 50% to global revenue pool
  STAKING_POOL: 5,   // 5% to staking pool
  BURN: 5            // 5% to burn (2.5% Kaya and 2.5% CRD)
};


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

/**
 * Initialize the global revenue pool
 * @param mintPublicKey - The token mint address
 * @returns Result object with transaction details and addresses
 */
export const initializeRevenuePoolService = async (mintPublicKey: PublicKey) => {
    try {
      const { program, adminPublicKey, adminKeypair, connection } = getProgram();
  
      // Log initial parameters for clarity
      console.log("Initializing Revenue Pool:");
      console.log("Admin PublicKey:", adminPublicKey.toBase58());
      console.log("Mint PublicKey:", mintPublicKey.toBase58());
  
      // Derive the PDA for the revenue pool
      const [revenuePoolPublicKey] = PublicKey.findProgramAddressSync(
        [Buffer.from("revenue_pool"), adminPublicKey.toBuffer()],
        program.programId
      );
  
      // Derive the PDA for the revenue escrow account
      const [revenueEscrowPublicKey] = PublicKey.findProgramAddressSync(
        [Buffer.from("revenue_escrow"), revenuePoolPublicKey.toBuffer()],
        program.programId
      );
  
      console.log("🔹 Revenue Pool PDA Address:", revenuePoolPublicKey.toString());
      console.log("🔹 Revenue Escrow PDA Address:", revenueEscrowPublicKey.toString());
  
      // Get the latest blockhash
      const { blockhash } = await connection.getLatestBlockhash("finalized");
      console.log("Latest Blockhash:", blockhash);
  
      // Create the transaction
      const transaction = await program.methods
        .initializeRevenuePool()
        .accounts({
          revenuePool: revenuePoolPublicKey,
          revenueEscrowAccount: revenueEscrowPublicKey,
          mint: mintPublicKey,
          admin: adminPublicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .transaction();
  
      // Set recent blockhash and fee payer
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = adminPublicKey;
  
      // Sign and send the transaction
      transaction.sign(adminKeypair);
      
      console.log("Sending transaction...");
      const signature = await connection.sendRawTransaction(
        transaction.serialize(),
        { skipPreflight: false, preflightCommitment: "confirmed" }
      );
      
      console.log("Transaction sent, signature:", signature);
      
      // Wait for confirmation
      const confirmation = await connection.confirmTransaction(signature, "confirmed");
      console.log("Transaction confirmed:", confirmation);
  
      return {
        success: true,
        message: "Revenue pool initialized successfully!",
        signature: signature,
        revenuePoolAddress: revenuePoolPublicKey.toString(),
        revenueEscrowAddress: revenueEscrowPublicKey.toString()
      };
    } catch (err) {
      console.error("❌ Error initializing revenue pool:", err);
      return {
        success: false,
        message: `Error initializing revenue pool: ${err.message || err}`
      };
    }
  };
  
  /**
   * Initialize a prize pool for a specific tournament
   * @param tournamentId - The tournament ID
   * @param mintPublicKey - The token mint address
   * @returns Result object with transaction details and addresses
   */
  export const initializePrizePoolService = async (tournamentId: string, mintPublicKey: PublicKey) => {
    try {
      const { program, adminPublicKey, adminKeypair, connection } = getProgram();
  
      // Log initial parameters for clarity
      console.log("Initializing Prize Pool for Tournament:");
      console.log("Tournament ID:", tournamentId);
      console.log("Admin PublicKey:", adminPublicKey.toBase58());
      console.log("Mint PublicKey:", mintPublicKey.toBase58());
  
      // First, derive the tournament pool PDA to ensure it exists
      const tournamentIdBytes = Buffer.from(tournamentId, "utf8");
      const [tournamentPoolPublicKey] = PublicKey.findProgramAddressSync(
        [Buffer.from("tournament_pool"), adminPublicKey.toBuffer(), tournamentIdBytes],
        program.programId
      );
      
      console.log("🔹 Tournament Pool PDA Address:", tournamentPoolPublicKey.toString());
      
      // Add this to initializePrizePoolService
      console.log("Full tournament pool key:", tournamentPoolPublicKey.toString());
      console.log("Tournament ID bytes:", tournamentIdBytes);
      console.log("Admin pubkey:", adminPublicKey.toString());
  
      // Derive the PDA for the prize pool (now derived from tournament pool)
      const [prizePoolPublicKey] = PublicKey.findProgramAddressSync(
        [Buffer.from("prize_pool"), tournamentPoolPublicKey.toBuffer()],
        program.programId
      );
  
      // Derive the PDA for the prize escrow account
      const [prizeEscrowPublicKey] = PublicKey.findProgramAddressSync(
        [Buffer.from("prize_escrow"), prizePoolPublicKey.toBuffer()],
        program.programId
      );
  
      console.log("🔹 Prize Pool PDA Address:", prizePoolPublicKey.toString());
      console.log("🔹 Prize Escrow PDA Address:", prizeEscrowPublicKey.toString());
  
      // Get the latest blockhash
      const { blockhash } = await connection.getLatestBlockhash("finalized");
      console.log("Latest Blockhash:", blockhash);
  
      // Create the transaction
      const transaction = await program.methods
        .initializePrizePool(tournamentId)
        .accounts({
          prizePool: prizePoolPublicKey,
          tournamentPool: tournamentPoolPublicKey,
          prizeEscrowAccount: prizeEscrowPublicKey,
          mint: mintPublicKey,
          admin: adminPublicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .transaction();
  
      // Set recent blockhash and fee payer
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = adminPublicKey;
  
      // Sign and send the transaction
      transaction.sign(adminKeypair);
      
      console.log("Sending transaction...");
      const signature = await connection.sendRawTransaction(
        transaction.serialize(),
        { skipPreflight: false, preflightCommitment: "confirmed" }
      );
      
      console.log("Transaction sent, signature:", signature);
      
      // Wait for confirmation
      const confirmation = await connection.confirmTransaction(signature, "confirmed");
      console.log("Transaction confirmed:", confirmation);
  
      return {
        success: true,
        message: `Prize pool for tournament ${tournamentId} initialized successfully!`,
        signature: signature,
        tournamentId,
        tournamentPoolAddress: tournamentPoolPublicKey.toString(),
        prizePoolAddress: prizePoolPublicKey.toString(),
        prizeEscrowAddress: prizeEscrowPublicKey.toString()
      };
    } catch (err) {
      console.error("❌ Error initializing prize pool:", err);
      return {
        success: false,
        message: `Error initializing prize pool: ${err.message || err}`
      };
    }
  };
  
  
  /**
   * Distribute tournament revenue according to the specified percentages
   * @param tournamentId - The tournament ID
   * @param prizePercentage - Percentage for prize pool (default 40%)
   * @param revenuePercentage - Percentage for revenue pool (default 50%)
   * @param stakingPercentage - Percentage for staking pool (default 5%)
   * @param burnPercentage - Percentage for burn (default 5%)
   * @returns Result object with distribution details
   */
  export const distributeTournamentRevenueService = async (
    tournamentId: string,
    prizePercentage: number = DEFAULT_SPLITS.PRIZE_POOL,
    revenuePercentage: number = DEFAULT_SPLITS.REVENUE_POOL,
    stakingPercentage: number = DEFAULT_SPLITS.STAKING_POOL,
    burnPercentage: number = DEFAULT_SPLITS.BURN
  ) => {
    try {
      const { program, adminPublicKey, adminKeypair, burnPublicKey, burnKeypair, connection } = getProgram();
  
  
      // 1. First, check if tournament exists and is active in Firebase
      console.log("Verifying tournament in Firebase...");
      const tournamentRef = ref(db, `tournaments/${tournamentId}`);
      const tournamentSnapshot = await get(tournamentRef);
      
      if (!tournamentSnapshot.exists()) {
        return {
          success: false,
          message: `Tournament with ID ${tournamentId} not found in database`
        };
      }
      
      const tournament = tournamentSnapshot.val();
      
      if (tournament.status !== "Active" && tournament.status !== "Ended") {
        return {
          success: false,
          message: `Tournament cannot be distributed because it is in '${tournament.status}' status`
        };
      }
  
      // Check if tournament has already been distributed
      if (tournament.distributionCompleted) {
        return {
          success: false,
          message: "Tournament revenue has already been distributed"
        };
      }
  
      // 2. Derive all the necessary PDAs
      console.log("Deriving program addresses...");
      const tournamentIdBytes = Buffer.from(tournamentId, "utf8");
  
      // Tournament Pool PDA
      const [tournamentPoolPublicKey] = PublicKey.findProgramAddressSync(
        [Buffer.from("tournament_pool"), adminPublicKey.toBuffer(), tournamentIdBytes],
        program.programId
      );
      console.log("🔹 Tournament Pool PDA:", tournamentPoolPublicKey.toString());
  
      // Prize Pool PDA (derived from tournament pool)
      const [prizePoolPublicKey] = PublicKey.findProgramAddressSync(
        [Buffer.from("prize_pool"), tournamentPoolPublicKey.toBuffer()],
        program.programId
      );
      console.log("🔹 Prize Pool PDA:", prizePoolPublicKey.toString());
  
      // Revenue Pool PDA
      const [revenuePoolPublicKey] = PublicKey.findProgramAddressSync(
        [Buffer.from("revenue_pool"), adminPublicKey.toBuffer()],
        program.programId
      );
      console.log("🔹 Revenue Pool PDA:", revenuePoolPublicKey.toString());


      const [stakingPoolPublicKey] = PublicKey.findProgramAddressSync(
      [Buffer.from("staking_pool"), adminPublicKey.toBuffer()],
      program.programId
    );
    console.log("🔹 Staking Pool PDA Address:", stakingPoolPublicKey.toString());


  
      // 3. Derive escrow accounts
      const [tournamentEscrowPublicKey] = PublicKey.findProgramAddressSync(
        [Buffer.from("escrow"), tournamentPoolPublicKey.toBuffer()],
        program.programId
      );
      console.log("🔹 Tournament Escrow PDA:", tournamentEscrowPublicKey.toString());
  
      const [prizeEscrowPublicKey] = PublicKey.findProgramAddressSync(
        [Buffer.from("prize_escrow"), prizePoolPublicKey.toBuffer()],
        program.programId
      );
      console.log("🔹 Prize Escrow PDA:", prizeEscrowPublicKey.toString());
  
      const [revenueEscrowPublicKey] = PublicKey.findProgramAddressSync(
        [Buffer.from("revenue_escrow"), revenuePoolPublicKey.toBuffer()],
        program.programId
      );
      console.log("🔹 Revenue Escrow PDA:", revenueEscrowPublicKey.toString());
  
      const [stakingEscrowAccountPublicKey] = PublicKey.findProgramAddressSync(
        [Buffer.from("escrow"), stakingPoolPublicKey.toBuffer()],
        program.programId
      );
  
      console.log("🔹 Staking Escrow PDA:", stakingEscrowAccountPublicKey.toString());
  
  
      
      // 4. Fetch tournament data using getTournamentPool
      console.log("Fetching tournament data from blockchain...");
      try {
        // Use the getTournamentPool function instead of directly fetching
        const tournamentPoolResult = await getTournamentPool(tournamentId, adminPublicKey);
        
        if (!tournamentPoolResult.success) {
          return {
            success: false,
            message: `Failed to fetch tournament data: ${tournamentPoolResult.message || "Unknown error"}`
          };
        }
        
        const tournamentPoolData = tournamentPoolResult.data;
        
        // Get mint address from tournament data
        const mintPublicKey = new PublicKey(tournamentPoolData.mint);
        console.log("🔹 Token Mint:", mintPublicKey.toString());
        
        // Calculate total funds
        const totalFunds = Number(tournamentPoolData.totalFunds);
        console.log("🔹 Total Tournament Funds:", totalFunds);
        
        if (totalFunds <= 0) {
          return {
            success: false,
            message: "Tournament has no funds to distribute"
          };
        }
  
        // // 5. Create or get the burn token account
        // console.log("Setting up burn token account...");
        // const burnTokenAccount = getAssociatedTokenAddressSync(
        //   mintPublicKey,
        //   burnPublicKey,
        //   false,
        //   TOKEN_2022_PROGRAM_ID
        // );
        
        // // Check if the burn token account exists and create it if not
        // const burnTokenAccountInfo = await connection.getAccountInfo(burnTokenAccount);
        // if (!burnTokenAccountInfo) {
        //   console.log("Creating burn token account...");
        //   const createATAIx = createAssociatedTokenAccountInstruction(
        //     adminPublicKey,
        //     burnTokenAccount,
        //     burnPublicKey,
        //     mintPublicKey,
        //     TOKEN_2022_PROGRAM_ID
        //   );
          
        //   const createATATx = new anchor.web3.Transaction().add(createATAIx);
        //   createATATx.feePayer = adminPublicKey;
        //   createATATx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
          
        //   await connection.sendTransaction(createATATx, [adminKeypair]);
        //   console.log("Burn token account created:", burnTokenAccount.toString());
        // } else {
        //   console.log("Burn token account exists:", burnTokenAccount.toString());
        // }
  
        // 6. Execute the transaction
        console.log("Creating distribution transaction...");
           // Create transaction
    const tx = await program.methods
    .distributeTournamentRevenue(
      tournamentId,
      prizePercentage,
      revenuePercentage,
      stakingPercentage,
      burnPercentage
    )
    .accounts({
      admin: adminPublicKey,
      tournamentPool: tournamentPoolPublicKey,
      prizePool: prizePoolPublicKey,
      revenuePool: revenuePoolPublicKey,
      stakingPool: stakingPoolPublicKey,
      tournamentEscrowAccount: tournamentEscrowPublicKey,
      prizeEscrowAccount: prizeEscrowPublicKey,
      revenueEscrowAccount: revenueEscrowPublicKey,
      stakingEscrowAccount: stakingEscrowAccountPublicKey,
      // burnTokenAccount: burnTokenAccount,
      // burnAuthority: burnPublicKey,
      mint: mintPublicKey,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
    })
    .transaction();

  // Set recent blockhash and fee payer
  const { blockhash } = await connection.getLatestBlockhash("finalized");
  tx.recentBlockhash = blockhash;
  tx.feePayer = adminPublicKey;

  // Make sure transaction is properly signed
  tx.sign(adminKeypair);

  // Send and confirm transaction
  const signature = await connection.sendRawTransaction(tx.serialize(), {
    skipPreflight: false,
    preflightCommitment: "confirmed",
  });
  console.log("Transaction sent with signature:", signature);
        
        // Wait for confirmation
        console.log("Waiting for transaction confirmation...");
        const confirmation = await connection.confirmTransaction(signature, "confirmed");
        console.log("Transaction confirmed:", confirmation);
  
        // Calculate actual distribution amounts
        const prizeAmount = Math.floor((totalFunds * prizePercentage) / 100);
        const revenueAmount = Math.floor((totalFunds * revenuePercentage) / 100);
        const stakingAmount = Math.floor((totalFunds * stakingPercentage) / 100);
        const burnAmount = Math.floor((totalFunds * burnPercentage) / 100);
  
        // 7. Update tournament status in Firebase
        console.log("Updating tournament status in Firebase...");
        await update(tournamentRef, {
          status: "Completed",
          distributionCompleted: true,
          distributionTimestamp: Date.now(),
          distributionDetails: {
            totalDistributed: totalFunds,
            prizeAmount,
            revenueAmount,
            stakingAmount,
            burnAmount,
            transactionSignature: signature
          }
        });
  
        return {
          success: true,
          message: "Tournament revenue distributed successfully!",
          signature,
          tournamentId,
          distribution: {
            totalFunds,
            prizeAmount,
            revenueAmount,
            stakingAmount,
            burnAmount
          }
        };
      } catch (err) {
        console.error("❌ Error fetching tournament data or executing transaction:", err);
        return {
          success: false,
          message: `Error with tournament data or transaction: ${err.message || err}`
        };
      }
    } catch (err) {
      console.error("❌ Error distributing tournament revenue:", err);
      return {
        success: false,
        message: `Error distributing tournament revenue: ${err.message || err}`
      };
    }
  };
  