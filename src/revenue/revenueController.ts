// src/revenue/revenueController.ts

import { ref, get } from "firebase/database";
import { db } from "../config/firebase";
import { Request, Response } from 'express';
import { PublicKey } from '@solana/web3.js';
import { initializeRevenuePoolService, initializePrizePoolService, distributeTournamentRevenueService } from '../../src/revenue/services';


/**
 * Controller function for initializing the global revenue pool
 */
export const initializeRevenuePoolController = async (req: Request, res: Response) => {
  try {
    const { mintPublicKey } = req.body;

    // Validate the mint address
    if (!mintPublicKey) {
      return res.status(400).json({ 
        success: false, 
        message: 'Mint public key is required' 
      });
    }

    // Convert string public key to PublicKey object
    const mintPubkey = new PublicKey(mintPublicKey);

    // Call the service function to initialize revenue pool
    const result = await initializeRevenuePoolService(mintPubkey);

    // Return the result
    if (result.success) {
      return res.status(200).json(result);
    } else {
      return res.status(500).json(result);
    }
  } catch (err) {
    console.error('Error in initialize revenue pool controller:', err);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to initialize revenue pool',
      error: err.message || err
    });
  }
};

/**
 * Controller function for initializing a prize pool for a specific tournament
 */
export const initializePrizePoolController = async (req: Request, res: Response) => {
  try {
    const { tournamentId, mintPublicKey } = req.body;

    // Validate required fields
    if (!tournamentId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Tournament ID is required' 
      });
    }

    if (!mintPublicKey) {
      return res.status(400).json({ 
        success: false, 
        message: 'Mint public key is required' 
      });
    }

    // Convert string public key to PublicKey object
    const mintPubkey = new PublicKey(mintPublicKey);

    // Call the service function to initialize prize pool for the tournament
    const result = await initializePrizePoolService(tournamentId, mintPubkey);

    // Return the result
    if (result.success) {
      return res.status(200).json(result);
    } else {
      return res.status(500).json(result);
    }
  } catch (err) {
    console.error('Error in initialize prize pool controller:', err);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to initialize prize pool',
      error: err.message || err
    });
  }
};



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
    } = req.body;

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
                                stakingPercentage !== undefined
    
    if (useCustomPercentages) {
      // Ensure all percentages are provided if any are provided
      if (prizePercentage === undefined || 
          revenuePercentage === undefined || 
          stakingPercentage === undefined 
          ) {
        return res.status(400).json({
          success: false,
          message: "If custom percentages are provided, all percentages (prize, revenue, staking, and burn) must be specified"
        });
      }
      
      // Validate percentages add up to 100
      if (prizePercentage + revenuePercentage + stakingPercentage) {
        return res.status(400).json({
          success: false,
          message: "Percentages must add up to 100%"
        });
      }
      
      // Validate individual percentages are within reasonable ranges
      if (prizePercentage < 0 || prizePercentage > 100 ||
          revenuePercentage < 0 || revenuePercentage > 100 ||
          stakingPercentage < 0 || stakingPercentage > 100)
         {
        return res.status(400).json({
          success: false,
          message: "All percentages must be between 0 and 100"
        });
      }
    }

    // Call the service function to distribute revenue
    const result = await distributeTournamentRevenueService(
      tournamentId,
      prizePercentage,
      revenuePercentage,
      stakingPercentage    );

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

    // Format and return distribution details
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

