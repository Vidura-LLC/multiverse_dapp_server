"use strict";
// src/analytics/analyticsRoutes.ts
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const sdkAuthMiddleware_1 = require("../sdk/sdkAuthMiddleware");
const analyticsMiddleware_1 = require("./analyticsMiddleware");
const analyticsController_1 = require("./analyticsController");
const router = (0, express_1.Router)();
// ============================================
// SDK Event Tracking Routes (API Key Auth)
// ============================================
/**
 * POST /api/analytics/events
 * Track a single analytics event
 * Auth: API Key (sdkAuth)
 */
router.post('/events', sdkAuthMiddleware_1.sdkAuth, analyticsController_1.trackEventController);
/**
 * POST /api/analytics/events/batch
 * Track a batch of analytics events (max 100)
 * Auth: API Key (sdkAuth)
 */
router.post('/events/batch', sdkAuthMiddleware_1.sdkAuth, analyticsController_1.trackBatchEventsController);
// ============================================
// Developer Routes (Session Auth)
// ============================================
/**
 * GET /api/analytics/games/:gameId/summary
 * Get game summary for a date range
 * Auth: Session (requireGameOwnership)
 * Query: ?days=7|30|90
 */
router.get('/games/:gameId/summary', analyticsMiddleware_1.requireGameOwnership, analyticsController_1.getGameSummaryController);
/**
 * GET /api/analytics/games/:gameId/trends
 * Get game trends for a date range
 * Auth: Session (requireGameOwnership)
 * Query: ?days=30
 */
router.get('/games/:gameId/trends', analyticsMiddleware_1.requireGameOwnership, analyticsController_1.getGameTrendsController);
/**
 * GET /api/analytics/games/:gameId/errors
 * Get game errors for a date range
 * Auth: Session (requireGameOwnership)
 * Query: ?days=7
 */
router.get('/games/:gameId/errors', analyticsMiddleware_1.requireGameOwnership, analyticsController_1.getGameErrorsController);
/**
 * GET /api/analytics/games/:gameId/versions
 * Get game SDK versions for a date range
 * Auth: Session (requireGameOwnership)
 * Query: ?days=30
 */
router.get('/games/:gameId/versions', analyticsMiddleware_1.requireGameOwnership, analyticsController_1.getGameVersionsController);
// ============================================
// Admin Routes (Admin Auth)
// ============================================
/**
 * GET /api/analytics/admin/summary
 * Get platform summary for a date range
 * Auth: Admin (requireAdmin)
 * Query: ?days=7|30|90
 */
router.get('/admin/summary', analyticsMiddleware_1.requireAdmin, analyticsController_1.getPlatformSummaryController);
/**
 * GET /api/analytics/admin/trends
 * Get platform trends for a date range
 * Auth: Admin (requireAdmin)
 * Query: ?days=30
 */
router.get('/admin/trends', analyticsMiddleware_1.requireAdmin, analyticsController_1.getPlatformTrendsController);
/**
 * GET /api/analytics/admin/versions
 * Get platform SDK versions for a date range
 * Auth: Admin (requireAdmin)
 * Query: ?days=30
 */
router.get('/admin/versions', analyticsMiddleware_1.requireAdmin, analyticsController_1.getPlatformVersionsController);
/**
 * GET /api/analytics/admin/games/issues
 * Get games with issues (high error rates)
 * Auth: Admin (requireAdmin)
 * Query: ?days=7&minErrorRate=10
 */
router.get('/admin/games/issues', analyticsMiddleware_1.requireAdmin, analyticsController_1.getGamesWithIssuesController);
/**
 * GET /api/analytics/admin/games/leaderboard
 * Get games leaderboard
 * Auth: Admin (requireAdmin)
 * Query: ?days=30&limit=20
 */
router.get('/admin/games/leaderboard', analyticsMiddleware_1.requireAdmin, analyticsController_1.getGamesLeaderboardController);
/**
 * GET /api/analytics/admin/games/:gameId
 * Get admin game details (summary, trends, errors, versions)
 * Auth: Admin (requireAdmin)
 * Query: ?days=30
 */
router.get('/admin/games/:gameId', analyticsMiddleware_1.requireAdmin, analyticsController_1.getAdminGameDetailsController);
exports.default = router;
//# sourceMappingURL=analyticsRoutes.js.map