import {
  PublicKey,
  SystemProgram,
} from "@solana/web3.js";
import * as anchor from "@project-serum/anchor";
import {
  getAssociatedTokenAddressSync,
  TOKEN_2022_PROGRAM_ID,
} from "@solana/spl-token";
import dotenv from "dotenv";
import { BN } from "bn.js";
import { createAssociatedTokenAccount, getProgram } from "../staking/services";

dotenv.config();


// Function to initialize the tournament pool
export const initializeTournamentPoolService = async (
  adminPublicKey: PublicKey,
  tournamentId: string,
  entryFee: number,
  maxParticipants: number,
  endTime: number,
  mintPublicKey: PublicKey
) => {
  try {
    const { program, connection } = getProgram();

    // Convert tournamentId correctly
    const tournamentIdBytes = Buffer.from(tournamentId, "utf8"); // Ensure UTF-8 encoding

    // Derive the correct PDA for the tournament pool
    const [tournamentPoolPublicKey] = PublicKey.findProgramAddressSync(
      [Buffer.from("tournament_pool"), adminPublicKey.toBuffer(), tournamentIdBytes],
      program.programId
    );

    // Derive the escrow PDA correctly
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

    // Create the transaction without signing it
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

    // Return the unsigned transaction for frontend to sign
    return {
      success: true,
      message: "Tournament pool transaction created successfully",
      transaction: transaction.serialize({ requireAllSignatures: false }).toString('base64'),
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
    // Fetch the tournament pool data
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
export const registerForTournamentService = async (
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
    // Fetch the tournament pool data
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

    let userTokenAccountPublicKey = await getAssociatedTokenAddressSync(mintPublicKey, userPublicKey, false, TOKEN_2022_PROGRAM_ID);
    console.log("User Token Account PublicKey:", userTokenAccountPublicKey.toBase58());

    if (!userTokenAccountPublicKey) {
      console.log("User Token Account PublicKey does not exist. Creating ATA...");
      const createATAResponse = await createAssociatedTokenAccount(mintPublicKey, userPublicKey);
      console.log("Create ATA Response:", createATAResponse);
      userTokenAccountPublicKey = createATAResponse.associatedTokenAddress;
    }
  

    const transaction = await program.methods
      .registerForTournament(tournamentId)
      .accounts({
        user: userPublicKey,
        tournamentPool: tournamentPoolPublicKey,
        registrationAccount: registrationAccountPublicKey,
        userTokenAccount: userTokenAccountPublicKey,
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
      transaction: transaction.serialize({ requireAllSignatures: false }).toString('base64'),
    };
  } catch (err) {
    console.error("❌ Error registering for tournament:", err);
    return {
      success: false,
      message: `Error registering for tournament: ${err.message || err}`
    };
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