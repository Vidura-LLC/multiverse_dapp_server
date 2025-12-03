// src/sdk/sdkCredentials.ts

import { ref, set, get, update } from 'firebase/database';
import { db } from '../config/firebase';
import { Game, GameSdkStatus } from '../types/game';
import { CreateGameParams, GeneratedCredentials } from '../types/sdkCredentials';
import { generateSdkCredentials, generateApiKey, hashApiKey, getApiKeyPrefix } from '../utils/sdkCredentialsHelper';

/**
 * Create a new game with SDK credentials
 * Single gameId approach: Client provides `gameId`, used for everything
 */
export const createGameWithCredentials = async (
  gameData: CreateGameParams
): Promise<{ gameId: string; credentials: GeneratedCredentials }> => {
  const { apiKey, credentialData } = generateSdkCredentials(gameData.gameId);

  const now = new Date().toISOString();
  
  const game: Game = {
    id: gameData.gameId,
    gameId: gameData.gameId,
    name: gameData.name,
    description: gameData.description,
    userId: gameData.userId,
    createdBy: gameData.adminPublicKey,
    image: gameData.image || '',
    status: gameData.status || 'draft',
    createdAt: new Date(now), // Store as Date object for type compatibility, but Firebase will serialize it
    updatedAt: new Date(now),
    apiKeyHash: credentialData.apiKeyHash,
    apiKeyPrefix: credentialData.apiKeyPrefix,
    sdkEnabled: credentialData.sdkEnabled,
  };
  
  // Convert Date objects to ISO strings for Firebase storage
  const gameForFirebase = {
    ...game,
    createdAt: now,
    updatedAt: now,
  };

  const gameRef = ref(db, `games/${gameData.gameId}`);
  await set(gameRef, gameForFirebase);

  return {
    gameId: gameData.gameId,
    credentials: {
      gameId: gameData.gameId,
      apiKey,
      apiKeyPrefix: credentialData.apiKeyPrefix,
      warning: 'Store your API key securely. It cannot be retrieved later.',
    },
  };
};

/**
 * Rotate API key for an existing game
 */
export const rotateApiKey = async (
  gameId: string,
  adminPublicKey: string
): Promise<GeneratedCredentials> => {
  const gameRef = ref(db, `games/${gameId}`);
  const snapshot = await get(gameRef);

  if (!snapshot.exists()) {
    throw new Error('Game not found');
  }

  const game = snapshot.val() as Game;

  if (game.createdBy !== adminPublicKey) {
    throw new Error('Not authorized to rotate keys for this game');
  }

  const newApiKey = generateApiKey('live');
  const newApiKeyHash = hashApiKey(newApiKey);
  const newApiKeyPrefix = getApiKeyPrefix(newApiKey);

  await update(gameRef, {
    apiKeyHash: newApiKeyHash,
    apiKeyPrefix: newApiKeyPrefix,
    apiKeyRotatedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  return {
    gameId: game.gameId,
    apiKey: newApiKey,
    apiKeyPrefix: newApiKeyPrefix,
    warning: 'Store your API key securely. It cannot be retrieved later.',
  };
};

/**
 * Revoke SDK access for a game
 */
export const revokeSdkAccess = async (
  gameId: string,
  adminPublicKey: string
): Promise<void> => {
  const gameRef = ref(db, `games/${gameId}`);
  const snapshot = await get(gameRef);

  if (!snapshot.exists()) {
    throw new Error('Game not found');
  }

  const game = snapshot.val() as Game;

  if (game.createdBy !== adminPublicKey) {
    throw new Error('Not authorized');
  }

  await update(gameRef, {
    sdkEnabled: false,
    sdkRevokedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
};

/**
 * Re-enable SDK access with new credentials
 */
export const enableSdkAccess = async (
  gameId: string,
  adminPublicKey: string
): Promise<GeneratedCredentials> => {
  const gameRef = ref(db, `games/${gameId}`);
  const snapshot = await get(gameRef);

  if (!snapshot.exists()) {
    throw new Error('Game not found');
  }

  const game = snapshot.val() as Game;

  if (game.createdBy !== adminPublicKey) {
    throw new Error('Not authorized');
  }

  const newApiKey = generateApiKey('live');
  const newApiKeyHash = hashApiKey(newApiKey);
  const newApiKeyPrefix = getApiKeyPrefix(newApiKey);

  await update(gameRef, {
    apiKeyHash: newApiKeyHash,
    apiKeyPrefix: newApiKeyPrefix,
    sdkEnabled: true,
    sdkEnabledAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  return {
    gameId: game.gameId,
    apiKey: newApiKey,
    apiKeyPrefix: newApiKeyPrefix,
    warning: 'Store your API key securely. It cannot be retrieved later.',
  };
};

/**
 * Get SDK status for a game
 */
export const getSdkStatus = async (
  gameId: string,
  adminPublicKey: string
): Promise<GameSdkStatus> => {
  const gameRef = ref(db, `games/${gameId}`);
  const snapshot = await get(gameRef);

  if (!snapshot.exists()) {
    throw new Error('Game not found');
  }

  const game = snapshot.val() as Game;

  if (game.createdBy !== adminPublicKey) {
    throw new Error('Not authorized');
  }

  // Handle createdAt - Firebase might store it as Date, timestamp, or undefined
  let createdAt: string | null = null;
  if (game.createdAt) {
    if (game.createdAt instanceof Date) {
      createdAt = game.createdAt.toISOString();
    } else if (typeof game.createdAt === 'string') {
      // If it's already a string, validate it's a valid date
      const date = new Date(game.createdAt);
      createdAt = isNaN(date.getTime()) ? null : date.toISOString();
    } else if (typeof game.createdAt === 'number') {
      // If it's a timestamp
      createdAt = new Date(game.createdAt).toISOString();
    }
  }

  return {
    gameId: game.gameId,
    sdkEnabled: game.sdkEnabled ?? false,
    apiKeyPrefix: game.apiKeyPrefix ?? null,
    apiKeyRotatedAt: game.apiKeyRotatedAt ?? null,
    createdAt: createdAt ?? null, // Return null if createdAt is not available
  };
};

/**
 * Verify API key for a game
 */
export const verifyApiKey = async (
  gameId: string,
  apiKey: string
): Promise<boolean> => {
  const gameRef = ref(db, `games/${gameId}`);
  const snapshot = await get(gameRef);

  if (!snapshot.exists()) {
    return false;
  }

  const game = snapshot.val() as Game;

  if (!game.sdkEnabled) {
    return false;
  }

  const providedKeyHash = hashApiKey(apiKey);
  return providedKeyHash === game.apiKeyHash;
};

/**
 * Get game by gameId
 */
export const getGameById = async (gameId: string): Promise<Game | null> => {
  const gameRef = ref(db, `games/${gameId}`);
  const snapshot = await get(gameRef);

  if (!snapshot.exists()) {
    return null;
  }

  return snapshot.val() as Game;
};