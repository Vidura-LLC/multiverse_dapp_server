//src/adminDashboard/adminDashboardRoutes.ts

import { Router, RequestHandler } from 'express';
import { checkPoolStatusController, getActiveStakersController, getAPYController, getDashboardStatsController, getDetailedStakersController, getRevenuePoolStatsController, getStakingPoolController, getStakingStatsController, getTournamentStatsController, initializePrizePoolController, confirmPrizePoolController, initializeRevenuePoolController, initializeRewardPoolController, initializeStakingPoolController } from './adminDashboardController';

const router = Router();

// Route for checking the staking pool status
router.get('/check-pool-status/:adminPublicKey', checkPoolStatusController as unknown as RequestHandler);

// Route for initializing the staking pool
router.post('/initialize-staking-pool', initializeStakingPoolController as unknown as RequestHandler);

// Route for initializing the reward pool
router.post('/initialize-reward-pool', initializeRewardPoolController as unknown as RequestHandler);

// Route for initializing the prize pool (creates transaction)
router.post('/initialize-prize-pool', initializePrizePoolController as unknown as RequestHandler);

// Route to confirm prize pool initialization after transaction is verified
router.post('/confirm-prize-pool', confirmPrizePoolController as unknown as RequestHandler);

// Route for initializing the global revenue pool
router.post('/initialize-revenue-pool', initializeRevenuePoolController as unknown as RequestHandler);


// Main route to get comprehensive staking statistics (for your dashboard)
router.get('/staking/stats/:adminPublicKey', getStakingStatsController as unknown as RequestHandler);

// Route to get staking pool data only
router.get('/staking/pool-data/:adminPublicKey', getStakingPoolController as unknown as RequestHandler);

// Route to get active stakers count and basic info
router.get('/staking/active-stakers', getActiveStakersController as unknown as RequestHandler);

// Route to get current APY calculation
router.get('/staking/apy', getAPYController as unknown as RequestHandler);

// Route to get detailed stakers information with pagination
// Query parameters: page, limit, sortBy, sortOrder
// Example: /api/staking/stakers?page=1&limit=10&sortBy=stakedAmount&sortOrder=desc
router.get('/staking/stakers', getDetailedStakersController as unknown as RequestHandler); 

// Route to get tournament stats
router.get('/tournaments/stats', getTournamentStatsController as unknown as RequestHandler);

// Route to get revenue stats
router.get('/revenue/stats/:adminPublicKey', getRevenuePoolStatsController as unknown as RequestHandler);

// Route to get dashboard data
router.get('/dashboardStats/:adminPublicKey', getDashboardStatsController as unknown as RequestHandler);


export default router;