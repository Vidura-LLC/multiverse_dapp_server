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
import { ref, get } from "firebase/database";
import { db } from "../config/firebase";
import { getPrizeEscrowPDA, getPrizePoolPDA, getRegistrationPDA, getTournamentEscrowPDA, TokenType } from "../utils/getPDAs";
import {getTournamentPoolPDA} from "../utils/getPDAs";

dotenv.config();


// Function to initialize the tournament pool
export const initializeTournamentPoolService = async (
  adminPublicKey: PublicKey,
  tournamentId: string,
  entryFee: number,
  maxParticipants: number,
  endTime: number, // Should be in SECONDS
  mintPublicKey: PublicKey,
  tokenType: TokenType
) => {
  try {
    const { program, connection } = getProgram();

    const tournamentPoolPublicKey = getTournamentPoolPDA(adminPublicKey, tournamentId, tokenType);
    
    const poolEscrowAccountPublicKey = tokenType === TokenType.SOL 
      ? SystemProgram.programId 
      : getTournamentEscrowPDA(tournamentPoolPublicKey);

    const { blockhash } = await connection.getLatestBlockhash("finalized");
    
    // ✅ Log to verify endTime is in seconds
    console.log(`✅ Creating tournament with endTime: ${endTime} (${new Date(endTime * 1000).toISOString()})`);
    
    const CRD_DECIMALS = 9;
    const entryFeeInBaseUnits = Math.round(entryFee * Math.pow(10, CRD_DECIMALS));
    const entryFeeBN = new BN(entryFeeInBaseUnits);
    
    console.log(`✅ Entry fee conversion: ${entryFee} → ${entryFeeInBaseUnits} base units`);
    
    const maxParticipantsBN = new BN(maxParticipants);
    const endTimeBN = new BN(endTime); // ✅ Should be in seconds

    const tokenTypeArg = tokenType === TokenType.SPL ? {spl: {}} : {sol: {}};

    const transaction = await program.methods
      .createTournamentPool(
        tournamentId,
        entryFeeBN,
        maxParticipantsBN,
        endTimeBN,
        tokenTypeArg
      )
      .accounts({
        creator: adminPublicKey,
        tournamentPool: tournamentPoolPublicKey,
        poolEscrowAccount: poolEscrowAccountPublicKey,
        mint: mintPublicKey,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .transaction();

    transaction.recentBlockhash = blockhash;
    transaction.feePayer = adminPublicKey;

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
export const getTournamentPool = async (tournamentId: string, adminPublicKey: PublicKey, tokenType: TokenType) => {
  try {
    const { program } = getProgram();

    const tournamentPoolPublicKey = getTournamentPoolPDA(adminPublicKey, tournamentId, tokenType);
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
        tokenType: tokenType,
      }
    };
  } catch (err) {
    console.error("❌ Error fetching tournament pool:", err);
    return { success: false, message: "Error fetching tournament data" };
  }
};

// Get prize pool data for a tournament
export const getPrizePoolService = async (
  tournamentId: string,
  adminPublicKey: PublicKey,
  tokenType: TokenType
) => {
  try {
    const { program, connection } = getProgram();

    // Derive Tournament Pool PDA (same derivation as on-chain)
    const tournamentPoolPublicKey = getTournamentPoolPDA(adminPublicKey, tournamentId, tokenType);

    // Ensure tournament pool account exists before proceeding
    const tournamentPoolAccountInfo = await connection.getAccountInfo(tournamentPoolPublicKey);
    if (!tournamentPoolAccountInfo) {
      return { success: false, message: "Tournament pool has not been initialized yet." };
    }

    // Derive Prize Pool PDA: seeds = [b"prize_pool", tournament_pool.key().as_ref()]
    const prizePoolPublicKey = getPrizePoolPDA(tournamentPoolPublicKey);

    // Check existence
    const prizePoolAccountInfo = await connection.getAccountInfo(prizePoolPublicKey);
    if (!prizePoolAccountInfo) {
      return { success: false, message: "Prize pool has not been initialized yet." };
    }

    // Fetch prize pool account
    const prizePoolData = (await program.account.prizePool.fetch(
      prizePoolPublicKey
    )) as PrizePoolAccount;

    // Derive Prize Escrow PDA: seeds = [b"prize_escrow", prize_pool.key().as_ref()]
    const prizeEscrowPublicKey = getPrizeEscrowPDA(prizePoolPublicKey);

    return {
      success: true,
      data: {
        address: prizePoolPublicKey.toString(),
        tournamentPool: prizePoolData.tournamentPool.toString(),
        admin: prizePoolData.admin.toString(),
        mint: prizePoolData.mint.toString(),
        prizeEscrowAccount: prizeEscrowPublicKey.toString(),
        tournamentId: Buffer.from(prizePoolData.tournamentId).toString().replace(/\0+$/, ""),
        totalFunds: prizePoolData.totalFunds.toString(),
        distributed: prizePoolData.distributed,
      },
    };
  } catch (err) {
    console.error("❌ Error fetching prize pool:", err);
    return { success: false, message: "Error fetching prize pool data" };
  }
};

// Get total funds across all prize pools (optionally filter by admin)
export const getTotalPrizePoolsFundsService = async (
  adminPublicKey?: PublicKey
) => {
  try {
    const { program } = getProgram();

    // Fetch all PrizePool accounts; optionally filter by admin
    const allPrizePools = await program.account.prizePool.all();

    const filtered = adminPublicKey
      ? allPrizePools.filter((acc: any) => acc.account.admin.equals(adminPublicKey))
      : allPrizePools;

    // Sum total_funds as BN to avoid overflow
    const totalFundsBN: anchor.BN = filtered.reduce((sum: anchor.BN, acc: any) => {
      return sum.add(new anchor.BN(acc.account.totalFunds));
    }, new anchor.BN(0));

    // Provide both raw base units (string) and human-readable assuming 9 decimals
    const tokenDecimals = 9;
    const totalFundsReadable = Number(totalFundsBN.toString()) / Math.pow(10, tokenDecimals);

    return {
      success: true,
      data: {
        count: filtered.length,
        totalFundsRaw: totalFundsBN.toString(),
        totalFunds: totalFundsReadable,
        tokenDecimals,
      },
    };
  } catch (err) {
    console.error("❌ Error aggregating prize pools:", err);
    return { success: false, message: "Error aggregating prize pools" };
  }
};

// Get total funds contributed across all tournament pools for an admin
export const getTotalTournamentPoolsFundsService = async (
  adminPublicKey?: PublicKey
) => {
  try {
    const { program } = getProgram();

    // Fetch all TournamentPool accounts
    const allTournamentPools = await program.account.tournamentPool.all();

    const filtered = adminPublicKey
      ? allTournamentPools.filter((acc: any) => acc.account.admin.equals(adminPublicKey))
      : allTournamentPools;

    // Sum total_funds and participants for extra context
    const totals = filtered.reduce(
      (agg: { funds: anchor.BN; participants: number }, acc: any) => {
        const funds = new anchor.BN(acc.account.totalFunds);
        const participants: number = acc.account.participantCount;
        return { funds: agg.funds.add(funds), participants: agg.participants + participants };
      },
      { funds: new anchor.BN(0), participants: 0 }
    );

    const tokenDecimals = 9;
    const totalFundsReadable = Number(totals.funds.toString()) / Math.pow(10, tokenDecimals);

    return {
      success: true,
      data: {
        count: filtered.length,
        totalFundsRaw: totals.funds.toString(),
        totalFunds: totalFundsReadable,
        totalParticipants: totals.participants,
        tokenDecimals,
      },
    };
  } catch (err) {
    console.error("❌ Error aggregating tournament pools:", err);
    return { success: false, message: "Error aggregating tournament pools" };
  }
};

// Get total entry fees collected from Firebase tournaments by admin
export const getTotalTournamentEntryFeesService = async (
  adminPublicKey: string
) => {
  try {
    const tournamentsRef = ref(db, "tournaments");
    const tournamentsSnapshot = await get(tournamentsRef);

    if (!tournamentsSnapshot.exists()) {
      return { success: false, message: "No tournaments found" };
    }

    const tournaments = tournamentsSnapshot.val();
    const adminTournaments = Object.values(tournaments).filter(
      (tournament: any) => tournament.createdBy === adminPublicKey
    );

    // Sum entry fees from all admin tournaments
    const totalEntryFees = adminTournaments.reduce((sum: number, tournament: any) => {
      const entryFee = parseFloat(tournament.entryFee) || 0;
      return sum + entryFee;
    }, 0);

    // Count total participants across all tournaments
    const totalParticipants = adminTournaments.reduce((sum: number, tournament: any) => {
      return sum + (tournament.participantsCount || 0);
    }, 0);

    return {
      success: true,
      data: {
        totalEntryFees,
        totalParticipants,
        tournamentCount: adminTournaments.length,
        adminPublicKey,
      },
    };
  } catch (err) {
    console.error("❌ Error calculating tournament entry fees:", err);
    return { success: false, message: "Error calculating tournament entry fees" };
  }
};

// Register for tournament
export const registerForTournamentService = async (
  tournamentId: string,
  userPublicKey: PublicKey,
  adminPublicKey: PublicKey,
  tokenType: TokenType
) => {
  try {
    const { program, connection } = getProgram();

    const tournamentPoolPublicKey = getTournamentPoolPDA(adminPublicKey, tournamentId, tokenType);
    // Fetch the tournament pool data
    const tournamentPoolData = (await program.account.tournamentPool.fetch(
      tournamentPoolPublicKey
    )) as TournamentPoolAccount;
    const mintPublicKey = tournamentPoolData.mint;

    // Get escrow PDA
    const poolEscrowAccountPublicKey = getTournamentEscrowPDA(tournamentPoolPublicKey);

    // Get registration PDA
    const registrationAccountPublicKey = getRegistrationPDA(tournamentPoolPublicKey, userPublicKey);

    let userTokenAccountPublicKey = await getAssociatedTokenAddressSync(mintPublicKey, userPublicKey, false, tokenType === TokenType.SPL ? TOKEN_2022_PROGRAM_ID : SystemProgram.programId);
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
        tokenProgram: tokenType === TokenType.SPL ? TOKEN_2022_PROGRAM_ID : SystemProgram.programId,
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
  tokenType: TokenType;
}

interface PrizePoolAccount {
  admin: PublicKey;
  tournamentPool: PublicKey;
  mint: PublicKey;
  tournamentId: string; // stored as fixed [u8;32] on-chain, deserialized to Buffer/string
  totalFunds: anchor.BN;
  distributed: boolean;
  bump: number;
}