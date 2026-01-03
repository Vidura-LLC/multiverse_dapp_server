//src/adminDashboard/adminDashboardController.ts

import { PublicKey, SystemProgram } from '@solana/web3.js';
import { checkPoolStatus, initializeStakingPoolService, initializeRewardPoolService, initializePrizePoolService, initializePlatformConfigService, updatePlatformConfigService, updatePlatformWalletService, transferSuperAdminService, getPlatformConfigService } from "./services";
import { getTournamentPoolPDA, getPrizePoolPDA, TokenType } from "../utils/getPDAs";
import { getProgram } from "../staking/services";
import { Request, Response } from 'express';
import {
    getStakingPoolData,
    getActiveStakers,
    calculateAPY
} from './stakingStatsService';
import { getRevenuePoolStatsService, getTournamentStats, getStakingStats, getDashboardData } from './dashboardStatsService';
import { get, ref, set, update } from 'firebase/database';
import { db } from '../config/firebase';


export const checkPoolStatusController = async (req: Request, res: Response,) => {
    try {
        const { tokenType } = req.query;

        // Validate token type
        if (!tokenType) {
            return res.status(400).json({
                success: false,
                error: 'Token type is required'
            });
        }

        // Check staking pool status (expect 0 or 1)
        const tt = Number(tokenType);
        if (tt !== TokenType.SPL && tt !== TokenType.SOL) {
            return res.status(400).json({ success: false, error: 'tokenType must be 0 (SPL) or 1 (SOL)' });
        }
        
        // Pool status check uses super admin from platform config (pools are global)
        const result = await checkPoolStatus(tt as TokenType);

        if (result.success) {
            return res.status(200).json({
                data: result
            });
        } else {
            return res.status(400).json({
                success: false,
                error: ('message' in result ? result.message : 'Failed to check pool status')
            });
        }
    } catch (err: any) {
        console.error('Error in check staking pool status controller:', err);
        return res.status(500).json({
            success: false,
            error: 'Failed to check staking pool status',
            details: err.message
        });
    }
};

// Controller function for initializing the staking pool
export const initializeStakingPoolController = async (req: Request, res: Response) => {
    try {
        const { mintPublicKey, adminPublicKey, tokenType } = req.body;  // Get mint address and token type from request body

        // Validate the mint address
        if (!mintPublicKey || !adminPublicKey || tokenType === undefined || tokenType === null) {
            return res.status(400).json({ error: 'Mint public key, admin public key and token type are required' });
        }


        // Call the staking pool initialization service (expect 0 or 1)
        const tt = Number(tokenType);
        if (tt !== TokenType.SPL && tt !== TokenType.SOL) {
            return res.status(400).json({ error: 'tokenType must be 0 (SPL) or 1 (SOL)' });
        }
        const result = await initializeStakingPoolService(new PublicKey(mintPublicKey), tt as TokenType, new PublicKey(adminPublicKey));

        // Return the result
        if (result.success) {
            return res.status(200).json({ data: result });
        } else {
            return res.status(500).json({ error: result.message });
        }
    } catch (err) {
        console.error('Error in initialize staking pool controller:', err);
        return res.status(500).json({ error: 'Failed to initialize staking pool' });
    }
  };



/**
 * Controller function for initializing a prize pool for a specific tournament
 */
