// src/revenue/revenueRoutes.ts - Update with these new routes

import { Router, RequestHandler } from 'express';
import {
  distributeTournamentRevenueController,
  distributeTournamentPrizesController,
  getTournamentPrizesDistributionController,
  confirmDistributionController,
  confirmPrizeDistributionController,
  getAdminPrizesDistributedController,
  getAdminDistributionTotalsController,
  getDeveloperRevenueController,
  getDeveloperRevenueHistoryController,
  getPlatformRevenueController,
  getPlatformRevenueHistoryController,
  getPlatformRevenueByDeveloperController
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
router.get('/admin/distribution-totals/:adminPubKey',
  getAdminDistributionTotalsController as unknown as RequestHandler
);

// ==============================
// DEVELOPER REVENUE ENDPOINTS
// ==============================

// Get developer revenue history (paginated) - MUST come before the general route
router.get('/developer/:developerPublicKey/history',
  getDeveloperRevenueHistoryController as unknown as RequestHandler
);

// Get developer revenue statistics
router.get('/developer/:developerPublicKey',
  getDeveloperRevenueController as unknown as RequestHandler
);

// ==============================
// PLATFORM REVENUE ENDPOINTS (Admin Only)
// ==============================

// Get platform revenue statistics
router.get('/platform',
  getPlatformRevenueController as unknown as RequestHandler
);

// Get platform revenue history (paginated)
router.get('/platform/history',
  getPlatformRevenueHistoryController as unknown as RequestHandler
);

// Get platform revenue grouped by developer
router.get('/platform/by-developer',
  getPlatformRevenueByDeveloperController as unknown as RequestHandler
);

export default router;