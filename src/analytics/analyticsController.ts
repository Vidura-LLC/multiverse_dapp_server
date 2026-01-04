// src/analytics/analyticsController.ts

import { Request, Response } from 'express';
import {
  trackEvent,
  trackBatchEvents,
  getGameSummary,
  getGameTrends,
  getGameErrors,
  getGameVersions,
  getPlatformSummary,
  getPlatformTrends,
  getPlatformVersions,
  getGamesLeaderboard,
  getGamesWithIssues,
  AnalyticsEvent,
} from './analyticsService';
import { db } from '../config/firebase';
import { ref, get } from 'firebase/database';
import { checkUser } from '../gamehub/middleware';

// ============================================
// Helper Functions
// ============================================

/**
 * Helper function to verify that a user owns a specific game
 * @param gameId - The game ID to check
 * @param publicKey - The user's public key
 * @returns true if user owns the game or is admin, false otherwise
 */
async function verifyGameOwnership(gameId: string, publicKey: string): Promise<{ authorized: boolean; isAdmin: boolean; message?: string }> {
  try {
    // Check if user is admin
    const user = await checkUser(publicKey);
    const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

    // Admins can access all game analytics
    if (isAdmin) {
      return { authorized: true, isAdmin: true };
    }

    // Get the game from Firebase
    const gameRef = ref(db, `games/${gameId}`);
    const gameSnapshot = await get(gameRef);

    if (!gameSnapshot.exists()) {
      return { authorized: false, isAdmin: false, message: 'Game not found' };
    }

    const game = gameSnapshot.val();

    // Check if user owns the game
    if (game.createdBy !== publicKey) {
      return { authorized: false, isAdmin: false, message: 'You do not have access to this game\'s analytics' };
    }

    return { authorized: true, isAdmin: false };
  } catch (error: any) {
    console.error('[Analytics] Error verifying game ownership:', error);
    return { authorized: false, isAdmin: false, message: 'Failed to verify game ownership' };
  }
}

// ============================================
// SDK Event Tracking Controllers
// ============================================

/**
 * Track a single analytics event
 * POST /api/analytics/events
 */
export const trackEventController = async (req: Request, res: Response): Promise<void> => {
  try {
    const gameId = req.game?.gameId;
    if (!gameId) {
      res.status(401).json({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Game context missing',
      });
      return;
    }

    const event: AnalyticsEvent = req.body;
    if (!event.eventName) {
      res.status(400).json({
        success: false,
        error: 'INVALID_REQUEST',
        message: 'eventName is required',
      });
      return;
    }

    await trackEvent(gameId, event);

    res.status(200).json({
      success: true,
      message: 'Event tracked successfully',
    });
  } catch (error: any) {
    console.error('[Analytics] Error in trackEventController:', error);
    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Failed to track event',
      details: error.message,
    });
  }
};

/**
 * Track a batch of analytics events
 * POST /api/analytics/events/batch
 */
export const trackBatchEventsController = async (req: Request, res: Response): Promise<void> => {
  try {
    const gameId = req.game?.gameId;
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

    const successCount = await trackBatchEvents(gameId, events);

    res.status(200).json({
      success: true,
      message: 'Batch events tracked',
      tracked: successCount,
      total: events.length,
    });
  } catch (error: any) {
    console.error('[Analytics] Error in trackBatchEventsController:', error);
    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Failed to track batch events',
      details: error.message,
    });
  }
};

// ============================================
// Developer Query Controllers
// ============================================

/**
 * Get game summary
 * GET /api/analytics/games/:gameId/summary
 */