export const initializePrizePoolController = async (req: Request, res: Response) => {
    try {
      const { tournamentId, mintPublicKey, adminPublicKey, tokenType } = req.body;
  
      // Validate required fields
      if (!tournamentId || !adminPublicKey || tokenType === undefined) {
        return res.status(400).json({ 
          success: false, 
          message: 'Tournament ID, Admin public key, and token type are required' 
        });
      }
  
      const tt = Number(tokenType);
      if (tt !== TokenType.SPL && tt !== TokenType.SOL) {
        return res.status(400).json({ 
          success: false, 
          message: 'tokenType must be 0 (SPL) or 1 (SOL)' 
        });
      }
  
      // For SPL, mint is required
      if (tt === TokenType.SPL && !mintPublicKey) {
        return res.status(400).json({ 
          success: false, 
          message: 'Mint public key is required for SPL tournaments' 
        });
      }
  
      const adminPubKey = new PublicKey(adminPublicKey);
      const mintPubkey = mintPublicKey ? new PublicKey(mintPublicKey) : SystemProgram.programId;
      
      // Call the service function to create transaction
      const result = await initializePrizePoolService(tournamentId, mintPubkey, adminPubKey, tt as TokenType);

      // Return transaction - prize pool will be updated in Firebase after transaction is confirmed
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

// Controller to confirm prize pool initialization after transaction is verified on blockchain
export const confirmPrizePoolController = async (req: Request, res: Response) => {
  try {
    const { tournamentId, adminPublicKey, transactionSignature, prizePool, tokenType } = req.body;

    // Validate required fields
    if (!tournamentId || !adminPublicKey || !transactionSignature || !prizePool || tokenType === undefined || tokenType === null) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: tournamentId, adminPublicKey, transactionSignature, prizePool, or tokenType",
      });
    }

    const tt = Number(tokenType);
    if (tt !== TokenType.SPL && tt !== TokenType.SOL) {
      return res.status(400).json({ message: "tokenType must be 0 (SPL) or 1 (SOL)" });
    }

    // Verify transaction exists on blockchain and was successful
    const { connection, program } = getProgram();
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
      console.error('Error verifying transaction on blockchain:', err);
      return res.status(400).json({
        success: false,
        message: 'Could not verify transaction on blockchain',
        error: err.message
      });
    }

    // Verify prize pool account exists on blockchain (confirms initialization was successful)
    try {
      const adminPubKey = new PublicKey(adminPublicKey);
      const tournamentPoolPublicKey = getTournamentPoolPDA(adminPubKey, tournamentId, tt as TokenType);
      const prizePoolPublicKey = getPrizePoolPDA(tournamentPoolPublicKey);
      
      // Verify the prize pool address matches
      if (prizePoolPublicKey.toBase58() !== prizePool) {
        return res.status(400).json({
          success: false,
          message: 'Prize pool address mismatch'
        });
      }

      // Try to fetch the prize pool account - if it exists, initialization was successful
      const prizePoolAccount = await program.account.prizePool.fetchNullable(prizePoolPublicKey);
      
      if (!prizePoolAccount) {
        return res.status(400).json({
          success: false,
          message: 'Prize pool account not found on blockchain - initialization may have failed'
        });
      }
    } catch (err) {
      console.error('Error verifying prize pool account:', err);
      return res.status(400).json({
        success: false,
        message: 'Could not verify prize pool on blockchain - prize pool account does not exist',
        error: err.message
      });
    }

    // Transaction verified and prize pool confirmed - now update Firebase
    const tournamentRef = ref(db, `tournaments/${tt}/${tournamentId}`);
    const tournamentSnapshot = await get(tournamentRef);

    if (!tournamentSnapshot.exists()) {
      return res.status(404).json({
        success: false,
        message: 'Tournament not found'
      });
    }

    const tournament = tournamentSnapshot.val();
    
    // Check if prize pool already exists (idempotency)
    if (tournament.prizePool) {
      return res.status(200).json({
        success: true,
        message: "Prize pool already initialized",
      });
    }

    // Update tournament with prize pool address
    tournament.prizePool = prizePool;

    await update(tournamentRef, tournament);

    return res.status(200).json({
      success: true,
      message: "Prize pool confirmed and tournament updated",
      prizePool: prizePool
    });
  } catch (error) {
    console.error("❌ Error in confirmPrizePool controller:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};
  
      


/**
 * Controller function for initializing the global revenue pool
 */
export const initializeRewardPoolController = async (req: Request, res: Response) => {
    try {
        const { mintPublicKey, adminPublicKey, tokenType } = req.body;

        // Validate the mint address
        if (!mintPublicKey || !adminPublicKey || tokenType === undefined || tokenType === null) {
            return res.status(400).json({
                success: false,
                message: 'Mint, Admin public key and token type are required'
            });
        }

        // Call the service function to initialize reward pool
        const tt = Number(tokenType);
        if (tt !== TokenType.SPL && tt !== TokenType.SOL) {
            return res.status(400).json({ success: false, message: 'tokenType must be 0 (SPL) or 1 (SOL)' });
        }
        const result = await initializeRewardPoolService(new PublicKey(mintPublicKey), new PublicKey(adminPublicKey), tt as TokenType);

        // Return the result
        if (result.success) {
            return res.status(200).json({data: result});
        } else {
            return res.status(500).json({ error: result.message });
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
 * Controller function to get comprehensive staking statistics
 * This is the main endpoint for your dashboard
 */
export const getStakingStatsController = async (req: Request, res: Response) => {
    try {

        const { adminPublicKey } = req.params;
        const { tokenType } = req.query;
        console.log('📊 Fetching staking statistics...');
        // Validate the admin address
        if (!adminPublicKey || !tokenType || tokenType === undefined || tokenType === null) {
            return res.status(400).json({
                success: false,
                message: 'Admin public key and token type are required'
            });
        }

        const tt = Number(tokenType);
        if (tt !== TokenType.SPL && tt !== TokenType.SOL) {
            return res.status(400).json({ success: false, message: 'tokenType must be 0 (SPL) or 1 (SOL)' });
        }
        const result = await getStakingStats(new PublicKey(adminPublicKey), tt as TokenType);

        if (result.success) {
            return res.status(200).json({
                message: "Staking statistics retrieved successfully",
                data: result

            });
        } else {
            return res.status(500).json({
                success: false,
                message: result.message || "Failed to fetch staking statistics"
            });
        }
    } catch (err) {
        console.error('❌ Error in staking stats controller:', err);
        return res.status(500).json({
            success: false,
            message: 'Internal server error while fetching staking statistics'
        });
    }
};

/**
 * Controller function to get staking pool data only
 */
export const getStakingPoolController = async (req: Request, res: Response) => {
    try {

        const { tokenType } = req.query;
        console.log('🏦 Fetching staking pool data...');

        // Pool data uses super admin from platform config (pools are global)
        const result = await getStakingPoolData(Number(tokenType) as TokenType);

        if (result.success) {
            return res.status(200).json({
                success: true,
                message: "Staking pool data retrieved successfully",
                data: result.data
            });
        } else {
            return res.status(500).json({
                success: false,
                message: result.message || "Failed to fetch staking pool data"
            });
        }
    } catch (err) {
        console.error('❌ Error in staking pool controller:', err);
        return res.status(500).json({
            success: false,
            message: 'Internal server error while fetching staking pool data'
        });
    }
};

/**
 * Controller function to get active stakers information
 */
export const getActiveStakersController = async (req: Request, res: Response) => {
    try {
        console.log('👥 Fetching active stakers...');
        
        const { adminPublicKey, tokenType } = req.query;
        
        // If both params provided, filter by tokenType
        let result;
        if (adminPublicKey && tokenType !== undefined) {
            const tt = Number(tokenType);
            if (tt !== TokenType.SPL && tt !== TokenType.SOL) {
                return res.status(400).json({
                    success: false,
                    message: 'tokenType must be 0 (SPL) or 1 (SOL)'
                });
            }
            result = await getActiveStakers(new PublicKey(adminPublicKey as string), tt as TokenType);
        } else {
            // Backward compatibility: get all stakers if params not provided
            result = await getActiveStakers();
        }

        if (result.success) {
            return res.status(200).json({
                success: true,
                message: "Active stakers data retrieved successfully",
                data: result.data
            });
        } else {
            return res.status(500).json({
                success: false,
                message: result.message || "Failed to fetch active stakers data"
            });
        }
    } catch (err) {
        console.error('❌ Error in active stakers controller:', err);
        return res.status(500).json({
            success: false,
            message: 'Internal server error while fetching active stakers'
        });
    }
};

/**
 * Controller function to get APY calculation
 */
export const getAPYController = async (req: Request, res: Response) => {
    try {
        console.log('📈 Calculating APY...');

        const result = await calculateAPY();

        if (result.success) {
            return res.status(200).json({
                success: true,
                message: "APY calculated successfully",
                data: result.data
            });
        } else {
            return res.status(500).json({
                success: false,
                message: result.message || "Failed to calculate APY"
            });
        }
    } catch (err) {
        console.error('❌ Error in APY controller:', err);
        return res.status(500).json({
            success: false,
            message: 'Internal server error while calculating APY'
        });
    }
};

/**
 * Controller function to get detailed staker information with pagination
 */
export const getDetailedStakersController = async (req: Request, res: Response) => {
    try {
        console.log('📋 Fetching detailed stakers information...');

        // Get pagination parameters from query
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const sortBy = req.query.sortBy as string || 'stakedAmount';
        const sortOrder = req.query.sortOrder as string || 'desc';

        const result = await getActiveStakers();

        if (result.success) {
            const stakers = result.data.stakers;

            // Sort stakers
            const sortedStakers = stakers.sort((a, b) => {
                if (sortBy === 'stakedAmount') {
                    return sortOrder === 'desc' ? b.stakedAmount - a.stakedAmount : a.stakedAmount - b.stakedAmount;
                } else if (sortBy === 'stakeTimestamp') {
                    return sortOrder === 'desc' ?
                        parseInt(b.stakeTimestamp) - parseInt(a.stakeTimestamp) :
                        parseInt(a.stakeTimestamp) - parseInt(b.stakeTimestamp);
                }
                return 0;
            });

            // Apply pagination
            const startIndex = (page - 1) * limit;
            const endIndex = startIndex + limit;
            const paginatedStakers = sortedStakers.slice(startIndex, endIndex);

            return res.status(200).json({
                success: true,
                message: "Detailed stakers data retrieved successfully",
                data: {
                    stakers: paginatedStakers,
                    pagination: {
                        currentPage: page,
                        totalPages: Math.ceil(stakers.length / limit),
                        totalStakers: stakers.length,
                        stakersPerPage: limit,
                        hasNextPage: endIndex < stakers.length,
                        hasPrevPage: page > 1
                    },
                    summary: {
                        activeStakersCount: result.data.activeStakersCount,
                        totalStakers: result.data.totalStakers
                    }
                }
            });
        } else {
            return res.status(500).json({
                success: false,
                message: result.message || "Failed to fetch detailed stakers data"
            });
        }
    } catch (err) {
        console.error('❌ Error in detailed stakers controller:', err);
        return res.status(500).json({
            success: false,
            message: 'Internal server error while fetching detailed stakers'
        });
    }
};


/**
 * Controller to get tournament stats
 */
export const getTournamentStatsController = async (req: Request, res: Response) => {
    try {
        console.log('📊 Fetching tournament statistics...');
        
        const { tokenType } = req.query;
        
        // Validate tokenType
        if (!tokenType || tokenType === undefined || tokenType === null) {
            return res.status(400).json({
                success: false,
                message: 'tokenType is required'
            });
        }
        
        const tt = Number(tokenType);
        if (tt !== TokenType.SPL && tt !== TokenType.SOL) {
            return res.status(400).json({
                success: false,
                message: 'tokenType must be 0 (SPL) or 1 (SOL)'
            });
        }

        // Call the service to get tournament stats filtered by tokenType
        const result = await getTournamentStats(tt as TokenType);

        if (result !== null && result !== undefined) {
            return res.status(200).json({
                success: true,
                message: "Tournament statistics retrieved successfully",
                data: result
            });
        } else {
            return res.status(500).json({
                success: false,
                message: "Failed to fetch tournament statistics"
            });
        }
    } catch (err) {
        console.error('❌ Error in tournament stats controller:', err);
        return res.status(500).json({
            success: false,
            message: 'Internal server error while fetching tournament statistics'
        });
    }
}




/**
 * Controller function to get revenue pool statistics
 */
export const getRevenuePoolStatsController = async (req: Request, res: Response) => {
    try {
        const { adminPublicKey } = req.params;
        const { tokenType } = req.query;
        // Call the service function
        const result = await getRevenuePoolStatsService(new PublicKey(adminPublicKey), Number(tokenType) as TokenType);

        if (result.success) {
            return res.status(200).json({
                success: true,
                message: result.message,
                data: result
            });
        } else {
            // Return 404 if revenue pool doesn't exist, 500 for other errors
            const statusCode = result.message.includes('not been initialized') ? 404 : 500;
            return res.status(statusCode).json({
                success: false,
                message: result.message
            });
        }
    } catch (err) {
        console.error('❌ Error in getRevenuePoolStatsController:', err);
        return res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: err.message || err
        });
    }
};


/**
 * Controller function to get all dashboard statistics
 * This is the main endpoint for your dashboard
 */

export const getDashboardStatsController = async (req: Request, res: Response) => {
    try {
        console.log('📊 Fetching all dashboard statistics...');

        const { adminPublicKey } = req.params;
        const { tokenType } = req.query;
        // Validate the admin public key
        if (!adminPublicKey) {
            return res.status(400).json({
                success: false,
                message: 'Admin public key is required'
            });
        }
        // Call the service to get all stats
        const result = await getDashboardData(new PublicKey(adminPublicKey), Number(tokenType) as TokenType);

        if (result) {
            return res.status(200).json({
                success: true,
                message: "Dashboard statistics retrieved successfully",
                dashboardStats: result
            });
        } else {
            return res.status(500).json({
                success: false,
                message: result.message || "Failed to fetch dashboard statistics"
            });
        }
    } catch (err) {
        console.error('❌ Error in dashboard stats controller:', err);
        return res.status(500).json({
            success: false,
            message: 'Internal server error while fetching dashboard statistics'
        });
    }
};

// ==============================
// PLATFORM CONFIGURATION CONTROLLERS
// ==============================

/**
 * Controller to initialize platform configuration (super admin only, one-time)
 */
export const initializePlatformConfigController = async (req: Request, res: Response) => {
    try {
        const { 
            superAdminPublicKey, 
            platformWalletPublicKey, 
            developerShareBps = 9000, 
            platformShareBps = 1000,
            developerOnboardingFee = 0  // In lamports, default 0
        } = req.body;

        // Validate required fields
        if (!superAdminPublicKey) {
            return res.status(400).json({
                success: false,
                message: 'Super admin public key is required'
            });
        }

        if (!platformWalletPublicKey) {
            return res.status(400).json({
                success: false,
                message: 'Platform wallet public key is required'
            });
        }

        // Validate public key formats
        let superAdminPubKey: PublicKey;
        let platformWalletPubKey: PublicKey;
        try {
            superAdminPubKey = new PublicKey(superAdminPublicKey);
            platformWalletPubKey = new PublicKey(platformWalletPublicKey);
        } catch (err) {
            return res.status(400).json({
                success: false,
                message: 'Invalid public key format'
            });
        }

        // Validate share percentages
        const devBps = Number(developerShareBps);
        const platBps = Number(platformShareBps);

        if (isNaN(devBps) || isNaN(platBps)) {
            return res.status(400).json({
                success: false,
                message: 'Share percentages must be valid numbers'
            });
        }

        if (devBps + platBps !== 10000) {
            return res.status(400).json({
                success: false,
                message: `Share percentages must sum to 10000 (100%). Current total: ${devBps + platBps}`
            });
        }

        // Validate onboarding fee
        const onboardingFee = Number(developerOnboardingFee);
        if (isNaN(onboardingFee) || onboardingFee < 0) {
            return res.status(400).json({
                success: false,
                message: 'Developer onboarding fee must be a valid non-negative number'
            });
        }

        // Call the service
        const result = await initializePlatformConfigService(
            superAdminPubKey,
            platformWalletPubKey,
            devBps,
            platBps,
            onboardingFee
        );

        if (result.success) {
            return res.status(200).json(result);
        } else {
            return res.status(400).json(result);
        }
    } catch (err: any) {
        console.error('❌ Error in initialize platform config controller:', err);
        return res.status(500).json({
            success: false,
            message: 'Failed to initialize platform config',
            error: err.message || err
        });
    }
};

/**
 * Controller to update platform configuration (super admin only)
 */
export const updatePlatformConfigController = async (req: Request, res: Response) => {
    try {
        const { 
            superAdminPublicKey, 
            developerShareBps, 
            platformShareBps 
        } = req.body;

        // Validate required fields
        if (!superAdminPublicKey) {
            return res.status(400).json({
                success: false,
                message: 'Super admin public key is required'
            });
        }

        if (developerShareBps === undefined || platformShareBps === undefined) {
            return res.status(400).json({
                success: false,
                message: 'Both developer and platform share percentages are required'
            });
        }

        // Validate public key format
        let superAdminPubKey: PublicKey;
        try {
            superAdminPubKey = new PublicKey(superAdminPublicKey);
        } catch (err) {
            return res.status(400).json({
                success: false,
                message: 'Invalid super admin public key format'
            });
        }

        // Validate share percentages
        const devBps = Number(developerShareBps);
        const platBps = Number(platformShareBps);

        if (isNaN(devBps) || isNaN(platBps)) {
            return res.status(400).json({
                success: false,
                message: 'Share percentages must be valid numbers'
            });
        }

        if (devBps + platBps !== 10000) {
            return res.status(400).json({
                success: false,
                message: `Share percentages must sum to 10000 (100%). Current total: ${devBps + platBps}`
            });
        }

        // Call the service
        const result = await updatePlatformConfigService(
            superAdminPubKey,
            devBps,
            platBps
        );

        if (result.success) {
            return res.status(200).json(result);
        } else {
            return res.status(400).json(result);
        }
    } catch (err: any) {
        console.error('❌ Error in update platform config controller:', err);
        return res.status(500).json({
            success: false,
            message: 'Failed to update platform config',
            error: err.message || err
        });
    }
};

/**
 * Controller to update platform wallet (super admin only)
 */
export const updatePlatformWalletController = async (req: Request, res: Response) => {
    try {
        const { 
            superAdminPublicKey, 
            newPlatformWalletPublicKey 
        } = req.body;

        // Validate required fields
        if (!superAdminPublicKey) {
            return res.status(400).json({
                success: false,
                message: 'Super admin public key is required'
            });
        }

        if (!newPlatformWalletPublicKey) {
            return res.status(400).json({
                success: false,
                message: 'New platform wallet public key is required'
            });
        }

        // Validate public key formats
        let superAdminPubKey: PublicKey;
        let newPlatformWalletPubKey: PublicKey;
        try {
            superAdminPubKey = new PublicKey(superAdminPublicKey);
            newPlatformWalletPubKey = new PublicKey(newPlatformWalletPublicKey);
        } catch (err) {
            return res.status(400).json({
                success: false,
                message: 'Invalid public key format'
            });
        }

        // Call the service
        const result = await updatePlatformWalletService(
            superAdminPubKey,
            newPlatformWalletPubKey
        );

        if (result.success) {
            return res.status(200).json(result);
        } else {
            return res.status(400).json(result);
        }
    } catch (err: any) {
        console.error('❌ Error in update platform wallet controller:', err);
        return res.status(500).json({
            success: false,
            message: 'Failed to update platform wallet',
            error: err.message || err
        });
    }
};

/**
 * Controller to transfer super admin role (super admin only)
 */
export const transferSuperAdminController = async (req: Request, res: Response) => {
    try {
        const { 
            superAdminPublicKey, 
            newSuperAdminPublicKey 
        } = req.body;

        // Validate required fields
        if (!superAdminPublicKey) {
            return res.status(400).json({
                success: false,
                message: 'Current super admin public key is required'
            });
        }

        if (!newSuperAdminPublicKey) {
            return res.status(400).json({
                success: false,
                message: 'New super admin public key is required'
            });
        }

        // Validate public key formats
        let superAdminPubKey: PublicKey;
        let newSuperAdminPubKey: PublicKey;
        try {
            superAdminPubKey = new PublicKey(superAdminPublicKey);
            newSuperAdminPubKey = new PublicKey(newSuperAdminPublicKey);
        } catch (err) {
            return res.status(400).json({
                success: false,
                message: 'Invalid public key format'
            });
        }

        // Call the service
        const result = await transferSuperAdminService(
            superAdminPubKey,
            newSuperAdminPubKey
        );

        if (result.success) {
            return res.status(200).json(result);
        } else {
            return res.status(400).json(result);
        }
    } catch (err: any) {
        console.error('❌ Error in transfer super admin controller:', err);
        return res.status(500).json({
            success: false,
            message: 'Failed to transfer super admin',
            error: err.message || err
        });
    }
};

/**
 * Controller to get platform configuration
 */
export const getPlatformConfigController = async (req: Request, res: Response) => {
    try {
        // Call the service
        const result = await getPlatformConfigService();

        if (result.success) {
            return res.status(200).json(result);
        } else {
            return res.status(404).json(result);
        }
    } catch (err: any) {
        console.error('❌ Error in get platform config controller:', err);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch platform config',
            error: err.message || err
        });
    }
};

