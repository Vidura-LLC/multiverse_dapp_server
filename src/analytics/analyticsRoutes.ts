// src/analytics/analyticsRoutes.ts

import { Router, RequestHandler } from 'express';
import { sdkAuth } from '../sdk/sdkAuthMiddleware';
import { requireGameOwnership, requireAdmin } from './analyticsMiddleware';
import {
  trackEventController,
  trackBatchEventsController,
  getGameSummaryController,
  getGameTrendsController,
  getGameErrorsController,
  getGameVersionsController,
  getPlatformSummaryController,
  getPlatformTrendsController,
  getPlatformVersionsController,
  getGamesWithIssuesController,
  getGamesLeaderboardController,
  getAdminGameDetailsController,
} from './analyticsController';

const router = Router();

// ============================================
// SDK Event Tracking Routes (API Key Auth)
// ============================================

/**
 * POST /api/analytics/events
 * Track a single analytics event
 * Auth: API Key (sdkAuth)
 */
router.post(
  '/events',
  sdkAuth as unknown as RequestHandler,
  trackEventController as unknown as RequestHandler
);

/**
 * POST /api/analytics/events/batch
 * Track a batch of analytics events (max 100)
 * Auth: API Key (sdkAuth)
 */
router.post(
  '/events/batch',
  sdkAuth as unknown as RequestHandler,
  trackBatchEventsController as unknown as RequestHandler
);

// ============================================
// Developer Routes (Session Auth)
// ============================================

/**
 * GET /api/analytics/games/:gameId/summary
 * Get game summary for a date range
 * Auth: Session (requireGameOwnership)
 * Query: ?days=7|30|90
 */
router.get(
  '/games/:gameId/summary',
  requireGameOwnership as unknown as RequestHandler,
  getGameSummaryController as unknown as RequestHandler
);

/**
 * GET /api/analytics/games/:gameId/trends
 * Get game trends for a date range
 * Auth: Session (requireGameOwnership)
 * Query: ?days=30
 */
router.get(
  '/games/:gameId/trends',
  requireGameOwnership as unknown as RequestHandler,
  getGameTrendsController as unknown as RequestHandler
);

/**
 * GET /api/analytics/games/:gameId/errors
 * Get game errors for a date range
 * Auth: Session (requireGameOwnership)
 * Query: ?days=7
 */
router.get(
  '/games/:gameId/errors',
  requireGameOwnership as unknown as RequestHandler,
  getGameErrorsController as unknown as RequestHandler
);

/**
 * GET /api/analytics/games/:gameId/versions
 * Get game SDK versions for a date range
 * Auth: Session (requireGameOwnership)
 * Query: ?days=30
 */
router.get(
  '/games/:gameId/versions',
  requireGameOwnership as unknown as RequestHandler,
  getGameVersionsController as unknown as RequestHandler
);

// ============================================
// Admin Routes (Admin Auth)
// ============================================

/**
 * GET /api/analytics/admin/summary
 * Get platform summary for a date range
 * Auth: Admin (requireAdmin)
 * Query: ?days=7|30|90
 */
router.get(
  '/admin/summary',
  requireAdmin as unknown as RequestHandler,
  getPlatformSummaryController as unknown as RequestHandler
);

/**
 * GET /api/analytics/admin/trends
 * Get platform trends for a date range
 * Auth: Admin (requireAdmin)
 * Query: ?days=30
 */
router.get(
  '/admin/trends',
  requireAdmin as unknown as RequestHandler,
  getPlatformTrendsController as unknown as RequestHandler
);

/**
 * GET /api/analytics/admin/versions
 * Get platform SDK versions for a date range
 * Auth: Admin (requireAdmin)
 * Query: ?days=30
 */
router.get(
  '/admin/versions',
  requireAdmin as unknown as RequestHandler,
  getPlatformVersionsController as unknown as RequestHandler
);

/**
 * GET /api/analytics/admin/games/issues
 * Get games with issues (high error rates)
 * Auth: Admin (requireAdmin)
 * Query: ?days=7&minErrorRate=10
 */
router.get(
  '/admin/games/issues',
  requireAdmin as unknown as RequestHandler,
  getGamesWithIssuesController as unknown as RequestHandler
);

/**
 * GET /api/analytics/admin/games/leaderboard
 * Get games leaderboard
 * Auth: Admin (requireAdmin)
 * Query: ?days=30&limit=20
 */
router.get(
  '/admin/games/leaderboard',
  requireAdmin as unknown as RequestHandler,
  getGamesLeaderboardController as unknown as RequestHandler
);

/**
 * GET /api/analytics/admin/games/:gameId
 * Get admin game details (summary, trends, errors, versions)
 * Auth: Admin (requireAdmin)
 * Query: ?days=30
 */
router.get(
  '/admin/games/:gameId',
  requireAdmin as unknown as RequestHandler,
  getAdminGameDetailsController as unknown as RequestHandler
);

export default router;

