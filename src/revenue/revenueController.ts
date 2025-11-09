// src/revenue/revenueController.ts

import { ref, get, update } from "firebase/database";
import { db } from "../config/firebase";
import { Request, Response } from 'express';
import { PublicKey } from '@solana/web3.js';
import { distributeTournamentRevenueService, distributeTournamentPrizesService } from './services';
import { getProgram } from "../staking/services";
import { TokenType } from "../utils/getPDAs";
/**
 * Controller function to distribute tournament revenue according to the updated percentages
 */
export const distributeTournamentRevenueController = async (req: Request, res: Response) => {
  try {
    const { 
      tournamentId, 
      prizePercentage, 
      revenuePercentage, 
      stakingPercentage,
      burnPercentage,
      adminPublicKey
    } = req.body;

    const adminPubKey = new PublicKey(adminPublicKey);

    // Validate tournament ID
    if (!tournamentId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Tournament ID is required' 
      });
    }

    // Validate custom percentages if provided
    const useCustomPercentages = prizePercentage !== undefined || 
                               revenuePercentage !== undefined || 
                               stakingPercentage !== undefined ||
                               burnPercentage !== undefined;
    
    if (useCustomPercentages) {
      // Ensure all percentages are provided if any are provided
      if (prizePercentage === undefined || 
          revenuePercentage === undefined || 
          stakingPercentage === undefined ||
          burnPercentage === undefined) {
        return res.status(400).json({
          success: false,
          message: "If custom percentages are provided, all percentages (prize, revenue, staking, and burn) must be specified"
        });
      }
      
      // Validate percentages add up to 100
      if (prizePercentage + revenuePercentage + stakingPercentage + burnPercentage !== 100) {
        return res.status(400).json({
          success: false,
          message: "Percentages must add up to 100%"
        });
      }
      
      // Validate individual percentages are within reasonable ranges
      if (prizePercentage < 0 || prizePercentage > 100 ||
          revenuePercentage < 0 || revenuePercentage > 100 ||
          stakingPercentage < 0 || stakingPercentage > 100 ||
          burnPercentage < 0 || burnPercentage > 100) {
        return res.status(400).json({
          success: false,
          message: "All percentages must be between 0 and 100"
        });
      }
    }

    // Call the service function to distribute revenue with burn functionality
    const result = await distributeTournamentRevenueService(
      tournamentId,
      prizePercentage,
      revenuePercentage,
      stakingPercentage,
      burnPercentage,
      adminPubKey
    );

    // Return the result
    if (result.success) {
      return res.status(200).json(result);
    } else {
      return res.status(400).json(result);
    }
  } catch (err) {
    console.error('Error in distribute tournament revenue controller:', err);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to distribute tournament revenue',
      error: err.message || err
    });
  }
};

/**
 * Controller function to get tournament distribution details
 * Updated to include burn information
 */
export const getTournamentDistributionController = async (req: Request, res: Response) => {
  try {
    const { tournamentId } = req.params;

    // Validate tournament ID
    if (!tournamentId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Tournament ID is required' 
      });
    }

    // Get tournament data from Firebase
    const tournamentRef = ref(db, `tournaments/${tournamentId}`);
    const tournamentSnapshot = await get(tournamentRef);
    
    if (!tournamentSnapshot.exists()) {
      return res.status(404).json({ 
        success: false, 
        message: 'Tournament not found' 
      });
    }
    
    const tournament = tournamentSnapshot.val();
    
    // Check if distribution has been completed
    if (!tournament.distributionCompleted) {
      return res.status(404).json({
        success: false,
        message: 'Tournament revenue has not been distributed yet'
      });
    }

    // Format and return distribution details including burn information
    return res.status(200).json({
      success: true,
      tournamentId,
      tournamentName: tournament.name,
      distributionDetails: {
        completedAt: new Date(tournament.distributionTimestamp).toISOString(),
        totalDistributed: tournament.distributionDetails.totalDistributed,
        prizeAmount: tournament.distributionDetails.prizeAmount,
        revenueAmount: tournament.distributionDetails.revenueAmount,
        stakingAmount: tournament.distributionDetails.stakingAmount,
        burnAmount: tournament.distributionDetails.burnAmount, // New field
        transactionSignature: tournament.distributionDetails.transactionSignature,
      }
    });
  } catch (err) {
    console.error('Error in get tournament distribution controller:', err);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to get tournament distribution details',
      error: err.message || err
    });
  }
};

/**
 * Controller function to distribute prizes to tournament winners
 */
