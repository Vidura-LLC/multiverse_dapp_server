// src/sdk/sdkCredentialsController.ts

import { Request, Response } from 'express';
import {
  createGameWithCredentials,
  rotateApiKey,
  revokeSdkAccess,
  enableSdkAccess,
  getSdkStatus,
} from './sdkCredentials';

/**
 * @route   POST /api/games
 * @desc    Create a new game with SDK credentials
 * @access  Authenticated (Clerk/PublicKey)
 */
export const createGameController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { gameId, name, description, userId, adminPublicKey, image, status } = req.body;

    // Validate required fields
    if (!gameId || !name || !description || !userId || !adminPublicKey) {
      res.status(400).json({
        success: false,
        message: 'Missing required fields: gameId, name, description, userId, adminPublicKey',
      });
      return;
    }

    // Validate status if provided
    if (status && !['draft', 'published'].includes(status)) {
      res.status(400).json({
        success: false,
        message: 'Invalid status. Must be one of: draft, published',
      });
      return;
    }

    // Create game with SDK credentials
    const { gameId: createdGameId, credentials } = await createGameWithCredentials({
      gameId: gameId,
      name: name,
      description: description,
      userId: userId,
      adminPublicKey: adminPublicKey,
      image: image,
      status: status,
    });

    res.status(201).json({
      success: true,
      message: 'Game created successfully',
      game: {
        id: createdGameId,  // Include id for backward compatibility
        gameId: createdGameId,
        name,
        description,
        status: status || 'draft',
        createdAt: new Date().toISOString(),
      },
      // SDK credentials - ONLY TIME API KEY IS VISIBLE
      sdkCredentials: credentials,
    });
  } catch (error: any) {
    console.error('Error creating game:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error',
    });
  }
};

/**
 * @route   POST /api/games/:id/rotate-key
 * @desc    Rotate API key for a game
 * @access  Authenticated (Game Owner)
 */
export const rotateGameApiKeyController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { gameId } = req.params;
    const { adminPublicKey } = req.body;

    if (!gameId) {
      res.status(400).json({
        success: false,
        message: 'Missing game id in URL params',
      });
      return;
    }

    if (!adminPublicKey) {
      res.status(400).json({
        success: false,
        message: 'Missing adminPublicKey in request body',
      });
      return;
    }

    const credentials = await rotateApiKey(gameId, adminPublicKey);

    res.status(200).json({
      success: true,
      message: 'API key rotated successfully',
      // New credentials - ONLY TIME NEW KEY IS VISIBLE
      sdkCredentials: credentials,
    });
  } catch (error: any) {
    console.error('Error rotating API key:', error);

    if (error.message === 'Game not found') {
      res.status(404).json({
        success: false,
        message: 'Game not found',
      });
      return;
    }

    if (error.message === 'Not authorized to rotate keys for this game') {
      res.status(403).json({
        success: false,
        message: 'Not authorized to rotate keys for this game',
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error',
    });
  }
};

/**
 * @route   POST /api/games/:id/revoke-sdk
 * @desc    Revoke SDK access for a game
 * @access  Authenticated (Game Owner)
 */
export const revokeGameSdkAccessController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { gameId } = req.params;
    const { adminPublicKey } = req.body;

    if (!gameId) {
      res.status(400).json({
        success: false,
        message: 'Missing game id in URL params',
      });
      return;
    }

    if (!adminPublicKey) {
      res.status(400).json({
        success: false,
        message: 'Missing adminPublicKey in request body',
      });
      return;
    }

    await revokeSdkAccess(gameId, adminPublicKey);

    res.status(200).json({
      success: true,
      message: 'SDK access revoked successfully',
      gameId,
    });
  } catch (error: any) {
    console.error('Error revoking SDK access:', error);

    if (error.message === 'Game not found') {
      res.status(404).json({
        success: false,
        message: 'Game not found',
      });
      return;
    }

    if (error.message === 'Not authorized') {
      res.status(403).json({
        success: false,
        message: 'Not authorized',
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error',
    });
  }
};

/**
 * @route   POST /api/games/:id/enable-sdk
 * @desc    Re-enable SDK access for a game (generates new key)
 * @access  Authenticated (Game Owner)
 */
export const enableGameSdkAccessController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { gameId } = req.params;
    const { adminPublicKey } = req.body;

    if (!gameId) {
      res.status(400).json({
        success: false,
        message: 'Missing game id in URL params',
      });
      return;
    }

    if (!adminPublicKey) {
      res.status(400).json({
        success: false,
        message: 'Missing adminPublicKey in request body',
      });
      return;
    }

    const credentials = await enableSdkAccess(gameId, adminPublicKey);

    res.status(200).json({
      success: true,
      message: 'SDK access enabled successfully',
      // New credentials - ONLY TIME NEW KEY IS VISIBLE
      sdkCredentials: credentials,
    });
  } catch (error: any) {
    console.error('Error enabling SDK access:', error);

    if (error.message === 'Game not found') {
      res.status(404).json({
        success: false,
        message: 'Game not found',
      });
      return;
    }

    if (error.message === 'Not authorized') {
      res.status(403).json({
        success: false,
        message: 'Not authorized',
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error',
    });
  }
};

/**
 * @route   GET /api/games/:id/sdk-status
 * @desc    Get SDK status for a game (does not reveal API key)
 * @access  Authenticated (Game Owner)
 */
export const getGameSdkStatusController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { gameId } = req.params;
    const { adminPublicKey } = req.query;

    if (!gameId) {
      res.status(400).json({
        success: false,
        message: 'Missing game id in URL params',
      });
      return;
    }

    if (!adminPublicKey || typeof adminPublicKey !== 'string') {
      res.status(400).json({
        success: false,
        message: 'Missing adminPublicKey query parameter',
      });
      return;
    }

    const status = await getSdkStatus(gameId, adminPublicKey);

    res.status(200).json({
      success: true,
      ...status,
    });
  } catch (error: any) {
    console.error('Error getting SDK status:', error);

    if (error.message === 'Game not found') {
      res.status(404).json({
        success: false,
        message: 'Game not found',
      });
      return;
    }

    if (error.message === 'Not authorized') {
      res.status(403).json({
        success: false,
        message: 'Not authorized',
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error',
    });
  }
};