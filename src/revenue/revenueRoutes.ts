// src/revenue/revenueRoutes.ts - Update with these new routes

import { Router, RequestHandler } from 'express';
import {
  distributeTournamentRevenueController,
  distributeTournamentPrizesController,
  getTournamentPrizesDistributionController,
  confirmDistributionController,
  confirmPrizeDistributionController,
  getAdminPrizesDistributedController,
  getAdminDistributionTotalsController
} from './revenueController';

const router = Router();


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

//Router for confirming prize distribution
router.post('/confirm-prize-distribution',
  confirmPrizeDistributionController as unknown as RequestHandler
);

// Route for getting prize distribution details
router.get('/prize-distribution/:tournamentId', 
  getTournamentPrizesDistributionController as unknown as RequestHandler
);

// Route for admin total prizes distributed across tournaments
router.get('/admin/prizes-distributed/:adminPubKey',
  getAdminPrizesDistributedController as unknown as RequestHandler
);

// Route for admin distribution totals aggregation
router.get('/admin/distribution-totals/:adminPubKey/:tokenType',
  getAdminDistributionTotalsController as unknown as RequestHandler
);



export default router;