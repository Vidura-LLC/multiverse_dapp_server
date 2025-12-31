"use strict";
// src/analytics/analyticsController.ts
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAdminGameDetailsController = exports.getGamesLeaderboardController = exports.getGamesWithIssuesController = exports.getPlatformVersionsController = exports.getPlatformTrendsController = exports.getPlatformSummaryController = exports.getGameVersionsController = exports.getGameErrorsController = exports.getGameTrendsController = exports.getGameSummaryController = exports.trackBatchEventsController = exports.trackEventController = void 0;
const analyticsService_1 = require("./analyticsService");
// ============================================
// SDK Event Tracking Controllers
// ============================================
/**
 * Track a single analytics event
 * POST /api/analytics/events
 */
const trackEventController = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const gameId = (_a = req.game) === null || _a === void 0 ? void 0 : _a.gameId;
        if (!gameId) {
            res.status(401).json({
                success: false,
                error: 'UNAUTHORIZED',
                message: 'Game context missing',
            });
            return;
        }
        const event = req.body;
        if (!event.eventName) {
            res.status(400).json({
                success: false,
                error: 'INVALID_REQUEST',
                message: 'eventName is required',
            });
            return;
        }
        yield (0, analyticsService_1.trackEvent)(gameId, event);
        res.status(200).json({
            success: true,
            message: 'Event tracked successfully',
        });
    }
    catch (error) {
        console.error('[Analytics] Error in trackEventController:', error);
        res.status(500).json({
            success: false,
            error: 'INTERNAL_ERROR',
            message: 'Failed to track event',
            details: error.message,
        });
    }
});
exports.trackEventController = trackEventController;
/**
 * Track a batch of analytics events
 * POST /api/analytics/events/batch
 */
const trackBatchEventsController = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const gameId = (_a = req.game) === null || _a === void 0 ? void 0 : _a.gameId;
        if (!gameId) {
            res.status(401).json({
                success: false,
                error: 'UNAUTHORIZED',
                message: 'Game context missing',
            });
            return;
        }
        const { events } = req.body;
        if (!Array.isArray(events) || events.length === 0) {
            res.status(400).json({
                success: false,
                error: 'INVALID_REQUEST',
                message: 'events array is required and must not be empty',
            });
            return;
        }
        if (events.length > 100) {
            res.status(400).json({
                success: false,
                error: 'INVALID_REQUEST',
                message: 'Batch size cannot exceed 100 events',
            });
            return;
        }
        const successCount = yield (0, analyticsService_1.trackBatchEvents)(gameId, events);
        res.status(200).json({
            success: true,
            message: 'Batch events tracked',
            tracked: successCount,
            total: events.length,
        });
    }
    catch (error) {
        console.error('[Analytics] Error in trackBatchEventsController:', error);
        res.status(500).json({
            success: false,
            error: 'INTERNAL_ERROR',
            message: 'Failed to track batch events',
            details: error.message,
        });
    }
});
exports.trackBatchEventsController = trackBatchEventsController;
// ============================================
// Developer Query Controllers
// ============================================
/**
 * Get game summary
 * GET /api/analytics/games/:gameId/summary
 */
const getGameSummaryController = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { gameId } = req.params;
        const days = parseInt(req.query.days) || 30;
        if (!gameId) {
            res.status(400).json({
                success: false,
                error: 'INVALID_REQUEST',
                message: 'gameId is required',
            });
            return;
        }
        // Validate days parameter
        if (![7, 30, 90].includes(days)) {
            res.status(400).json({
                success: false,
                error: 'INVALID_REQUEST',
                message: 'days must be 7, 30, or 90',
            });
            return;
        }
        // TODO: Verify user owns this game (session auth)
        // For now, we'll allow any authenticated user to query any game
        // This should be restricted in production
        const summary = yield (0, analyticsService_1.getGameSummary)(gameId, days);
        res.status(200).json(Object.assign({ success: true }, summary));
    }
    catch (error) {
        console.error('[Analytics] Error in getGameSummaryController:', error);
        res.status(500).json({
            success: false,
            error: 'INTERNAL_ERROR',
            message: 'Failed to get game summary',
            details: error.message,
        });
    }
});
exports.getGameSummaryController = getGameSummaryController;
/**
 * Get game trends
 * GET /api/analytics/games/:gameId/trends
 */
