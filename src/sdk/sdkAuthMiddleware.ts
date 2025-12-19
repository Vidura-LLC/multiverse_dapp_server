// src/sdk/sdkAuthMiddleware.ts

import { Request, Response, NextFunction } from 'express';
import { ref, get } from 'firebase/database';
import { db } from '../config/firebase';
import crypto from 'crypto';
import { Game } from '../types/game';
import { TokenType } from '../utils/getPDAs';
import { Tournament } from '../gamehub/gamehubController';

interface GameCredentials {
  gameId: string;
  name: string;
  developerId: string;
  createdBy: string;
}

declare global {
  namespace Express {
    interface Request {
      authType?: 'sdk' | 'clerk' | 'publicKey';
      game?: GameCredentials;
      tournament?: Tournament;
    }
  }
}

const hashApiKey = (apiKey: string): string => {
  return crypto.createHash('sha256').update(apiKey).digest('hex');
};

/**
 * Validate game credentials - direct lookup using gameId as Firebase key
 */
const validateGameCredentials = async (
  gameId: string,
  apiKey: string
): Promise<GameCredentials | null> => {
  try {
    const gameRef = ref(db, `games/${gameId}`);
    const snapshot = await get(gameRef);

    if (!snapshot.exists()) {
      console.log(`[SDK Auth] Game not found: ${gameId}`);
      return null;
    }

    const game = snapshot.val() as Game;

    if (!game.sdkEnabled) {
      console.log(`[SDK Auth] SDK access disabled for game: ${gameId}`);
      return null;
    }

    const providedKeyHash = hashApiKey(apiKey);
    if (providedKeyHash !== game.apiKeyHash) {
      console.log(`[SDK Auth] Invalid API key for game: ${gameId}`);
      return null;
    }

    return {
      gameId: game.gameId,
      name: game.name,
      developerId: game.userId,
      createdBy: game.createdBy,
    };
  } catch (error) {
    console.error('[SDK Auth] Error validating game credentials:', error);
    return null;
  }
};

const checkTournamentOwnership = async (
  tournamentId: string,
  tokenType: TokenType,
  gameId: string
): Promise<{ owned: boolean; tournament?: Tournament }> => {
  try {
    const tournamentRef = ref(db, `tournaments/${tokenType}/${tournamentId}`);
    const snapshot = await get(tournamentRef);

    if (!snapshot.exists()) {
      return { owned: false };
    }

    const tournament = snapshot.val() as Tournament;

    return {
      owned: tournament.gameId === gameId,
      tournament,
    };
  } catch (error) {
    console.error('[SDK Auth] Error checking tournament ownership:', error);
    return { owned: false };
  }
};

/**
 * SDK Authentication Middleware
 */
export const sdkAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void | Response> => {
  try {
    const apiKey = req.headers['x-api-key'] as string;
    const gameId = req.headers['x-game-id'] as string;

    if (!apiKey || !gameId) {
      return res.status(401).json({
        success: false,
        error: 'MISSING_CREDENTIALS',
        message: 'Missing SDK credentials: x-api-key and x-game-id headers required',
      });
    }

    if (!apiKey.startsWith('sk_live_') && !apiKey.startsWith('sk_test_')) {
      return res.status(401).json({
        success: false,
        error: 'INVALID_KEY_FORMAT',
        message: 'Invalid API key format',
      });
    }

    const game = await validateGameCredentials(gameId, apiKey);

    if (!game) {
      return res.status(401).json({
        success: false,
        error: 'INVALID_CREDENTIALS',
        message: 'Invalid SDK credentials',
      });
    }

    req.authType = 'sdk';
    req.game = game;

    next();
  } catch (error) {
    console.error('[SDK Auth] Middleware error:', error);
    return res.status(500).json({
      success: false,
      error: 'AUTH_ERROR',
      message: 'Internal server error during authentication',
    });
  }
};

/**
 * Combined Authentication Middleware (SDK or Public Key)
 */
export const sdkOrUserAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void | Response> => {
  const apiKey = req.headers['x-api-key'] as string;
  const gameId = req.headers['x-game-id'] as string;
  const publicKey = req.headers['public-key'] as string;

  if (apiKey && gameId) {
    const game = await validateGameCredentials(gameId, apiKey);

    if (game) {
      req.authType = 'sdk';
      req.game = game;
      return next();
    }

    return res.status(401).json({
      success: false,
      error: 'INVALID_SDK_CREDENTIALS',
      message: 'Invalid SDK credentials',
    });
  }

  if (publicKey) {
    try {
      const { checkUser } = await import('../gamehub/middleware');
      const user = await checkUser(publicKey);

      if (user) {
        req.authType = 'publicKey';
        (req as any).user = user;
        return next();
      }

      return res.status(401).json({
        success: false,
        error: 'INVALID_PUBLIC_KEY',
        message: 'Unauthorized: Public key does not match',
      });
    } catch (error) {
      console.error('[SDK Auth] Error in public key auth:', error);
      return res.status(500).json({
        success: false,
        error: 'AUTH_ERROR',
        message: 'Internal server error during authentication',
      });
    }
  }

  return res.status(401).json({
    success: false,
    error: 'NO_CREDENTIALS',
    message: 'Authentication required: provide SDK credentials (x-api-key, x-game-id) or public-key header',
  });
};

/**
 * Tournament Ownership Verification Middleware
 */
export const verifyTournamentOwnership = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void | Response> => {
  if (req.authType !== 'sdk') {
    return next();
  }

  const { tournamentId, tokenType } = req.body;
  const gameId = req.game?.gameId;

  if (!tournamentId || tokenType === undefined || !gameId) {
    return next();
  }

  try {
    const { owned, tournament } = await checkTournamentOwnership(
      tournamentId,
      Number(tokenType) as TokenType,
      gameId
    );

    if (!tournament) {
      return next();
    }

    if (!owned) {
      return res.status(403).json({
        success: false,
        error: 'TOURNAMENT_NOT_OWNED',
        message: 'Tournament does not belong to this game',
      });
    }

    req.tournament = tournament;
    next();
  } catch (error) {
    console.error('[SDK Auth] Error verifying tournament ownership:', error);
    return res.status(500).json({
      success: false,
      error: 'OWNERSHIP_CHECK_ERROR',
      message: 'Internal server error',
    });
  }
};

/**
 * Optional SDK Auth Middleware
 */
export const optionalSdkAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const apiKey = req.headers['x-api-key'] as string;
  const gameId = req.headers['x-game-id'] as string;

  if (apiKey && gameId) {
    const game = await validateGameCredentials(gameId, apiKey);

    if (game) {
      req.authType = 'sdk';
      req.game = game;
    }
  }

  next();
};

export { validateGameCredentials, hashApiKey, checkTournamentOwnership };