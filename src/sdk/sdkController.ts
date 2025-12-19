// src/sdk/sdkController.ts

import { Request, Response } from 'express';
import { TokenType } from '../utils/getPDAs';
import { submitScore } from './scoreService';

export const submitScoreController = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tournamentId } = req.params;
    const { userPublicKey, score, tokenType } = req.body ?? {};
    const gameId = req.game?.gameId;

    // Basic request validation
    if (!tournamentId || !userPublicKey || tokenType === undefined || tokenType === null || score === undefined) {
      res.status(400).json({
        success: false,
        message: 'Missing required fields',
      });
      return;
    }

    if (typeof userPublicKey !== 'string' || userPublicKey.trim().length === 0) {
      res.status(400).json({
        success: false,
        message: 'userPublicKey must be a non-empty string',
      });
      return;
    }

    const numericScore = Number(score);
    if (Number.isNaN(numericScore) || numericScore < 0) {
      res.status(400).json({
        success: false,
        message: 'Score must be a non-negative number',
      });
      return;
    }

    const tt = Number(tokenType);
    if (tt !== TokenType.SPL && tt !== TokenType.SOL) {
      res.status(400).json({
        success: false,
        message: 'tokenType must be 0 (SPL) or 1 (SOL)',
      });
      return;
    }

    if (!gameId) {
      // This should not happen if sdkAuth middleware ran correctly
      res.status(401).json({
        success: false,
        message: 'Unauthorized: game context missing',
      });
      return;
    }

    const result = await submitScore({
      tournamentId,
      userPublicKey,
      score: numericScore,
      tokenType: tt as TokenType,
      gameId,
    });

    if (result.success) {
      res.status(200).json(result);
      return;
    }

    // Map business errors to HTTP status codes
    switch (result.errorCode) {
      case 'INVALID_SCORE':
        res.status(400).json(result);
        return;
      case 'INVALID_TOKEN_TYPE':
        res.status(400).json(result);
        return;
      case 'ALREADY_PLAYED':
        res.status(400).json({
          success: false,
          message: 'You have already submitted a score for this tournament',
        });
        return;
      case 'TOURNAMENT_NOT_ACTIVE':
        res.status(400).json(result);
        return;
      case 'NOT_REGISTERED':
        res.status(403).json(result);
        return;
      case 'WRONG_GAME':
        res.status(403).json(result);
        return;
      case 'TOURNAMENT_NOT_FOUND':
        res.status(404).json(result);
        return;
      default:
        res.status(500).json({
          success: false,
          message: 'Internal server error',
        });
        return;
    }
  } catch (error) {
    console.error('[SDK] submitScoreController error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};