export const distributeTournamentPrizesController = async (req: Request, res: Response) => {
  try {
    const { tournamentId, firstPlacePublicKey, secondPlacePublicKey, thirdPlacePublicKey, adminPublicKey } = req.body;

    // Validate tournament ID
    if (!tournamentId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Tournament ID is required' 
      });
    }

    // Validate winner public keys
    if (!firstPlacePublicKey || !secondPlacePublicKey || !thirdPlacePublicKey || !adminPublicKey) {
      return res.status(400).json({ 
        success: false, 
        message: 'Public keys for all three winners are required' 
      });
    }

    // Verify tournament exists
    const tournamentRef = ref(db, `tournaments/${tournamentId}`);
    const tournamentSnapshot = await get(tournamentRef);
    
    if (!tournamentSnapshot.exists()) {
      return res.status(404).json({ 
        success: false, 
        message: 'Tournament not found' 
      });
    }
    
    // Verify tournament has ended
    const tournament = tournamentSnapshot.val();
    if (tournament.status !== 'Ended' && tournament.status !== 'Distributed') {
      return res.status(400).json({ 
        success: false, 
        message: 'Cannot distribute prizes for an active tournament' 
      });
    }
    
    // Verify tournament revenue has been distributed
    if (!tournament.distributionCompleted) {
      return res.status(400).json({ 
        success: false, 
        message: 'Tournament revenue must be distributed before prizes can be distributed' 
      });
    }
    
    // Convert string public keys to PublicKey objects
    const firstPlacePubkey = new PublicKey(firstPlacePublicKey);
    const secondPlacePubkey = new PublicKey(secondPlacePublicKey);
    const thirdPlacePubkey = new PublicKey(thirdPlacePublicKey);
    const adminPubKey = new PublicKey(adminPublicKey);

    // Call the service function to distribute prizes
    const result = await distributeTournamentPrizesService(
      tournamentId,
      firstPlacePubkey,
      secondPlacePubkey,
      thirdPlacePubkey,
      adminPubKey
    );

    // Return the result
    if (result.success) {
      return res.status(200).json(result);
    } else {
      return res.status(400).json(result);
    }
  } catch (err) {
    console.error('Error in distribute tournament prizes controller:', err);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to distribute tournament prizes',
      error: err.message || err
    });
  }
};

/**
 * Controller function to get tournament prizes distribution details
 */
export const getTournamentPrizesDistributionController = async (req: Request, res: Response) => {
  try {
    const { tournamentId } = req.params;

    // Validate tournament ID
    if (!tournamentId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Tournament ID is required' 
      });
    }

    // Get tournament data from Firebase
    const tournamentRef = ref(db, `tournaments/${tournamentId}`);
    const tournamentSnapshot = await get(tournamentRef);
    
    if (!tournamentSnapshot.exists()) {
      return res.status(404).json({ 
        success: false, 
        message: 'Tournament not found' 
      });
    }
    
    const tournament = tournamentSnapshot.val();
    
    // Check if prizes have been distributed
    if (!tournament.prizesDistributed) {
      return res.status(404).json({
        success: false,
        message: 'Tournament prizes have not been distributed yet'
      });
    }

    // Format and return distribution details
    return res.status(200).json({
      success: true,
      tournamentId,
      tournamentName: tournament.name,
      prizesDistribution: {
        completedAt: new Date(tournament.prizesDistributionTimestamp).toISOString(),
        firstPlace: tournament.prizesDistributionDetails.firstPlace,
        secondPlace: tournament.prizesDistributionDetails.secondPlace,
        thirdPlace: tournament.prizesDistributionDetails.thirdPlace,
        transactionSignature: tournament.prizesDistributionDetails.transactionSignature,
      }
    });
  } catch (err) {
    console.error('Error in get tournament prizes distribution controller:', err);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to get tournament prizes distribution details',
      error: err.message || err
    });
  }
};

/**
 * Controller: Get total prizes distributed by an admin across all tournaments
 */