export const getGameSummaryController = async (req: Request, res: Response): Promise<void> => {
  try {
    const { gameId } = req.params;
    const days = parseInt(req.query.days as string) || 30;
    const publicKey = req.headers['public-key'] as string;

    if (!gameId) {
      res.status(400).json({
        success: false,
        error: 'INVALID_REQUEST',
        message: 'gameId is required',
      });
      return;
    }

    if (!publicKey) {
      res.status(401).json({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Public key is required for authentication',
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

    // Verify user owns this game or is admin
    const verification = await verifyGameOwnership(gameId, publicKey);
    if (!verification.authorized) {
      res.status(403).json({
        success: false,
        error: 'FORBIDDEN',
        message: verification.message || 'Access denied',
      });
      return;
    }

    const summary = await getGameSummary(gameId, days);

    res.status(200).json({
      success: true,
      ...summary,
    });
  } catch (error: any) {
    console.error('[Analytics] Error in getGameSummaryController:', error);
    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Failed to get game summary',
      details: error.message,
    });
  }
};

/**
 * Get game trends
 * GET /api/analytics/games/:gameId/trends
 */
export const getGameTrendsController = async (req: Request, res: Response): Promise<void> => {
  try {
    const { gameId } = req.params;
    const days = parseInt(req.query.days as string) || 30;
    const publicKey = req.headers['public-key'] as string;

    if (!gameId) {
      res.status(400).json({
        success: false,
        error: 'INVALID_REQUEST',
        message: 'gameId is required',
      });
      return;
    }

    if (!publicKey) {
      res.status(401).json({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Public key is required for authentication',
      });
      return;
    }

    // Verify user owns this game or is admin
    const verification = await verifyGameOwnership(gameId, publicKey);
    if (!verification.authorized) {
      res.status(403).json({
        success: false,
        error: 'FORBIDDEN',
        message: verification.message || 'Access denied',
      });
      return;
    }

    const trends = await getGameTrends(gameId, days);

    res.status(200).json({
      success: true,
      trends,
    });
  } catch (error: any) {
    console.error('[Analytics] Error in getGameTrendsController:', error);
    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Failed to get game trends',
      details: error.message,
    });
  }
};

/**
 * Get game errors
 * GET /api/analytics/games/:gameId/errors
 */
export const getGameErrorsController = async (req: Request, res: Response): Promise<void> => {
  try {
    const { gameId } = req.params;
    const days = parseInt(req.query.days as string) || 7;
    const publicKey = req.headers['public-key'] as string;

    if (!gameId) {
      res.status(400).json({
        success: false,
        error: 'INVALID_REQUEST',
        message: 'gameId is required',
      });
      return;
    }

    if (!publicKey) {
      res.status(401).json({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Public key is required for authentication',
      });
      return;
    }

    // Verify user owns this game or is admin
    const verification = await verifyGameOwnership(gameId, publicKey);
    if (!verification.authorized) {
      res.status(403).json({
        success: false,
        error: 'FORBIDDEN',
        message: verification.message || 'Access denied',
      });
      return;
    }

    const errors = await getGameErrors(gameId, days);

    res.status(200).json({
      success: true,
      errors,
    });
  } catch (error: any) {
    console.error('[Analytics] Error in getGameErrorsController:', error);
    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Failed to get game errors',
      details: error.message,
    });
  }
};

/**
 * Get game SDK versions
 * GET /api/analytics/games/:gameId/versions
 */
export const getGameVersionsController = async (req: Request, res: Response): Promise<void> => {
  try {
    const { gameId } = req.params;
    const days = parseInt(req.query.days as string) || 30;
    const publicKey = req.headers['public-key'] as string;

    if (!gameId) {
      res.status(400).json({
        success: false,
        error: 'INVALID_REQUEST',
        message: 'gameId is required',
      });
      return;
    }

    if (!publicKey) {
      res.status(401).json({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Public key is required for authentication',
      });
      return;
    }

    // Verify user owns this game or is admin
    const verification = await verifyGameOwnership(gameId, publicKey);
    if (!verification.authorized) {
      res.status(403).json({
        success: false,
        error: 'FORBIDDEN',
        message: verification.message || 'Access denied',
      });
      return;
    }

    const versions = await getGameVersions(gameId, days);

    res.status(200).json({
      success: true,
      versions,
    });
  } catch (error: any) {
    console.error('[Analytics] Error in getGameVersionsController:', error);
    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Failed to get game versions',
      details: error.message,
    });
  }
};

