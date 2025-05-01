// src/revenue/revenueRoutes.ts - Update with these new routes

import { Router, RequestHandler } from 'express';
import { 
  initializeRevenuePoolController,
  initializePrizePoolController,
  distributeTournamentRevenueController,
  distributeTournamentPrizesController,
  getTournamentPrizesDistributionController
} from './revenueController';

const router = Router();

// Route for initializing the global revenue pool
router.post('/initialize-revenue-pool', initializeRevenuePoolController as unknown as RequestHandler);

// Route for initializing a prize pool for a specific tournament
router.post('/initialize-prize-pool', initializePrizePoolController as unknown as RequestHandler);

// Route for distributing tournament revenue
router.post('/distribute-tournament', 
  distributeTournamentRevenueController as unknown as RequestHandler
);

// Route for distributing tournament prizes
router.post('/distribute-prizes', 
  distributeTournamentPrizesController as unknown as RequestHandler
);

// Route for getting prize distribution details
router.get('/prize-distribution/:tournamentId', 
  getTournamentPrizesDistributionController as unknown as RequestHandler
);

export default router;