export const getAdminPrizesDistributedController = async (req: Request, res: Response) => {
  try {
    const { adminPubKey } = req.params as { adminPubKey?: string };

    if (!adminPubKey) {
      return res.status(400).json({ success: false, message: 'adminPubKey is required' });
    }

    // Fetch all tournaments
    const tournamentsRef = ref(db, 'tournaments');
    const tournamentsSnapshot = await get(tournamentsRef);

    if (!tournamentsSnapshot.exists()) {
      return res.status(200).json({
        success: true,
        data: { totalPrizeRaw: '0', totalPrize: 0, tokenDecimals: 9, tournamentCount: 0 }
      });
    }

    const tournaments = tournamentsSnapshot.val();

    // Filter tournaments created by admin with prizesDistributed = true
    const adminTournaments: any[] = Object.values(tournaments).filter((t: any) =>
      t.createdBy === adminPubKey && t.prizesDistributed === true
    );

    // Sum prize amounts. Prefer winners amounts; fallback to prizesDistributionDetails.prizeAmount
    let totalPrize = BigInt(0);
    for (const t of adminTournaments) {
      if (t?.winners) {
        const a1 = BigInt(t.winners.firstPlace?.amount || 0);
        const a2 = BigInt(t.winners.secondPlace?.amount || 0);
        const a3 = BigInt(t.winners.thirdPlace?.amount || 0);
        totalPrize += a1 + a2 + a3;
      } else if (t?.prizesDistributionDetails?.prizeAmount != null) {
        totalPrize += BigInt(t.prizesDistributionDetails.prizeAmount || 0);
      }
    }

    const tokenDecimals = 9;
    const totalPrizeRaw = totalPrize.toString();
    const totalPrizeReadable = Number(totalPrizeRaw) / Math.pow(10, tokenDecimals);

    return res.status(200).json({
      success: true,
      data: {
        totalPrizeRaw,
        totalPrize: totalPrizeReadable,
        tokenDecimals,
        tournamentCount: adminTournaments.length,
      }
    });
  } catch (err) {
    console.error('Error in getAdminPrizesDistributedController:', err);
    return res.status(500).json({ success: false, message: 'Failed to aggregate prizes distributed', error: (err as any).message });
  }
};

/**
 * Controller: Get aggregated distribution totals (prize, revenue, staking, burn)
 * across all tournaments created by an admin.
 */
export const getAdminDistributionTotalsController = async (req: Request, res: Response) => {
  try {
    const { adminPubKey, tokenType } = req.params as { adminPubKey?: string, tokenType ?: string };

    if (!adminPubKey || !tokenType || tokenType === undefined || tokenType === null) {
      return res.status(400).json({ success: false, message: 'adminPubKey and tokenType are required' });
    }

    const tt = Number(tokenType);
    if (tt !== TokenType.SPL && tt !== TokenType.SOL) {
      return res.status(400).json({ success: false, message: 'tokenType must be 0 (SPL) or 1 (SOL)' });
    }

    // Fetch all tournaments
    const tournamentsRef = ref(db, `tournaments/${tokenType}`);
    const tournamentsSnapshot = await get(tournamentsRef);

    if (!tournamentsSnapshot.exists()) {
      return res.status(200).json({
        success: true,
        data: {
          prizeAmountRaw: '0', revenueAmountRaw: '0', stakingAmountRaw: '0', burnAmountRaw: '0',
          prizeAmount: 0, revenueAmount: 0, stakingAmount: 0, burnAmount: 0,
          tokenDecimals: 9, tournamentCount: 0
        }
      });
    }

    const tournaments = tournamentsSnapshot.val();
    const adminTournaments: any[] = Object.values(tournaments).filter((t: any) =>
      t.createdBy === adminPubKey && t.distributionCompleted === true
    );

    // Aggregate using BigInt
    let prize = BigInt(0);
    let revenue = BigInt(0);
    let staking = BigInt(0);
    let burn = BigInt(0);

    for (const t of adminTournaments) {
      const d = t?.distributionDetails || {};
      prize += BigInt(d.prizeAmount || 0);
      revenue += BigInt(d.revenueAmount || 0);
      staking += BigInt(d.stakingAmount || 0);
      burn += BigInt(d.burnAmount || 0);
    }

    const tokenDecimals = 9;
    const prizeAmountRaw = prize.toString();
    const revenueAmountRaw = revenue.toString();
    const stakingAmountRaw = staking.toString();
    const burnAmountRaw = burn.toString();

    const divisor = Math.pow(10, tokenDecimals);
    return res.status(200).json({
      success: true,
      data: {
        prizeAmount: Number(prizeAmountRaw) / divisor,
        revenueAmount: Number(revenueAmountRaw) / divisor,
        stakingAmount: Number(stakingAmountRaw) / divisor,
        burnAmount: Number(burnAmountRaw) / divisor,
        tournamentCount: adminTournaments.length,
      }
    });
  } catch (err) {
    console.error('Error in getAdminDistributionTotalsController:', err);
    return res.status(500).json({ success: false, message: 'Failed to aggregate distribution totals', error: (err as any).message });
  }
};

/**
 * Controller function to confirm tournament revenue distribution after frontend signs transaction
 */
