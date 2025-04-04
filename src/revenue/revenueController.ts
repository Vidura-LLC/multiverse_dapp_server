// src/revenue/revenueController.ts

import { Request, Response } from 'express';
import { PublicKey } from '@solana/web3.js';
import { initializeRevenuePoolService, initializePrizePoolService } from '../../src/gamehub/services';

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