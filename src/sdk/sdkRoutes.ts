// src/sdk/sdkRoutes.ts

import { Router, RequestHandler, Request, Response } from 'express';
import { sdkAuth, verifyTournamentOwnership } from './sdkAuthMiddleware';
import {
  createGameController,
  rotateGameApiKeyController,
  revokeGameSdkAccessController,
  enableGameSdkAccessController,
  getGameSdkStatusController,
} from './sdkCredentialsController';
import {
  registerForTournamentController,
  confirmParticipationController,
  getTournamentById,
  getTournamentLeaderboardController,
  updateParticipantScoreController,
  getTournamentsByGameController,
} from '../gamehub/gamehubController';

const router = Router();

// ============================================
// Game & SDK Credential Management Routes
// ============================================

router.post('/games', createGameController as unknown as RequestHandler);
router.post('/games/:gameId/rotate-key', rotateGameApiKeyController as unknown as RequestHandler);
router.post('/games/:gameId/revoke-sdk', revokeGameSdkAccessController as unknown as RequestHandler);
router.post('/games/:gameId/enable-sdk', enableGameSdkAccessController as unknown as RequestHandler);
router.get('/games/:gameId/sdk-status', getGameSdkStatusController as unknown as RequestHandler);

// ============================================
// SDK-Authenticated Endpoints
// ============================================

router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Multiversed SDK API is running',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

router.post(
  '/verify',
  sdkAuth as unknown as RequestHandler,
  ((req: Request, res: Response) => {
    res.status(200).json({
      success: true,
      message: 'SDK credentials are valid',
      game: {
        gameId: req.game?.gameId,
        name: req.game?.name,
      },
    });
  }) as unknown as RequestHandler
);

router.get(
  '/tournaments',
  sdkAuth as unknown as RequestHandler,
  (async (req: Request, res: Response) => {
    const gameId = req.game?.gameId;
    const { tokenType } = req.query;

    if (!tokenType) {
      return res.status(400).json({
        success: false,
        message: 'tokenType query parameter is required',
      });
    }

    req.params.gameId = gameId!;
    req.params.tokenType = tokenType as string;

    return getTournamentsByGameController(req, res);
  }) as unknown as RequestHandler
);

router.get(
  '/tournaments/:id',
  sdkAuth as unknown as RequestHandler,
  getTournamentById as unknown as RequestHandler
);

router.post(
  '/tournaments/prepare-registration',
  sdkAuth as unknown as RequestHandler,
  verifyTournamentOwnership as unknown as RequestHandler,
  registerForTournamentController as unknown as RequestHandler
);

router.post(
  '/tournaments/confirm-registration',
  sdkAuth as unknown as RequestHandler,
  verifyTournamentOwnership as unknown as RequestHandler,
  confirmParticipationController as unknown as RequestHandler
);

router.get(
  '/tournaments/:id/leaderboard',
  sdkAuth as unknown as RequestHandler,
  getTournamentLeaderboardController as unknown as RequestHandler
);

router.post(
  '/tournaments/:id/score',
  sdkAuth as unknown as RequestHandler,
  verifyTournamentOwnership as unknown as RequestHandler,
  updateParticipantScoreController as unknown as RequestHandler
);

export default router;