// ============================================
// Admin Query Controllers
// ============================================

/**
 * Get platform summary
 * GET /api/analytics/admin/summary
 */
export const getPlatformSummaryController = async (req: Request, res: Response): Promise<void> => {
  try {
    const days = parseInt(req.query.days as string) || 30;

    // Validate days parameter
    if (![7, 30, 90].includes(days)) {
      res.status(400).json({
        success: false,
        error: 'INVALID_REQUEST',
        message: 'days must be 7, 30, or 90',
      });
      return;
    }

    const summary = await getPlatformSummary(days);

    res.status(200).json({
      success: true,
      ...summary,
    });
  } catch (error: any) {
    console.error('[Analytics] Error in getPlatformSummaryController:', error);
    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Failed to get platform summary',
      details: error.message,
    });
  }
};

/**
 * Get platform trends
 * GET /api/analytics/admin/trends
 */
export const getPlatformTrendsController = async (req: Request, res: Response): Promise<void> => {
  try {
    const days = parseInt(req.query.days as string) || 30;

    const trends = await getPlatformTrends(days);

    res.status(200).json({
      success: true,
      trends,
    });
  } catch (error: any) {
    console.error('[Analytics] Error in getPlatformTrendsController:', error);
    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Failed to get platform trends',
      details: error.message,
    });
  }
};

/**
 * Get platform SDK versions
 * GET /api/analytics/admin/versions
 */
export const getPlatformVersionsController = async (req: Request, res: Response): Promise<void> => {
  try {
    const days = parseInt(req.query.days as string) || 30;

    const versions = await getPlatformVersions(days);

    res.status(200).json({
      success: true,
      versions,
    });
  } catch (error: any) {
    console.error('[Analytics] Error in getPlatformVersionsController:', error);
    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Failed to get platform versions',
      details: error.message,
    });
  }
};

/**
 * Get games with issues
 * GET /api/analytics/admin/games/issues
 */
export const getGamesWithIssuesController = async (req: Request, res: Response): Promise<void> => {
  try {
    const days = parseInt(req.query.days as string) || 7;
    const minErrorRate = parseFloat(req.query.minErrorRate as string) || 10;

    const games = await getGamesWithIssues(days, minErrorRate);

    res.status(200).json({
      success: true,
      games,
    });
  } catch (error: any) {
    console.error('[Analytics] Error in getGamesWithIssuesController:', error);
    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Failed to get games with issues',
      details: error.message,
    });
  }
};

/**
 * Get games leaderboard
 * GET /api/analytics/admin/games/leaderboard
 */
export const getGamesLeaderboardController = async (req: Request, res: Response): Promise<void> => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const limit = parseInt(req.query.limit as string) || 20;

    const games = await getGamesLeaderboard(days, limit);

    res.status(200).json({
      success: true,
      games,
    });
  } catch (error: any) {
    console.error('[Analytics] Error in getGamesLeaderboardController:', error);
    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Failed to get games leaderboard',
      details: error.message,
    });
  }
};

/**
 * Get admin game details (combines summary, trends, errors, versions)
 * GET /api/analytics/admin/games/:gameId
 */
export const getAdminGameDetailsController = async (req: Request, res: Response): Promise<void> => {
  try {
    const { gameId } = req.params;
    const days = parseInt(req.query.days as string) || 30;

    if (!gameId) {
      res.status(400).json({
        success: false,
        error: 'INVALID_REQUEST',
        message: 'gameId is required',
      });
      return;
    }

    const [summary, trends, errors, versions] = await Promise.all([
      getGameSummary(gameId, days),
      getGameTrends(gameId, days),
      getGameErrors(gameId, 7), // Always use 7 days for errors
      getGameVersions(gameId, days),
    ]);

    res.status(200).json({
      success: true,
      gameId,
      summary,
      trends,
      errors,
      versions,
    });
  } catch (error: any) {
    console.error('[Analytics] Error in getAdminGameDetailsController:', error);
    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Failed to get admin game details',
      details: error.message,
    });
  }
};