const getGameTrendsController = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { gameId } = req.params;
        const days = parseInt(req.query.days) || 30;
        if (!gameId) {
            res.status(400).json({
                success: false,
                error: 'INVALID_REQUEST',
                message: 'gameId is required',
            });
            return;
        }
        const trends = yield (0, analyticsService_1.getGameTrends)(gameId, days);
        res.status(200).json({
            success: true,
            trends,
        });
    }
    catch (error) {
        console.error('[Analytics] Error in getGameTrendsController:', error);
        res.status(500).json({
            success: false,
            error: 'INTERNAL_ERROR',
            message: 'Failed to get game trends',
            details: error.message,
        });
    }
});
exports.getGameTrendsController = getGameTrendsController;
/**
 * Get game errors
 * GET /api/analytics/games/:gameId/errors
 */
const getGameErrorsController = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { gameId } = req.params;
        const days = parseInt(req.query.days) || 7;
        if (!gameId) {
            res.status(400).json({
                success: false,
                error: 'INVALID_REQUEST',
                message: 'gameId is required',
            });
            return;
        }
        const errors = yield (0, analyticsService_1.getGameErrors)(gameId, days);
        res.status(200).json({
            success: true,
            errors,
        });
    }
    catch (error) {
        console.error('[Analytics] Error in getGameErrorsController:', error);
        res.status(500).json({
            success: false,
            error: 'INTERNAL_ERROR',
            message: 'Failed to get game errors',
            details: error.message,
        });
    }
});
exports.getGameErrorsController = getGameErrorsController;
/**
 * Get game SDK versions
 * GET /api/analytics/games/:gameId/versions
 */
const getGameVersionsController = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { gameId } = req.params;
        const days = parseInt(req.query.days) || 30;
        if (!gameId) {
            res.status(400).json({
                success: false,
                error: 'INVALID_REQUEST',
                message: 'gameId is required',
            });
            return;
        }
        const versions = yield (0, analyticsService_1.getGameVersions)(gameId, days);
        res.status(200).json({
            success: true,
            versions,
        });
    }
    catch (error) {
        console.error('[Analytics] Error in getGameVersionsController:', error);
        res.status(500).json({
            success: false,
            error: 'INTERNAL_ERROR',
            message: 'Failed to get game versions',
            details: error.message,
        });
    }
});
exports.getGameVersionsController = getGameVersionsController;
// ============================================
// Admin Query Controllers
// ============================================
/**
 * Get platform summary
 * GET /api/analytics/admin/summary
 */
const getPlatformSummaryController = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const days = parseInt(req.query.days) || 30;
        // Validate days parameter
        if (![7, 30, 90].includes(days)) {
            res.status(400).json({
                success: false,
                error: 'INVALID_REQUEST',
                message: 'days must be 7, 30, or 90',
            });
            return;
        }
        const summary = yield (0, analyticsService_1.getPlatformSummary)(days);
        res.status(200).json(Object.assign({ success: true }, summary));
    }
    catch (error) {
        console.error('[Analytics] Error in getPlatformSummaryController:', error);
        res.status(500).json({
            success: false,
            error: 'INTERNAL_ERROR',
            message: 'Failed to get platform summary',
            details: error.message,
        });
    }
});
exports.getPlatformSummaryController = getPlatformSummaryController;
/**
 * Get platform trends
 * GET /api/analytics/admin/trends
 */
