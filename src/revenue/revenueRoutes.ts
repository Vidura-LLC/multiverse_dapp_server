// src/revenue/revenueRoutes.ts - Update with these new routes

import { Router, RequestHandler } from 'express';
import {
  initializePrizePoolController,
  distributeTournamentRevenueController,
  distributeTournamentPrizesController,
  getTournamentPrizesDistributionController,
  confirmDistributionController,
  confirmPrizeDistributionController,
  getRevenuePoolStatsController
} from './revenueController';

const router = Router();


// Route for initializing a prize pool for a specific tournament
router.post('/initialize-prize-pool', initializePrizePoolController as unknown as RequestHandler);

// Route for distributing tournament revenue
router.post('/distribute-tournament', 
  distributeTournamentRevenueController as unknown as RequestHandler
);

// Route for confirming tournament revenue distribution
router.post('/confirm-distribution',
  confirmDistributionController as unknown as RequestHandler
);

// Route for distributing tournament prizes
router.post('/distribute-prizes', 
  distributeTournamentPrizesController as unknown as RequestHandler
);

// Route for getting prize distribution details
router.get('/prize-distribution/:tournamentId', 
  getTournamentPrizesDistributionController as unknown as RequestHandler
);

//Router for confirming prize distribution
router.post('/confirm-prize-distribution',
  confirmPrizeDistributionController as unknown as RequestHandler
);

// Route to get revenue pool stats
router.get('/get-revenue-pool-stats/:adminPublicKey', getRevenuePoolStatsController as unknown as RequestHandler)

export default router;