// src/analytics/analyticsMiddleware.ts

import { Request, Response, NextFunction } from 'express';
import { ref, get } from 'firebase/database';
import { db } from '../config/firebase';
import { checkUser } from '../gamehub/middleware';

/**
 * Middleware to verify user owns the game (for developer endpoints)
 * Checks if the authenticated user's userId matches the game's userId
 */
export const requireGameOwnership = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void | Response> => {
  try {
    const { gameId } = req.params;
    const publicKey = req.headers['public-key'] as string;

    if (!publicKey) {
      return res.status(401).json({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Authentication required: public-key header missing',
      });
    }

    // Get game from Firebase first
    const gameRef = ref(db, `games/${gameId}`);
    const gameSnapshot = await get(gameRef);

    if (!gameSnapshot.exists()) {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: 'Game not found',
      });
    }

    const game = gameSnapshot.val();

    // Check if user owns the game by checking createdBy first (most reliable)
    // This allows access even if user doesn't exist in users table yet
    if (game.createdBy === publicKey) {
      // User owns the game, proceed
      // Try to get user data, but don't fail if it doesn't exist
      const user = await checkUser(publicKey);
      (req as any).gameData = game;
      (req as any).user = user || { id: null, publicKey };
      return next();
    }

    // If createdBy doesn't match, check user in database and userId
    const user = await checkUser(publicKey);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Invalid user or you do not have access to this game',
      });
    }

    // Check if user owns the game via userId
    // Note: userId in game might be Clerk user ID, while user.id might be different
    const ownsGame = game.userId === user.id || game.createdBy === publicKey;

    if (!ownsGame) {
      return res.status(403).json({
        success: false,
        error: 'FORBIDDEN',
        message: 'You do not have access to this game',
      });
    }

    // Attach game to request for use in controllers
    (req as any).gameData = game;
    (req as any).user = user;

    next();
  } catch (error) {
    console.error('[Analytics] Error in requireGameOwnership:', error);
    return res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Internal server error during authentication',
    });
  }
};

/**
 * Middleware to verify admin access
 * Checks if user is admin based on public key or role
 */
export const requireAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void | Response> => {
  try {
    const publicKey = req.headers['public-key'] as string;

    if (!publicKey) {
      return res.status(401).json({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Authentication required: public-key header missing',
      });
    }

    // Check user role from database
    const user = await checkUser(publicKey);
    if (user && (user.role === 'admin' || user.role === 'super_admin')) {
      return next();
    }

    return res.status(403).json({
      success: false,
      error: 'FORBIDDEN',
      message: 'Admin access required',
    });
  } catch (error) {
    console.error('[Analytics] Error in requireAdmin:', error);
    return res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Internal server error during authentication',
    });
  }
};