const getPlatformTrendsController = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const days = parseInt(req.query.days) || 30;
        const trends = yield (0, analyticsService_1.getPlatformTrends)(days);
        res.status(200).json({
            success: true,
            trends,
        });
    }
    catch (error) {
        console.error('[Analytics] Error in getPlatformTrendsController:', error);
        res.status(500).json({
            success: false,
            error: 'INTERNAL_ERROR',
            message: 'Failed to get platform trends',
            details: error.message,
        });
    }
});
exports.getPlatformTrendsController = getPlatformTrendsController;
/**
 * Get platform SDK versions
 * GET /api/analytics/admin/versions
 */
const getPlatformVersionsController = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const days = parseInt(req.query.days) || 30;
        const versions = yield (0, analyticsService_1.getPlatformVersions)(days);
        res.status(200).json({
            success: true,
            versions,
        });
    }
    catch (error) {
        console.error('[Analytics] Error in getPlatformVersionsController:', error);
        res.status(500).json({
            success: false,
            error: 'INTERNAL_ERROR',
            message: 'Failed to get platform versions',
            details: error.message,
        });
    }
});
exports.getPlatformVersionsController = getPlatformVersionsController;
/**
 * Get games with issues
 * GET /api/analytics/admin/games/issues
 */
const getGamesWithIssuesController = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const days = parseInt(req.query.days) || 7;
        const minErrorRate = parseFloat(req.query.minErrorRate) || 10;
        const games = yield (0, analyticsService_1.getGamesWithIssues)(days, minErrorRate);
        res.status(200).json({
            success: true,
            games,
        });
    }
    catch (error) {
        console.error('[Analytics] Error in getGamesWithIssuesController:', error);
        res.status(500).json({
            success: false,
            error: 'INTERNAL_ERROR',
            message: 'Failed to get games with issues',
            details: error.message,
        });
    }
});
exports.getGamesWithIssuesController = getGamesWithIssuesController;
/**
 * Get games leaderboard
 * GET /api/analytics/admin/games/leaderboard
 */
const getGamesLeaderboardController = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const days = parseInt(req.query.days) || 30;
        const limit = parseInt(req.query.limit) || 20;
        const games = yield (0, analyticsService_1.getGamesLeaderboard)(days, limit);
        res.status(200).json({
            success: true,
            games,
        });
    }
    catch (error) {
        console.error('[Analytics] Error in getGamesLeaderboardController:', error);
        res.status(500).json({
            success: false,
            error: 'INTERNAL_ERROR',
            message: 'Failed to get games leaderboard',
            details: error.message,
        });
    }
});
exports.getGamesLeaderboardController = getGamesLeaderboardController;
/**
 * Get admin game details (combines summary, trends, errors, versions)
 * GET /api/analytics/admin/games/:gameId
 */
const getAdminGameDetailsController = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { gameId } = req.params;
        const days = parseInt(req.query.days) || 30;
        if (!gameId) {
            res.status(400).json({
                success: false,
                error: 'INVALID_REQUEST',
                message: 'gameId is required',
            });
            return;
        }
        const [summary, trends, errors, versions] = yield Promise.all([
            (0, analyticsService_1.getGameSummary)(gameId, days),
            (0, analyticsService_1.getGameTrends)(gameId, days),
            (0, analyticsService_1.getGameErrors)(gameId, 7), // Always use 7 days for errors
            (0, analyticsService_1.getGameVersions)(gameId, days),
        ]);
        res.status(200).json({
            success: true,
            gameId,
            summary,
            trends,
            errors,
            versions,
        });
    }
    catch (error) {
        console.error('[Analytics] Error in getAdminGameDetailsController:', error);
        res.status(500).json({
            success: false,
            error: 'INTERNAL_ERROR',
            message: 'Failed to get admin game details',
            details: error.message,
        });
    }
});
exports.getAdminGameDetailsController = getAdminGameDetailsController;
//# sourceMappingURL=analyticsController.js.map