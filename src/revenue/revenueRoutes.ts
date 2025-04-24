// src/revenue/revenueRoutes.ts

import { Router, RequestHandler } from 'express';
import { 
  initializeRevenuePoolController,
  initializePrizePoolController,
  distributeTournamentRevenueController
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
export default router;