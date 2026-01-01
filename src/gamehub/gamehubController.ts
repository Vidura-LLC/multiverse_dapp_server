import { Request, Response } from "express";
import { ref, get, set, push, update } from "firebase/database";
import { db } from "../config/firebase";
import { getTournamentPool, registerForTournamentService, initializeTournamentPoolService, getPrizePoolService, getTotalPrizePoolsFundsService, getTotalTournamentPoolsFundsService, getTotalTournamentEntryFeesService } from './services';
import { getTournamentLeaderboard, updateParticipantScore, getTournamentsByGame } from "./leaderboardService";
import { getTournamentLeaderboardAgainstAdmin, getAdminTournamentsLeaderboards } from "./adminLeaderboardService";
import { PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js";
import bs58 from "bs58";
import schedule from 'node-schedule'
import { TokenType, getTournamentPoolPDA, getRegistrationPDA } from "../utils/getPDAs";
import { getProgram } from "../staking/services";
// Define Tournament interface
export interface Tournament {
  id: string;
  name: string;
  description: string;
  entryFee: string;
  startTime: string;
  endTime: string;
  gameId: string;
  max_participants: number,
  createdAt: string;
  participants: { [key: string]: { joinedAt: string; score: number } };
  participantsCount: number;
  status: "Active" | "Not Started" | "Ended" | "Draft" | "Distributed" | "Awarded";
  createdBy: string
  tokenType: TokenType
}


export async function getAllGames(req: Request, res: Response) {
  try {
    const gamesRef = ref(db, "games");
    const gamesSnapshot = await get(gamesRef);
    if (!gamesSnapshot.exists()) {
      return res.status(404).json({ message: "No games found" });
    }

    const gamesObject = gamesSnapshot.val(); // Object with game IDs as keys
    const gamesArray = Object.keys(gamesObject).map((gameId) => ({
      id: gameId,
      ...gamesObject[gameId], // Spread the game details
    }));

    return res.status(200).json({ games: gamesArray });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}

export async function createTournament(req: Request, res: Response) {
  try {
    const { name, description, startTime, endTime, gameId, tokenType } = req.body as Tournament;
    const { mint, adminPublicKey, entryFee } = req.body;
    const maxParticipants = 100;

    if (!name || !gameId || !startTime || !endTime || !adminPublicKey || !entryFee || !mint || tokenType === undefined || tokenType === null) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const tt = Number(tokenType);
    if (tt !== TokenType.SPL && tt !== TokenType.SOL) {
      return res.status(400).json({ message: "tokenType must be 0 (SPL) or 1 (SOL)" });
    }

    // ✅ FIX: Ensure endTime is in SECONDS (Unix timestamp)
    let endTimeInUnix: number;
    if (typeof endTime === 'string') {
      // If it's an ISO string, convert to seconds
      endTimeInUnix = Math.floor(new Date(endTime).getTime() / 1000);
    } else if (typeof endTime === 'number') {
      // If it's already a number, check if it's milliseconds or seconds
      endTimeInUnix = endTime > 10000000000 ? Math.floor(endTime / 1000) : endTime;
    } else {
      return res.status(400).json({ message: "Invalid endTime format" });
    }

    // ✅ Validate that endTime is at least 5 minutes in the future
    const currentTimeInUnix = Math.floor(Date.now() / 1000);
    const MIN_DURATION = 300; // 5 minutes in seconds
    
    if (endTimeInUnix <= currentTimeInUnix + MIN_DURATION) {
      return res.status(400).json({ 
        message: `Tournament end time must be at least 5 minutes in the future. Current time: ${currentTimeInUnix}, End time: ${endTimeInUnix}` 
      });
    }

    console.log(`✅ Time validation:`, {
      currentTime: currentTimeInUnix,
      endTime: endTimeInUnix,
      difference: endTimeInUnix - currentTimeInUnix,
      differenceHours: (endTimeInUnix - currentTimeInUnix) / 3600
    });

    const pubKey = new PublicKey(adminPublicKey);

    // Generate tournament ID first
    const tournamentsRef = ref(db, `tournaments/${tt as TokenType}`);
    const newTournamentRef = push(tournamentsRef);
    const tournamentId = newTournamentRef.key;

    if (!tournamentId) {
      return res.status(500).json({ message: "Failed to generate tournament ID" });
    }

    const transaction = await initializeTournamentPoolService(
      pubKey,
      tournamentId,
      entryFee,
      maxParticipants,
      endTimeInUnix, // ✅ Pass as seconds
      mint,
      tt as TokenType
    );

    if (!transaction.success) {
      return res.status(500).json({ 
        message: "Failed to create tournament transaction", 
        error: transaction.message 
      });
    }

    res.status(201).json({
      message: "Tournament created successfully",
      transaction,
      tournamentId,
    });

    // Determine initial status based on startTime
    const now = new Date();
    const startTimeDate = new Date(startTime);
    const initialStatus = startTimeDate <= now ? "Active" : "Not Started";

    const tournament: Tournament = {
      id: tournamentId,
      name,
      description,
      startTime,
      endTime,
      gameId,
      max_participants: maxParticipants,
      entryFee,
      createdAt: new Date().toISOString(),
      participants: {},
      participantsCount: 0,
      status: initialStatus as "Active" | "Not Started" | "Ended" | "Draft" | "Distributed" | "Awarded",
      createdBy: adminPublicKey,
      tokenType: tt as TokenType
    };

    // Save tournament to the correct path: tournaments/{tokenType}/{tournamentId}
    await set(newTournamentRef, tournament);

    // Use the same reference for scheduled updates
    const tournamentRef = newTournamentRef;

    // Only schedule job if startTime is in the future
    if (startTimeDate > now) {
      schedule.scheduleJob(startTimeDate, async () => {
        try {
          await update(tournamentRef, { status: "Active" });
          console.log(`Tournament ${tournamentId} has started.`);
        } catch (error) {
          console.error(`Failed to start tournament ${tournamentId}:`, error);
        }
      });
    }

    schedule.scheduleJob(new Date(endTime), async () => {
      try {
        await update(tournamentRef, { status: "Ended" });
        console.log(`Tournament ${tournamentId} has ended.`);
      } catch (error) {
        console.error(`Failed to end tournament ${tournamentId}:`, error);
      }
    });

  } catch (error) {
    console.error("Error creating tournament:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}
// Controller function to retrieve active tournament data
export const getActiveTournament = async (req: Request, res: Response) => {
  try {
    // Reference to the Tournament Data in Firebase
    const tournamentRef = ref(db, 'tournaments');  // Assuming you have a 'tournaments' node in Firebase
    const snapshot = await get(tournamentRef);

    if (snapshot.exists()) {
      const tournamentsData = snapshot.val();  // All tournaments data

      // Filter active tournaments based on status
      const activeTournaments = Object.values(tournamentsData).filter(
        (tournament: Tournament) => tournament.status === "Active"
      );

      if (activeTournaments.length > 0) {
        return res.status(200).json({
          message: "Active tournament(s) found",
          tournaments: activeTournaments  // Return the active tournaments
        });
      } else {
        console.log("No active tournaments.");
        return res.status(404).json({
          message: "No active tournaments"
        });  // No active tournament found
      }
    } else {
      console.log("No tournament data found in the database.");
      return res.status(404).json({
        message: "No tournament data found"
      });
    }
  } catch (error) {
    console.error("Error fetching tournament data: ", error);
    return res.status(500).json({
      message: "Internal server error"
    });
  }
};

export const getTournamentsByAdmin = async (req: Request, res: Response) => {
  try {
    const { adminPublicKey } = req.params;
    const { tokenType } = req.query;
    if (!adminPublicKey || !tokenType || tokenType === undefined || tokenType === null) {
      return res.status(400).json({ message: "adminPublicKey and tokenType are required" });
    }

    const tt = Number(tokenType);
    if (tt !== TokenType.SPL && tt !== TokenType.SOL) {
      return res.status(400).json({ message: "tokenType must be 0 (SPL) or 1 (SOL)" });
    }

    if (!adminPublicKey) {
      return res.status(400).json({ message: "adminPublicKey is required" });
    }

    const tournamentsRef = ref(db, `tournaments/${tt as TokenType}`);
    const tournamentsSnapshot = await get(tournamentsRef);

    if (!tournamentsSnapshot.exists()) {
      return res.status(404).json({ message: "No tournaments found" });
    }

    const tournaments = tournamentsSnapshot.val();
    const adminTournaments = Object.values(tournaments).filter(
      (tournament: any) => tournament.createdBy === adminPublicKey && tournament.tokenType === tt
    );

    return res.status(200).json({
      message: "Tournaments fetched successfully",
      tournaments: adminTournaments,
    });
  } catch (error) {
    console.error("Error fetching tournaments by admin:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};


export async function getTournaments(req: Request, res: Response) {
  try {
    const { tokenType } = req.query;

    // If tokenType is provided, fetch tournaments for that specific token type
    if (tokenType !== undefined && tokenType !== null) {
      const tt = Number(tokenType);
      if (tt !== TokenType.SPL && tt !== TokenType.SOL) {
        return res.status(400).json({ message: "tokenType must be 0 (SPL) or 1 (SOL)" });
      }

      // Fetch tournaments for specific token type
      const tournamentsRef = ref(db, `tournaments/${tt as TokenType}`);
      const tournamentsSnapshot = await get(tournamentsRef);

      if (!tournamentsSnapshot.exists()) {
        return res.status(200).json({ tournaments: {} });
      }

      const tournaments = tournamentsSnapshot.val();
      return res.status(200).json({ tournaments });
    } else {
      // If no tokenType provided, fetch tournaments from both token types and merge them
      const allTournaments: Record<string, any> = {};
      
      for (const tt of [TokenType.SPL, TokenType.SOL]) {
        const tournamentsRef = ref(db, `tournaments/${tt}`);
        const tournamentsSnapshot = await get(tournamentsRef);
        
        if (tournamentsSnapshot.exists()) {
          const tournaments = tournamentsSnapshot.val();
          Object.assign(allTournaments, tournaments);
        }
      }

      return res.status(200).json({ tournaments: allTournaments });
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}

export async function getTournamentById(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { tokenType } = req.query;

    // Parse tokenType if provided
    let tt: TokenType | undefined = undefined;
    if (tokenType !== undefined && tokenType !== null) {
      const parsed = Number(tokenType);
      if (parsed === TokenType.SPL || parsed === TokenType.SOL) {
        tt = parsed as TokenType;
      }
    }

    let tournament: any = null;

    // If tokenType is provided, search directly in that path
    if (tt !== undefined) {
      const tournamentRef = ref(db, `tournaments/${tt}/${id}`);
      const tournamentSnapshot = await get(tournamentRef);

      if (tournamentSnapshot.exists()) {
        tournament = tournamentSnapshot.val();
      }
    } else {
      // If tokenType is not provided, search in both token types
      for (const tokenTypeValue of [TokenType.SPL, TokenType.SOL]) {
        const tournamentRef = ref(db, `tournaments/${tokenTypeValue}/${id}`);
        const tournamentSnapshot = await get(tournamentRef);

        if (tournamentSnapshot.exists()) {
          tournament = tournamentSnapshot.val();
          break;
        }
      }
    }

    if (!tournament) {
      return res.status(404).json({ message: "Tournament not found" });
    }

    return res.status(200).json({ tournament });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}


// Modification to the registerForTournamentController in gamehubController.ts
export const registerForTournamentController = async (req: Request, res: Response) => {
  try {
    const { tournamentId, userPublicKey, tokenType } = req.body;

    // Validate required fields
    if (!userPublicKey || !tournamentId || tokenType === undefined || tokenType === null) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: tournamentId or userPublicKey",
      });
    }

    const tt = Number(tokenType);
    if (tt !== TokenType.SPL && tt !== TokenType.SOL) {
      return res.status(400).json({ message: "tokenType must be 0 (SPL) or 1 (SOL)" });
    }

    // Find tournament by tournamentId in the correct path: tournaments/{tokenType}/{tournamentId}
    const tournamentRef = ref(db, `tournaments/${tt as TokenType}/${tournamentId}`);
    const tournamentSnapshot = await get(tournamentRef);

    // Check if tournament exists
    if (!tournamentSnapshot.exists()) {
      return res.status(404).json({
        success: false,
        message: "Tournament not found",
      });
    }

    const tournament = tournamentSnapshot.val();

    // Extract adminPublicKey (createdBy)
    const adminPublicKey = tournament.createdBy;
    if (!adminPublicKey) {
      return res.status(400).json({
        success: false,
        message: "Tournament does not have an adminPublicKey",
      });
    }

    // Validate and create PublicKey objects
    let userPubKey: PublicKey;
    let adminPubKey: PublicKey;
    
    try {
      userPubKey = new PublicKey(userPublicKey);
      // Validate the public key is on curve
      if (!PublicKey.isOnCurve(userPubKey.toBytes())) {
        return res.status(400).json({
          success: false,
          message: `Invalid user public key: ${userPublicKey}. The public key must be a valid ed25519 point on the curve.`,
          error: "INVALID_USER_PUBLIC_KEY"
        });
      }
    } catch (error: any) {
      return res.status(400).json({
        success: false,
        message: `Invalid user public key format: ${error.message}`,
        error: "INVALID_USER_PUBLIC_KEY_FORMAT"
      });
    }

    try {
      adminPubKey = new PublicKey(adminPublicKey);
      // Validate the admin public key is on curve
      if (!PublicKey.isOnCurve(adminPubKey.toBytes())) {
        return res.status(400).json({
          success: false,
          message: `Invalid admin public key: ${adminPublicKey}. The public key must be a valid ed25519 point on the curve.`,
          error: "INVALID_ADMIN_PUBLIC_KEY"
        });
      }
    } catch (error: any) {
      return res.status(400).json({
        success: false,
        message: `Invalid admin public key format: ${error.message}`,
        error: "INVALID_ADMIN_PUBLIC_KEY_FORMAT"
      });
    }

    // Create transaction for blockchain registration (don't add to Firebase yet)
    const blockchainResult = await registerForTournamentService(tournamentId, userPubKey, adminPubKey, tt as TokenType );

    // Return transaction - participant will be added to Firebase after transaction is confirmed
    if (blockchainResult.success) {
      return res.status(200).json(blockchainResult);
    } else {
      return res.status(400).json(blockchainResult);
    }
  } catch (error) {
    console.error("❌ Error in registerForTournament controller:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Controller to confirm participation after transaction is verified on blockchain
export const confirmParticipationController = async (req: Request, res: Response) => {
  try {
    const { tournamentId, userPublicKey, transactionSignature, tokenType } = req.body;

    // Validate required fields
    if (!userPublicKey || !tournamentId || !transactionSignature || tokenType === undefined || tokenType === null) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: tournamentId, userPublicKey, transactionSignature, or tokenType",
      });
    }

    const tt = Number(tokenType);
    if (tt !== TokenType.SPL && tt !== TokenType.SOL) {
      return res.status(400).json({ message: "tokenType must be 0 (SPL) or 1 (SOL)" });
    }

    // Find tournament by tournamentId
    const tournamentRef = ref(db, `tournaments/${tt as TokenType}/${tournamentId}`);
    const tournamentSnapshot = await get(tournamentRef);

    // Check if tournament exists
    if (!tournamentSnapshot.exists()) {
      return res.status(404).json({
        success: false,
        message: "Tournament not found",
      });
    }

    const tournament = tournamentSnapshot.val();
    const adminPublicKey = tournament.createdBy;
    if (!adminPublicKey) {
      return res.status(400).json({
        success: false,
        message: "Tournament does not have an adminPublicKey",
      });
    }

    const userPubKey = new PublicKey(userPublicKey);
    const adminPubKey = new PublicKey(adminPublicKey);

    // Verify transaction exists on blockchain and was successful
    const { connection, program } = getProgram();
    
    let actualTransactionSignature: string = transactionSignature;
    
    // Check if transactionSignature is a signed transaction (base64/base58) or a transaction signature (base58)
    // Signed transactions are typically longer (>100 chars)
    // Transaction signatures are shorter (88 chars base58)
    // Phantom returns signed transactions in base58 format
    const isLongTransaction = transactionSignature.length > 100;
    
    if (isLongTransaction) {
      // This is likely a signed transaction - try to deserialize and send it
      try {
        let txBuffer: Buffer;
        let signedTx: Transaction | VersionedTransaction;
        
        // Try base58 first (Phantom's format), then base64
        try {
          txBuffer = Buffer.from(bs58.decode(transactionSignature));
          console.log('Decoded as base58');
        } catch (base58Error) {
          // If base58 fails, try base64
          try {
            txBuffer = Buffer.from(transactionSignature, 'base64');
            console.log('Decoded as base64');
          } catch (base64Error) {
            throw new Error(`Could not decode transaction: base58 error: ${base58Error.message}, base64 error: ${base64Error.message}`);
          }
        }
        
        // Try VersionedTransaction first, then fall back to Transaction
        try {
          signedTx = VersionedTransaction.deserialize(txBuffer);
          console.log('Deserialized as VersionedTransaction');
        } catch {
          signedTx = Transaction.from(txBuffer);
          console.log('Deserialized as Legacy Transaction');
        }
        
        // Send the signed transaction
        console.log('Sending signed transaction to blockchain...');
        const signature = await connection.sendRawTransaction(
          signedTx.serialize(),
          {
            skipPreflight: false,
            maxRetries: 3,
          }
        );
        
        // Wait for confirmation
        console.log('Waiting for transaction confirmation:', signature);
        const confirmation = await connection.confirmTransaction(signature, 'confirmed');
        
        if (confirmation.value.err) {
          return res.status(400).json({
            success: false,
            message: 'Transaction failed on blockchain',
            error: confirmation.value.err
          });
        }
        
        // Use the actual transaction signature for verification
        actualTransactionSignature = signature;
        console.log('Transaction sent successfully, signature:', signature);
      } catch (err) {
        console.error('Error sending signed transaction:', err);
        return res.status(400).json({
          success: false,
          message: 'Could not send transaction to blockchain',
          error: err.message
        });
      }
    }
    
    // Verify transaction exists on blockchain and was successful
    try {
      const txInfo = await connection.getTransaction(actualTransactionSignature, {
        maxSupportedTransactionVersion: 0
      });
      
      if (!txInfo) {
        return res.status(400).json({
          success: false,
          message: 'Transaction not found on blockchain'
        });
      }

      // Check if transaction was successful
      if (txInfo.meta?.err) {
        return res.status(400).json({
          success: false,
          message: 'Transaction failed on blockchain',
          error: txInfo.meta.err
        });
      }
    } catch (err) {
      console.error('Error verifying transaction on blockchain:', err);
      return res.status(400).json({
        success: false,
        message: 'Could not verify transaction on blockchain',
        error: err.message
      });
    }

    // Verify registration account exists on blockchain (confirms registration was successful)
    try {
      const tournamentPoolPublicKey = getTournamentPoolPDA(adminPubKey, tournamentId, tt as TokenType);
      const registrationAccountPublicKey = getRegistrationPDA(tournamentPoolPublicKey, userPubKey);
      
      // Try to fetch the registration account - if it exists, registration was successful
      // Use fetchNullable to handle cases where account might not exist yet
      const registrationAccount = await program.account.registrationRecord.fetchNullable(registrationAccountPublicKey);
      
      if (!registrationAccount) {
        return res.status(400).json({
          success: false,
          message: 'Registration account not found on blockchain - registration may have failed or transaction not yet confirmed'
        });
      }
    } catch (err) {
      console.error('Error verifying registration account:', err);
      return res.status(400).json({
        success: false,
        message: 'Could not verify registration on blockchain - registration account does not exist',
        error: err.message
      });
    }

    // Transaction verified and registration confirmed - now add participant to Firebase
    const participants = tournament.participants || {};

    // Check if participant already exists (idempotency)
    if (participants[userPublicKey]) {
      return res.status(200).json({
        success: true,
        message: "Participant already registered",
      });
    }

    // Initialize the participant with default fields
    participants[userPublicKey] = {
      joinedAt: new Date().toISOString(),
      score: 0,
      hasPlayed: false,
      scoreSubmittedAt: null,
    };

    await update(tournamentRef, {
      participants,
      participantsCount: Object.keys(participants).length
    });

    return res.status(200).json({
      success: true,
      message: "Participation confirmed and participant added to tournament",
    });
  } catch (error) {
    console.error("❌ Error in confirmParticipation controller:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};


export const getTournamentPoolController = async (req: Request, res: Response) => {
  try {
    const { tournamentId, adminPubKey, tokenType } = req.body;

    // Validate the required fields
    if (!tournamentId || !adminPubKey || !tokenType || tokenType === undefined || tokenType === null) {
      return res.status(400).json({
        success: false,
        message: 'Missing required field: tournamentId or adminPubKey'
      });
    }
    const adminPublicKey = new PublicKey(adminPubKey);
    const tt = Number(tokenType);
    if (tt !== TokenType.SPL && tt !== TokenType.SOL) {
      return res.status(400).json({ message: "tokenType must be 0 (SPL) or 1 (SOL)" });
    }
    // Call the service to get tournament pool details
    const result = await getTournamentPool(tournamentId, adminPublicKey, tt as TokenType);

    if (result.success) {
      return res.status(200).json(result);
    } else {
      return res.status(404).json(result);
    }
  } catch (error) {
    console.error('❌ Error in getTournamentPool controller:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Controller: get a single prize pool by tournamentId and adminPubKey
export const getPrizePoolController = async (req: Request, res: Response) => {
  try {
    const { tournamentId, adminPubKey, tokenType } = req.body;

    if (!tournamentId || !adminPubKey || !tokenType || tokenType === undefined || tokenType === null ) {
      return res.status(400).json({ success: false, message: 'Missing required field: tournamentId or adminPubKey' });
    }
    const tt = Number(tokenType);
    if (tt !== TokenType.SPL && tt !== TokenType.SOL) {
      return res.status(400).json({ message: "tokenType must be 0 (SPL) or 1 (SOL)" });
    }
    const adminPublicKey = new PublicKey(adminPubKey);
    const result = await getPrizePoolService(tournamentId, adminPublicKey, tt as TokenType );

    if (result.success) {
      return res.status(200).json(result);
    } else {
      return res.status(404).json(result);
    }
  } catch (error) {
    console.error('❌ Error in getPrizePoolController:', error);
    return res.status(500).json({ success: false, message: 'Internal server error', error: (error as any).message });
  }
};

// Controller: aggregate funds across all prize pools (optional admin filter)
export const getTotalPrizePoolsFundsController = async (req: Request, res: Response) => {
  try {
    const { adminPubKey } = req.query as { adminPubKey?: string };

    const adminPublicKey = adminPubKey ? new PublicKey(adminPubKey) : undefined;
    const result = await getTotalPrizePoolsFundsService(adminPublicKey);

    if (result.success) {
      return res.status(200).json(result);
    } else {
      return res.status(400).json(result);
    }
  } catch (error) {
    console.error('❌ Error in getTotalPrizePoolsFundsController:', error);
    return res.status(500).json({ success: false, message: 'Internal server error', error: (error as any).message });
  }
};

// Controller: aggregate funds across all tournament pools (optional admin filter)
export const getTotalTournamentPoolsFundsController = async (req: Request, res: Response) => {
  try {
    const { adminPubKey } = req.query as { adminPubKey?: string };

    const adminPublicKey = adminPubKey ? new PublicKey(adminPubKey) : undefined;
    const result = await getTotalTournamentPoolsFundsService(adminPublicKey);

    if (result.success) {
      return res.status(200).json(result);
    } else {
      return res.status(400).json(result);
    }
  } catch (error) {
    console.error('❌ Error in getTotalTournamentPoolsFundsController:', error);
    return res.status(500).json({ success: false, message: 'Internal server error', error: (error as any).message });
  }
};

// Controller: get total entry fees from Firebase tournaments by admin
export const getTotalTournamentEntryFeesController = async (req: Request, res: Response) => {
  try {
    const { adminPubKey } = req.query as { adminPubKey: string };

    if (!adminPubKey) {
      return res.status(400).json({ success: false, message: 'adminPubKey is required' });
    }

    const result = await getTotalTournamentEntryFeesService(adminPubKey);

    if (result.success) {
      return res.status(200).json(result);
    } else {
      return res.status(400).json(result);
    }
  } catch (error) {
    console.error('❌ Error in getTotalTournamentEntryFeesController:', error);
    return res.status(500).json({ success: false, message: 'Internal server error', error: (error as any).message });
  }
};




// Get tournament leaderboard
export async function getTournamentLeaderboardController(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { tokenType } = req.query;

    if (!id) {
      return res.status(400).json({ message: "Tournament ID is required" });
    }

    // Parse tokenType if provided
    let tt: TokenType | undefined = undefined;
    if (tokenType !== undefined && tokenType !== null) {
      const parsed = Number(tokenType);
      if (parsed === TokenType.SPL || parsed === TokenType.SOL) {
        tt = parsed as TokenType;
      }
    }

    const result = await getTournamentLeaderboard(id, tt);

    if (result.success) {
      return res.status(200).json(result);
    } else {
      return res.status(404).json(result);
    }
  } catch (error) {
    console.error("Error in getTournamentLeaderboardController:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}

// Update participant score
export async function updateParticipantScoreController(req: Request, res: Response) {
  try {
    const { tournamentId, participantId, score, tokenType } = req.body;

    if (!tournamentId || !participantId || score === undefined) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // Parse tokenType if provided
    let tt: TokenType | undefined = undefined;
    if (tokenType !== undefined && tokenType !== null) {
      const parsed = Number(tokenType);
      if (parsed === TokenType.SPL || parsed === TokenType.SOL) {
        tt = parsed as TokenType;
      }
    }

    const result = await updateParticipantScore(tournamentId, participantId, score, tt);

    if (result.success) {
      return res.status(200).json(result);
    } else {
      return res.status(400).json(result);
    }
  } catch (error) {
    console.error("Error in updateParticipantScoreController:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}

// Get tournament leaderboard against admin
export async function getTournamentLeaderboardAgainstAdminController(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { tokenType } = req.query;

    if (!id) {
      return res.status(400).json({ message: "Tournament ID is required" });
    }

    // Parse tokenType if provided
    let tt: TokenType | undefined = undefined;
    if (tokenType !== undefined && tokenType !== null) {
      const parsed = Number(tokenType);
      if (parsed === TokenType.SPL || parsed === TokenType.SOL) {
        tt = parsed as TokenType;
      }
    }

    const result = await getTournamentLeaderboardAgainstAdmin(id, tt);

    if (result.success) {
      return res.status(200).json(result);
    } else {
      return res.status(404).json(result);
    }
  } catch (error) {
    console.error("Error in getTournamentLeaderboardAgainstAdminController:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}

// Get aggregated leaderboards for all tournaments by admin
export async function getAdminTournamentsLeaderboardsController(req: Request, res: Response) {
  try {
    const { adminPublicKey } = req.params;

    if (!adminPublicKey) {
      return res.status(400).json({ message: "Admin public key is required" });
    }

    const result = await getAdminTournamentsLeaderboards(adminPublicKey);

    if (result.success) {
      return res.status(200).json(result);
    } else {
      return res.status(404).json(result);
    }
  } catch (error) {
    console.error("Error in getAdminTournamentsLeaderboardsController:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}

// Get tournaments by game
export async function getTournamentsByGameController(req: Request, res: Response) {
  try {
    const { gameId, tokenType } = req.params;
    if (!tokenType || tokenType === undefined || tokenType === null) {
      return res.status(400).json({ message: "Token type is required" });
    }
    const tt = Number(tokenType);
    if (tt !== TokenType.SPL && tt !== TokenType.SOL) {
      return res.status(400).json({ message: "tokenType must be 0 (SPL) or 1 (SOL)" });
    }
    if (!gameId) {
      return res.status(400).json({ message: "Game ID is required" });
    }

    try {
      // Fetch from Firebase at tournaments/{tokenType} and filter by gameId
      const tournamentsRef = ref(db, `tournaments/${tt as TokenType}`);
      const snapshot = await get(tournamentsRef);
      
      if (!snapshot.exists()) {
        return res.status(200).json({ success: true, data: [] });
      }
      
      const all = snapshot.val() as Record<string, any>;
      if (!all || typeof all !== 'object') {
        return res.status(200).json({ success: true, data: [] });
      }
      
      const data = Object.values(all).filter((t: any) => t && t.gameId === gameId);
      return res.status(200).json({ success: true, data });
    } catch (dbError: any) {
      // Handle Firebase permission errors
      if (dbError.code === 'PERMISSION_DENIED' || dbError.message?.includes('Permission denied')) {
        console.error('[Gamehub] Permission denied reading tournaments:', dbError);
        return res.status(403).json({ 
          success: false,
          message: "Permission denied: Unable to read tournaments from database",
          error: "PERMISSION_DENIED"
        });
      }
      throw dbError; // Re-throw other errors
    }
  } catch (error: any) {
    console.error("Error in getTournamentsByGameController:", error);
    return res.status(500).json({ 
      success: false,
      message: "Internal Server Error",
      error: error.message || 'Unknown error'
    });
  }
}

export async function updateTournamentStatus(req: Request, res: Response) {
  try {
    const { tournamentId, status } = req.body;

    if (!tournamentId || !status) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const tournamentRef = ref(db, `tournaments/${tournamentId}`);
    const tournamentSnapshot = await get(tournamentRef);

    if (!tournamentSnapshot.exists()) {
      return res.status(404).json({ message: "Tournament not found" });
    }
    await update(tournamentRef, { status });

    const updatedTournamentSnapshot = await get(tournamentRef);
    const updatedTournament = updatedTournamentSnapshot.val();

    return res.status(200).json({ message: "Tournament status updated successfully", tournament: updatedTournament });
  } catch (error) {
    console.error("Error updating tournament status:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}

// Track scheduled jobs to avoid duplicates
const scheduledJobs = new Map<string, { startJob?: schedule.Job; endJob?: schedule.Job }>();

/**
 * Check and update tournament statuses based on current time
 * This function should be called on server startup and periodically
 * 
 * Performance optimizations:
 * - Only checks tournaments that can change status ("Not Started", "Active", "Draft")
 * - Skips "Ended", "Distributed", "Awarded" tournaments
 * - Tracks scheduled jobs to avoid duplicates
 * - Uses efficient filtering to minimize Firebase reads
 */
export async function checkAndUpdateTournamentStatuses(): Promise<void> {
  try {
    const now = new Date();
    let updatedCount = 0;
    let scheduledCount = 0;
    let skippedCount = 0;

    // Check tournaments for both token types
    for (const tokenType of [TokenType.SPL, TokenType.SOL]) {
      const tournamentsRef = ref(db, `tournaments/${tokenType}`);
      const snapshot = await get(tournamentsRef);

      if (!snapshot.exists()) {
        continue;
      }

      const tournaments = snapshot.val() as Record<string, Tournament>;

      for (const [tournamentId, tournament] of Object.entries(tournaments)) {
        if (!tournament || !tournament.startTime || !tournament.endTime) {
          continue;
        }

        // Performance optimization: Skip tournaments that can't change status
        const finalStatuses = ["Ended", "Distributed", "Awarded"];
        if (finalStatuses.includes(tournament.status)) {
          skippedCount++;
          continue;
        }

        const startTimeDate = new Date(tournament.startTime);
        const endTimeDate = new Date(tournament.endTime);
        const tournamentRef = ref(db, `tournaments/${tokenType}/${tournamentId}`);
        const jobKey = `${tokenType}-${tournamentId}`;
        let statusUpdated = false;

        // Check if tournament should be "Ended"
        if (now >= endTimeDate) {
          if (tournament.status !== "Ended" && 
              tournament.status !== "Distributed" && 
              tournament.status !== "Awarded") {
            await update(tournamentRef, { status: "Ended" });
            console.log(`✅ Tournament ${tournamentId} (${tokenType}) status updated to "Ended"`);
            updatedCount++;
            statusUpdated = true;
            
            // Cancel scheduled jobs for ended tournaments
            const jobs = scheduledJobs.get(jobKey);
            if (jobs) {
              if (jobs.startJob) jobs.startJob.cancel();
              if (jobs.endJob) jobs.endJob.cancel();
              scheduledJobs.delete(jobKey);
            }
          }
        }
        // Check if tournament should be "Active"
        else if (now >= startTimeDate) {
          if (tournament.status === "Not Started" || tournament.status === "Draft") {
            await update(tournamentRef, { status: "Active" });
            console.log(`✅ Tournament ${tournamentId} (${tokenType}) status updated to "Active"`);
            updatedCount++;
            statusUpdated = true;
            
            // Cancel start job if it exists
            const jobs = scheduledJobs.get(jobKey);
            if (jobs?.startJob) {
              jobs.startJob.cancel();
              jobs.startJob = undefined;
            }
          }
        }

        // Restore scheduled jobs for future tournaments (only if not already scheduled)
        if (!statusUpdated) {
          const existingJobs = scheduledJobs.get(jobKey) || {};

          // Schedule start job if startTime is in the future and status is "Not Started"
          if (startTimeDate > now && tournament.status === "Not Started" && !existingJobs.startJob) {
            const startJob = schedule.scheduleJob(startTimeDate, async () => {
              try {
                await update(tournamentRef, { status: "Active" });
                console.log(`✅ Tournament ${tournamentId} (${tokenType}) has started.`);
                // Clean up job after execution
                const jobs = scheduledJobs.get(jobKey);
                if (jobs) {
                  jobs.startJob = undefined;
                  if (!jobs.endJob) scheduledJobs.delete(jobKey);
                }
              } catch (error) {
                console.error(`❌ Failed to start tournament ${tournamentId}:`, error);
              }
            });
            existingJobs.startJob = startJob;
            scheduledJobs.set(jobKey, existingJobs);
            scheduledCount++;
          }

          // Schedule end job if endTime is in the future and tournament is not already ended
          if (endTimeDate > now && 
              tournament.status !== "Ended" && 
              tournament.status !== "Distributed" && 
              tournament.status !== "Awarded" &&
              !existingJobs.endJob) {
            const endJob = schedule.scheduleJob(endTimeDate, async () => {
              try {
                await update(tournamentRef, { status: "Ended" });
                console.log(`✅ Tournament ${tournamentId} (${tokenType}) has ended.`);
                // Clean up job after execution
                const jobs = scheduledJobs.get(jobKey);
                if (jobs) {
                  jobs.endJob = undefined;
                  if (!jobs.startJob) scheduledJobs.delete(jobKey);
                }
              } catch (error) {
                console.error(`❌ Failed to end tournament ${tournamentId}:`, error);
              }
            });
            existingJobs.endJob = endJob;
            scheduledJobs.set(jobKey, existingJobs);
            scheduledCount++;
          }
        }
      }
    }

    if (updatedCount > 0 || scheduledCount > 0) {
      console.log(`✅ Tournament status check: Updated: ${updatedCount}, Scheduled: ${scheduledCount}, Skipped: ${skippedCount}`);
    }
  } catch (error) {
    console.error("❌ Error checking tournament statuses:", error);
  }
}