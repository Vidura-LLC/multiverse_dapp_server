// src/revenue/revenueController.ts

import { ref, get, update, set } from "firebase/database";
import { db } from "../config/firebase";
import { Request, Response } from 'express';
import { PublicKey } from '@solana/web3.js';
import { distributeTournamentRevenueService, distributeTournamentPrizesService, DEFAULT_SPLITS } from './services';
import { getProgram } from "../staking/services";
import { TokenType } from "../utils/getPDAs";
import { getRevenuePoolStatsService } from "../adminDashboard/dashboardStatsService";


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
      adminPublicKey,
      tokenType
    } = req.body;

    // Validate tournament ID
    if (!tournamentId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Tournament ID is required' 
      });
    }

    // Validate admin public key
    if (!adminPublicKey) {
      return res.status(400).json({
        success: false,
        message: 'Admin public key is required'
      });
    }

    let adminPubKey: PublicKey;
    try {
      adminPubKey = new PublicKey(adminPublicKey);
    } catch (err) {
      return res.status(400).json({
        success: false,
        message: 'Invalid admin public key format'
      });
    }

    // Validate token type
    if (tokenType === undefined || tokenType === null) {
      return res.status(400).json({
        success: false,
        message: "Token type is required"
      });
    }

    const tt = Number(tokenType);
    if (tt !== TokenType.SPL && tt !== TokenType.SOL) {
      return res.status(400).json({ 
        success: false, 
        message: 'tokenType must be 0 (SPL) or 1 (SOL)' 
      });
    }

    // Validate custom percentages if provided
    const useCustomPercentages = prizePercentage !== undefined || 
                               revenuePercentage !== undefined || 
                               stakingPercentage !== undefined ||
                               burnPercentage !== undefined;
     
    let finalPrizePercentage = DEFAULT_SPLITS.PRIZE_POOL;
    let finalRevenuePercentage = DEFAULT_SPLITS.REVENUE_POOL;
    let finalStakingPercentage = DEFAULT_SPLITS.STAKING_REWARD_POOL;
    let finalBurnPercentage = DEFAULT_SPLITS.BURN;

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
          message: `Percentages must add up to 100%. Current total: ${prizePercentage + revenuePercentage + stakingPercentage + burnPercentage}%`
        });
      }
      
      // Validate individual percentages are within valid ranges
      if (prizePercentage < 0 || prizePercentage > 100 ||
          revenuePercentage < 0 || revenuePercentage > 100 ||
          stakingPercentage < 0 || stakingPercentage > 100 ||
          burnPercentage < 0 || burnPercentage > 100) {
        return res.status(400).json({
          success: false,
          message: "All percentages must be between 0 and 100"
        });
      }

      finalPrizePercentage = prizePercentage;
      finalRevenuePercentage = revenuePercentage;
      finalStakingPercentage = stakingPercentage;
      finalBurnPercentage = burnPercentage;

      console.log("✅ Using custom distribution percentages:");
    } else {
      console.log("✅ Using default distribution percentages:");
    }

    console.log(`   Prize: ${finalPrizePercentage}%`);
    console.log(`   Revenue: ${finalRevenuePercentage}%`);
    console.log(`   Staking: ${finalStakingPercentage}%`);
    console.log(`   Burn: ${finalBurnPercentage}%`);

    // Call the service function
    const result = await distributeTournamentRevenueService(
      tournamentId,
      finalPrizePercentage,
      finalRevenuePercentage,
      finalStakingPercentage,
      finalBurnPercentage,
      adminPubKey,
      tt as TokenType
    );

    // Return the result
    if (result.success) {
      return res.status(200).json(result);
    } else {
      return res.status(400).json(result);
    }
  } catch (err) {
    console.error('❌ Error in distribute tournament revenue controller:', err);
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

    // Check both 'distribution' and 'distributionDetails' for backward compatibility
    const distDetails = tournament.distribution || tournament.distributionDetails || {};
    
    // Format and return distribution details including burn information
    return res.status(200).json({
      success: true,
      tournamentId,
      tournamentName: tournament.name,
      distributionDetails: {
        completedAt: new Date(tournament.distributionTimestamp).toISOString(),
        totalDistributed: distDetails.totalDistributed || (distDetails.prizeAmount + distDetails.revenueAmount + distDetails.stakingAmount + distDetails.burnAmount) || 0,
        prizeAmount: distDetails.prizeAmount || 0,
        revenueAmount: distDetails.revenueAmount || 0,
        stakingAmount: distDetails.stakingAmount || 0,
        burnAmount: distDetails.burnAmount || 0,
        transactionSignature: tournament.distributionTransaction || distDetails.transactionSignature || '',
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
    const { tournamentId, firstPlacePublicKey, secondPlacePublicKey, thirdPlacePublicKey, adminPublicKey, tokenType } = req.body;

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

    if (tokenType === undefined || tokenType === null) {
      return res.status(400).json({
        success: false,
        message: "Token type is required"
      });
    }
    const tt = Number(tokenType);
    if (tt !== TokenType.SPL && tt !== TokenType.SOL) {
      return res.status(400).json({ success: false, message: 'tokenType must be 0 (SPL) or 1 (SOL)' });
    }
    // Verify tournament exists
    const tournamentRef = ref(db, `tournaments/${tt as TokenType}/${tournamentId}`);
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
      adminPubKey,
      tt as TokenType
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
    const { tokenType } = req.query;

    // Validate tournament ID
    if (!tournamentId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Tournament ID is required' 
      });
    }

    if (tokenType === undefined || tokenType === null) {
      return res.status(400).json({
        success: false,
        message: 'Token type is required'
      });
    }

    const tt = Number(tokenType);
    if (tt !== TokenType.SPL && tt !== TokenType.SOL) {
      return res.status(400).json({ 
        success: false, 
        message: 'tokenType must be 0 (SPL) or 1 (SOL)' 
      });
    }

    // Get tournament data from Firebase
    const tournamentRef = ref(db, `tournaments/${tt as TokenType}/${tournamentId}`);
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
    const { adminPubKey } = req.params as { adminPubKey?: string };
    const { tokenType } = req.query;

    if (!adminPubKey || (tokenType === undefined || tokenType === null)) {
      return res.status(400).json({ success: false, message: 'adminPubKey and tokenType are required' });
    }

    const tt = Number(tokenType);
    if (tt !== TokenType.SPL && tt !== TokenType.SOL) {
      return res.status(400).json({ success: false, message: 'tokenType must be 0 (SPL) or 1 (SOL)' });
    }

    // Fetch all tournaments
    const tournamentsRef = ref(db, `tournaments/${tt as TokenType}`);
    const tournamentsSnapshot = await get(tournamentsRef);

    // Fetch revenue pool information (even if no tournaments exist)
    const revenuePoolStats = await getRevenuePoolStatsService(new PublicKey(adminPubKey), tt as TokenType);
    
    if (!tournamentsSnapshot.exists()) {
      return res.status(200).json({
        success: true,
        data: {
          prizeAmountRaw: '0', revenueAmountRaw: '0', stakingAmountRaw: '0', burnAmountRaw: '0',
          prizeAmount: 0, revenueAmount: 0, stakingAmount: 0, burnAmount: 0,
          tokenDecimals: 9, tournamentCount: 0,
          revenue: revenuePoolStats, // Include revenue pool information
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
      // Check both 'distribution' and 'distributionDetails' for backward compatibility
      const d = t?.distribution || t?.distributionDetails || {};
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
        revenue: revenuePoolStats, // Include revenue pool information
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
      distribution,
      tokenType
    } = req.body;

    // Validate required fields
    if (!tournamentId || !transactionSignature) {
      return res.status(400).json({
        success: false,
        message: 'Tournament ID and transaction signature are required'
      });
    }

    if (tokenType === undefined || tokenType === null) {
      return res.status(400).json({
        success: false,
        message: 'Token type is required'
      });
    }

    const tt = Number(tokenType);
    if (tt !== TokenType.SPL && tt !== TokenType.SOL) {
      return res.status(400).json({ 
        success: false, 
        message: 'tokenType must be 0 (SPL) or 1 (SOL)' 
      });
    }

    // Verify transaction exists on blockchain (optional but recommended)
    const { connection } = getProgram();
    try {
      const txInfo = await connection.getTransaction(transactionSignature, {
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
      console.warn('Could not verify transaction on blockchain:', err);
      // Continue anyway - transaction might be too recent
    }

    // Update tournament status in Firebase
    console.log("Updating tournament status in Firebase...");
    const tournamentRef = ref(db, `tournaments/${tt as TokenType}/${tournamentId}`);

    // Check if tournament exists
    const tournamentSnapshot = await get(tournamentRef);
    if (!tournamentSnapshot.exists()) {
      return res.status(404).json({
        success: false,
        message: 'Tournament not found'
      });
    }

    const tournament = tournamentSnapshot.val();

    // Prevent double distribution
    if (tournament.distributionCompleted) {
      return res.status(400).json({
        success: false,
        message: 'Tournament revenue has already been distributed'
      });
    }

    // Get developer wallet (adminPublicKey) from tournament
    const adminPublicKey = tournament.createdBy;
    if (!adminPublicKey) {
      return res.status(400).json({
        success: false,
        message: 'Tournament creator (adminPublicKey) not found'
      });
    }

    // Extract distribution details
    const distributionDetails = distribution || {};
    const developerShare = distributionDetails.developerShare || 0;
    const platformShare = distributionDetails.platformShare || 0;
    const prizeAmount = distributionDetails.prizeAmount || 0;
    const stakingAmount = distributionDetails.stakingAmount || 0;
    const burnAmount = distributionDetails.burnAmount || 0;
    const totalFunds = distributionDetails.totalFunds || 0;

    // Convert token type to string key
    const tokenKey = tt === TokenType.SOL ? "SOL" : "SPL";
    const currentTimestamp = Date.now();

    // Track DEVELOPER revenue in Firebase
    console.log("📊 Tracking developer revenue in Firebase...");
    const developerRef = ref(db, `developerRevenue/${adminPublicKey}`);
    const developerSnapshot = await get(developerRef);
    
    const developerHistoryEntry = {
      tournamentId,
      tournamentName: tournament.name || tournament.tournamentName || tournamentId,
      gameId: tournament.gameId || tournament.game || "",
      amount: developerShare, // Amount in base units
      tokenType: tokenKey,
      sharePercent: 90,
      timestamp: currentTimestamp,
      txSignature: transactionSignature
    };

    if (developerSnapshot.exists()) {
      const data = developerSnapshot.val();
      const existingHistory = data.history || [];
      const currentTotalEarned = data.totalEarned || { SOL: 0, SPL: 0 };
      
      await update(developerRef, {
        walletAddress: adminPublicKey,
        totalEarned: {
          ...currentTotalEarned,
          [tokenKey]: (currentTotalEarned[tokenKey] || 0) + developerShare
        },
        tournamentsCount: (data.tournamentsCount || 0) + 1,
        lastDistribution: currentTimestamp,
        history: [...existingHistory, developerHistoryEntry]
      });
      console.log(`✅ Updated developer revenue for ${adminPublicKey}`);
    } else {
      await set(developerRef, {
        walletAddress: adminPublicKey,
        totalEarned: { 
          SOL: tokenKey === "SOL" ? developerShare : 0,
          SPL: tokenKey === "SPL" ? developerShare : 0
        },
        tournamentsCount: 1,
        lastDistribution: currentTimestamp,
        history: [developerHistoryEntry]
      });
      console.log(`✅ Created developer revenue record for ${adminPublicKey}`);
    }

    // Track PLATFORM revenue in Firebase
    console.log("📊 Tracking platform revenue in Firebase...");
    const platformRef = ref(db, `platformRevenue`);
    const platformSnapshot = await get(platformRef);
    
    const platformHistoryEntry = {
      tournamentId,
      developerWallet: adminPublicKey,
      amount: platformShare, // Amount in base units
      tokenType: tokenKey,
      sharePercent: 10,
      timestamp: currentTimestamp,
      txSignature: transactionSignature
    };

    if (platformSnapshot.exists()) {
      const data = platformSnapshot.val();
      const existingHistory = data.history || [];
      const currentTotalEarned = data.totalEarned || { SOL: 0, SPL: 0 };
      
      await update(platformRef, {
        totalEarned: {
          ...currentTotalEarned,
          [tokenKey]: (currentTotalEarned[tokenKey] || 0) + platformShare
        },
        tournamentsCount: (data.tournamentsCount || 0) + 1,
        lastDistribution: currentTimestamp,
        history: [...existingHistory, platformHistoryEntry]
      });
      console.log(`✅ Updated platform revenue`);
    } else {
      await set(platformRef, {
        totalEarned: { 
          SOL: tokenKey === "SOL" ? platformShare : 0,
          SPL: tokenKey === "SPL" ? platformShare : 0
        },
        tournamentsCount: 1,
        lastDistribution: currentTimestamp,
        history: [platformHistoryEntry]
      });
      console.log(`✅ Created platform revenue record`);
    }

    // Update tournament with distribution info
    await update(tournamentRef, {
      status: 'Distributed',
      distributionCompleted: true,
      distributionTimestamp: currentTimestamp,
      distributionTransaction: transactionSignature,
      distributionDetails: {
        prizeAmount,
        developerShare,
        platformShare,
        stakingAmount,
        burnAmount,
        totalFunds,
        totalDistributed: prizeAmount + developerShare + platformShare + stakingAmount + burnAmount,
        transactionSignature: transactionSignature
      }
    });

    console.log(`✅ Tournament ${tournamentId} distribution confirmed and revenue tracked`);

    return res.status(200).json({
      success: true,
      message: 'Tournament revenue distribution confirmed successfully',
      tournamentId,
      transactionSignature,
      distribution
    });

  } catch (err) {
    console.error('Error confirming distribution:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to confirm distribution',
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
      winnerData,
      tokenType
    } = req.body;

    // Validate required fields
    if (!tournamentId || !transactionSignature) {
      return res.status(400).json({
        success: false,
        message: 'Tournament ID and transaction signature are required'
      });
    }

    if (tokenType === undefined || tokenType === null) {
      return res.status(400).json({
        success: false,
        message: 'Token type is required'
      });
    }

    const tt = Number(tokenType);
    if (tt !== TokenType.SPL && tt !== TokenType.SOL) {
      return res.status(400).json({ 
        success: false, 
        message: 'tokenType must be 0 (SPL) or 1 (SOL)' 
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
    const tournamentRef = ref(db, `tournaments/${tt as TokenType}/${tournamentId}`);

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

/**
 * Get developer revenue statistics
 * GET /api/revenue/developer/:developerPublicKey
 */
export const getDeveloperRevenueController = async (req: Request, res: Response) => {
  const { developerPublicKey } = req.params;

  if (!developerPublicKey) {
    return res.status(400).json({
      success: false,
      message: 'Developer public key is required'
    });
  }

  try {
    const developerRef = ref(db, `developerRevenue/${developerPublicKey}`);
    const developerSnapshot = await get(developerRef);

    if (!developerSnapshot.exists()) {
      return res.status(200).json({
        success: true,
        data: {
          walletAddress: developerPublicKey,
          totalEarned: { SOL: 0, SPL: 0 },
          tournamentsCount: 0,
          lastDistribution: null,
          history: []
        }
      });
    }

    const developerData = developerSnapshot.val();
    
    // Convert amounts from base units to readable format
    const tokenDecimals = 9;
    const totalEarnedSOL = (developerData.totalEarned?.SOL || 0) / (10 ** tokenDecimals);
    const totalEarnedSPL = (developerData.totalEarned?.SPL || 0) / (10 ** tokenDecimals);

    return res.status(200).json({
      success: true,
      data: {
        walletAddress: developerData.walletAddress || developerPublicKey,
        totalEarned: {
          SOL: totalEarnedSOL,
          SPL: totalEarnedSPL
        },
        tournamentsCount: developerData.tournamentsCount || 0,
        lastDistribution: developerData.lastDistribution || null,
        history: developerData.history || []
      }
    });
  } catch (err: any) {
    console.error('Error fetching developer revenue:', err);
    // Handle Firebase permission errors gracefully - return empty data instead of error
    if (err.message && err.message.includes('Permission denied')) {
      return res.status(200).json({
        success: true,
        data: {
          walletAddress: developerPublicKey,
          totalEarned: { SOL: 0, SPL: 0 },
          tournamentsCount: 0,
          lastDistribution: null,
          history: []
        }
      });
    }
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch developer revenue',
      error: err.message || err
    });
  }
};

/**
 * Get developer revenue history (paginated)
 * GET /api/revenue/developer/:developerPublicKey/history
 */
export const getDeveloperRevenueHistoryController = async (req: Request, res: Response) => {
  try {
    const { developerPublicKey } = req.params;
    const { page = 1, limit: limitParam = 20, tokenType } = req.query;

    if (!developerPublicKey) {
      return res.status(400).json({
        success: false,
        message: 'Developer public key is required'
      });
    }

    const developerRef = ref(db, `developerRevenue/${developerPublicKey}`);
    const developerSnapshot = await get(developerRef);

    if (!developerSnapshot.exists()) {
      return res.status(200).json({
        success: true,
        data: {
          history: [],
          total: 0,
          page: Number(page),
          limit: Number(limitParam)
        }
      });
    }

    const developerData = developerSnapshot.val();
    let history = developerData.history || [];

    // Filter by token type if provided
    if (tokenType) {
      history = history.filter((entry: any) => entry.tokenType === tokenType);
    }

    // Sort by timestamp descending (newest first)
    history.sort((a: any, b: any) => (b.timestamp || 0) - (a.timestamp || 0));

    // Paginate
    const pageNum = Number(page);
    const limitNum = Number(limitParam);
    const startIndex = (pageNum - 1) * limitNum;
    const endIndex = startIndex + limitNum;
    const paginatedHistory = history.slice(startIndex, endIndex);

    // Convert amounts from base units to readable format
    const tokenDecimals = 9;
    const formattedHistory = paginatedHistory.map((entry: any) => ({
      ...entry,
      amount: entry.amount / (10 ** tokenDecimals)
    }));

    return res.status(200).json({
      success: true,
      data: {
        history: formattedHistory,
        total: history.length,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(history.length / limitNum)
      }
    });
  } catch (err: any) {
    console.error('Error fetching developer revenue history:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch developer revenue history',
      error: err.message || err
    });
  }
};

/**
 * Get platform revenue statistics (admin only)
 * GET /api/revenue/platform
 */
export const getPlatformRevenueController = async (req: Request, res: Response) => {
  try {
    const platformRef = ref(db, `platformRevenue`);
    const platformSnapshot = await get(platformRef);

    if (!platformSnapshot.exists()) {
      return res.status(200).json({
        success: true,
        data: {
          totalEarned: { SOL: 0, SPL: 0 },
          tournamentsCount: 0,
          lastDistribution: null,
          history: []
        }
      });
    }

    const platformData = platformSnapshot.val();
    
    // Convert amounts from base units to readable format
    const tokenDecimals = 9;
    const totalEarnedSOL = (platformData.totalEarned?.SOL || 0) / (10 ** tokenDecimals);
    const totalEarnedSPL = (platformData.totalEarned?.SPL || 0) / (10 ** tokenDecimals);

    return res.status(200).json({
      success: true,
      data: {
        totalEarned: {
          SOL: totalEarnedSOL,
          SPL: totalEarnedSPL
        },
        tournamentsCount: platformData.tournamentsCount || 0,
        lastDistribution: platformData.lastDistribution || null,
        history: platformData.history || []
      }
    });
  } catch (err: any) {
    console.error('Error fetching platform revenue:', err);
    // Handle Firebase permission errors gracefully - return empty data instead of error
    if (err.message && err.message.includes('Permission denied')) {
      return res.status(200).json({
        success: true,
        data: {
          totalEarned: { SOL: 0, SPL: 0 },
          tournamentsCount: 0,
          lastDistribution: null,
          history: []
        }
      });
    }
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch platform revenue',
      error: err.message || err
    });
  }
};

/**
 * Get platform revenue history (paginated, admin only)
 * GET /api/revenue/platform/history
 */
export const getPlatformRevenueHistoryController = async (req: Request, res: Response) => {
  try {
    const { page = 1, limit: limitParam = 20, tokenType } = req.query;

    const platformRef = ref(db, `platformRevenue`);
    const platformSnapshot = await get(platformRef);

    if (!platformSnapshot.exists()) {
      return res.status(200).json({
        success: true,
        data: {
          history: [],
          total: 0,
          page: Number(page),
          limit: Number(limitParam)
        }
      });
    }

    const platformData = platformSnapshot.val();
    let history = platformData.history || [];

    // Filter by token type if provided
    if (tokenType) {
      history = history.filter((entry: any) => entry.tokenType === tokenType);
    }

    // Sort by timestamp descending (newest first)
    history.sort((a: any, b: any) => (b.timestamp || 0) - (a.timestamp || 0));

    // Paginate
    const pageNum = Number(page);
    const limitNum = Number(limitParam);
    const startIndex = (pageNum - 1) * limitNum;
    const endIndex = startIndex + limitNum;
    const paginatedHistory = history.slice(startIndex, endIndex);

    // Convert amounts from base units to readable format
    const tokenDecimals = 9;
    const formattedHistory = paginatedHistory.map((entry: any) => ({
      ...entry,
      amount: entry.amount / (10 ** tokenDecimals)
    }));

    return res.status(200).json({
      success: true,
      data: {
        history: formattedHistory,
        total: history.length,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(history.length / limitNum)
      }
    });
  } catch (err: any) {
    console.error('Error fetching platform revenue history:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch platform revenue history',
      error: err.message || err
    });
  }
};

/**
 * Get platform revenue grouped by developer (admin only)
 * GET /api/revenue/platform/by-developer
 */
export const getPlatformRevenueByDeveloperController = async (req: Request, res: Response) => {
  try {
    const platformRef = ref(db, `platformRevenue`);
    const platformSnapshot = await get(platformRef);

    if (!platformSnapshot.exists()) {
      return res.status(200).json({
        success: true,
        data: []
      });
    }

    const platformData = platformSnapshot.val();
    const history = platformData.history || [];

    // Group by developer wallet
    const byDeveloper: { [key: string]: { developerWallet: string, totalSOL: number, totalSPL: number, count: number } } = {};

    history.forEach((entry: any) => {
      const devWallet = entry.developerWallet;
      if (!devWallet) return;

      if (!byDeveloper[devWallet]) {
        byDeveloper[devWallet] = {
          developerWallet: devWallet,
          totalSOL: 0,
          totalSPL: 0,
          count: 0
        };
      }

      if (entry.tokenType === 'SOL') {
        byDeveloper[devWallet].totalSOL += entry.amount || 0;
      } else if (entry.tokenType === 'SPL') {
        byDeveloper[devWallet].totalSPL += entry.amount || 0;
      }
      byDeveloper[devWallet].count += 1;
    });

    // Convert amounts from base units to readable format
    const tokenDecimals = 9;
    const result = Object.values(byDeveloper).map((dev) => ({
      ...dev,
      totalSOL: dev.totalSOL / (10 ** tokenDecimals),
      totalSPL: dev.totalSPL / (10 ** tokenDecimals)
    }));

    // Sort by total revenue (SOL + SPL combined)
    result.sort((a, b) => (b.totalSOL + b.totalSPL) - (a.totalSOL + a.totalSPL));

    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (err: any) {
    console.error('Error fetching platform revenue by developer:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch platform revenue by developer',
      error: err.message || err
    });
  }
};