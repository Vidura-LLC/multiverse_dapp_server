//src/adminDashboard/adminDashboardController.ts

import { PublicKey } from '@solana/web3.js';
import { checkPoolStatus, initializeRevenuePoolService, initializeStakingPoolService, initializeRewardPoolService, initializePrizePoolService } from "./services";
import { Request, Response } from 'express';
import {
    getStakingPoolData,
    getActiveStakers,
    calculateAPY
} from './stakingStatsService';
import { getRevenuePoolStatsService, getTournamentStats, getStakingStats, getDashboardData } from './dashboardStatsService';
import { get, ref, set } from 'firebase/database';
import { db } from '../config/firebase';



export const checkPoolStatusController = async (req: Request, res: Response,) => {
    try {
        const { adminPublicKey } = req.params;

        // Validate the admin public key
        if (!adminPublicKey) {
            return res.status(400).json({
                success: false,
                error: 'Admin public key is required'
            });
        }

        // Validate public key format
        try {
            new PublicKey(adminPublicKey);
        } catch (error) {
            return res.status(400).json({
                success: false,
                error: 'Invalid admin public key format'
            });
        }

        // Check staking pool status
        const result = await checkPoolStatus(new PublicKey(adminPublicKey));

        if (result.success) {
            return res.status(200).json({
                data: result
            });
        } 
    } catch (err) {
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
        const { mintPublicKey, adminPublicKey } = req.body;  // Get mint address from request body

        // Validate the mint address
        if (!mintPublicKey || !adminPublicKey) {
            return res.status(400).json({ error: 'Mint public key is required' });
        }

        // Call the staking pool initialization service
        const result = await initializeStakingPoolService(new PublicKey(mintPublicKey), new PublicKey(adminPublicKey));

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
 * Controller function for initializing the global revenue pool
 */
export const initializeRevenuePoolController = async (req: Request, res: Response) => {
    try {
        const { mintPublicKey, adminPublicKey } = req.body;

        // Validate the mint address
        if (!mintPublicKey || !adminPublicKey) {
            return res.status(400).json({
                success: false,
                message: 'Mint and Admin public key is required'
            });
        }

        // Call the service function to initialize revenue pool
        const result = await initializeRevenuePoolService(new PublicKey(mintPublicKey), new PublicKey(adminPublicKey));

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
 * Controller function for initializing a prize pool for a specific tournament
 */
export const initializePrizePoolController = async (req: Request, res: Response) => {
    try {
      const { tournamentId, mintPublicKey, adminPublicKey } = req.body;
  
      // Validate required fields
      if (!tournamentId) {
        return res.status(400).json({ 
          success: false, 
          message: 'Tournament ID is required' 
        });
      }
  
      if (!mintPublicKey || !adminPublicKey) {
        return res.status(400).json({ 
          success: false, 
          message: 'Mint public key and Admin Public Key is required' 
        });
      }
  
      // Convert string public key to PublicKey object
      const mintPubkey = new PublicKey(mintPublicKey);
      const adminPubKey = new PublicKey(adminPublicKey);
  
      // Call the service function to initialize prize pool for the tournament
      const result = await initializePrizePoolService(tournamentId, mintPubkey, adminPubKey);
  
      if (result.success) {
        const tournamentRef = ref(db, `tournaments/${tournamentId}`);
        const tournamentSnapshot = await get(tournamentRef);
  
        if (!tournamentSnapshot.exists()) {
          return res.status(404).json({
            success: false,
            message: 'Tournament not found'
          });
        }
  
        const tournament = tournamentSnapshot.val();
        tournament.prizePool = result.prizePool;
  
        // Save the updated tournament data back to Firebase
        await set(tournamentRef, tournament);
  
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
 * Controller function for initializing the global revenue pool
 */
export const initializeRewardPoolController = async (req: Request, res: Response) => {
    try {
        const { mintPublicKey, adminPublicKey } = req.body;

        // Validate the mint address
        if (!mintPublicKey || !adminPublicKey) {
            return res.status(400).json({
                success: false,
                message: 'Mint and Admin public key is required'
            });
        }

        // Call the service function to initialize revenue pool
        const result = await initializeRewardPoolService(new PublicKey(mintPublicKey), new PublicKey(adminPublicKey));

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
        console.log('📊 Fetching staking statistics...');
        // Validate the admin address
        if (!adminPublicKey) {
            return res.status(400).json({
                success: false,
                message: 'Admin public key is required'
            });
        }

        const result = await getStakingStats(new PublicKey(adminPublicKey));

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

        const { adminPublicKey } = req.params;
        console.log('🏦 Fetching staking pool data...');

        const result = await getStakingPoolData(new PublicKey(adminPublicKey));

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

        const result = await getActiveStakers();

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

        // Call the service to get tournament stats
        const result = await getTournamentStats();

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

        // Call the service function
        const result = await getRevenuePoolStatsService(new PublicKey(adminPublicKey));

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
        // Validate the admin public key
        if (!adminPublicKey) {
            return res.status(400).json({
                success: false,
                message: 'Admin public key is required'
            });
        }
        // Call the service to get all stats
        const result = await getDashboardData(new PublicKey(adminPublicKey));

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