export const confirmDistributionController = async (req: Request, res: Response) => {
  try {
    const {
      tournamentId,
      transactionSignature,
      distribution
    } = req.body;

    // Validate required fields
    if (!tournamentId || !transactionSignature) {
      return res.status(400).json({
        success: false,
        message: 'Tournament ID and transaction signature are required'
      });
    }

    // Verify transaction exists on blockchain (optional but recommended)
    const { connection } = getProgram();
    try {
      const txInfo = await connection.getTransaction(transactionSignature);
      if (!txInfo) {
        return res.status(400).json({
          success: false,
          message: 'Transaction not found on blockchain'
        });
      }
    } catch (err) {
      console.warn('Could not verify transaction on blockchain:', err);
      // Continue anyway - transaction might be too recent
    }

    // Update tournament status in Firebase
    console.log("Updating tournament status in Firebase...");
    const tournamentRef = ref(db, `tournaments/${tournamentId}`);

    // Check if tournament exists
    const tournamentSnapshot = await get(tournamentRef);
    if (!tournamentSnapshot.exists()) {
      return res.status(404).json({
        success: false,
        message: 'Tournament not found'
      });
    }

    const tournament = tournamentSnapshot.val();

    // Check if already distributed
    if (tournament.distributionCompleted) {
      return res.status(400).json({
        success: false,
        message: 'Tournament revenue has already been distributed'
      });
    }

    // Update tournament with distribution details
    await update(tournamentRef, {
      status: "Distributed",
      distributionCompleted: true,
      distributionTimestamp: Date.now(),
      distributionDetails: {
        totalDistributed: distribution.totalFunds,
        prizeAmount: distribution.prizeAmount,
        revenueAmount: distribution.revenueAmount,
        stakingAmount: distribution.stakingAmount,
        burnAmount: distribution.burnAmount,
        transactionSignature: transactionSignature
      }
    });

    return res.status(200).json({
      success: true,
      message: 'Tournament distribution confirmed successfully',
      tournamentId,
      transactionSignature,
      distribution
    });

  } catch (err) {
    console.error('Error in confirm distribution controller:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to confirm tournament distribution',
      error: err.message || err
    });
  }
};

/**
 * Controller function to confirm tournament prize distribution after frontend signs transaction
 */
export const confirmPrizeDistributionController = async (req: Request, res: Response) => {
  try {
    const {
      tournamentId,
      transactionSignature,
      winnerData
    } = req.body;

    // Validate required fields
    if (!tournamentId || !transactionSignature) {
      return res.status(400).json({
        success: false,
        message: 'Tournament ID and transaction signature are required'
      });
    }

    // Verify transaction exists on blockchain (optional but recommended)
    const { connection } = getProgram();
    try {
      const txInfo = await connection.getTransaction(transactionSignature);
      if (!txInfo) {
        return res.status(400).json({
          success: false,
          message: 'Transaction not found on blockchain'
        });
      }
    } catch (err) {
      console.warn('Could not verify transaction on blockchain:', err);
      // Continue anyway - transaction might be too recent
    }

    // Update tournament status in Firebase
    console.log("Updating tournament prize distribution status in Firebase...");
    const tournamentRef = ref(db, `tournaments/${tournamentId}`);

    // Check if tournament exists
    const tournamentSnapshot = await get(tournamentRef);
    if (!tournamentSnapshot.exists()) {
      return res.status(404).json({
        success: false,
        message: 'Tournament not found'
      });
    }

    const tournament = tournamentSnapshot.val();

    // Check if prizes have already been distributed
    if (tournament.prizesDistributed) {
      return res.status(400).json({
        success: false,
        message: 'Tournament prizes have already been distributed'
      });
    }

    // Verify tournament revenue has been distributed first
    if (!tournament.distributionCompleted) {
      return res.status(400).json({
        success: false,
        message: 'Tournament revenue must be distributed before confirming prize distribution'
      });
    }

    // Update tournament with prize distribution details
    await update(tournamentRef, {
      status: "Awarded",
      prizesDistributed: true,
      prizeDistributionTimestamp: Date.now(),
      prizeDistributionSignature: transactionSignature,
      winners: winnerData ? {
        firstPlace: {
          publicKey: winnerData.firstPlace?.publicKey,
          amount: winnerData.firstPlace?.amount
        },
        secondPlace: {
          publicKey: winnerData.secondPlace?.publicKey,
          amount: winnerData.secondPlace?.amount
        },
        thirdPlace: {
          publicKey: winnerData.thirdPlace?.publicKey,
          amount: winnerData.thirdPlace?.amount
        }
      } : undefined
    });

    return res.status(200).json({
      success: true,
      message: 'Tournament prize distribution confirmed successfully',
      tournamentId,
      transactionSignature,
      winnerData,
      distributedAt: new Date().toISOString()
    });

  } catch (err) {
    console.error('Error in confirm prize distribution controller:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to confirm tournament prize distribution',
      error: err.message || err
    });
  }
};