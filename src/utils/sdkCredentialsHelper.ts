// src/utils/sdkCredentialsHelper.ts

import crypto from 'crypto';
import { CredentialData } from '../types/sdkCredentials';

/**
 * Generate a secure API key
 * Format: sk_live_<48 random hex characters>
 */
export const generateApiKey = (environment: 'live' | 'test' = 'live'): string => {
  const prefix = environment === 'live' ? 'sk_live_' : 'sk_test_';
  return `${prefix}${crypto.randomBytes(24).toString('hex')}`;
};

/**
 * Hash API key using SHA-256
 */
export const hashApiKey = (apiKey: string): string => {
  return crypto.createHash('sha256').update(apiKey).digest('hex');
};

/**
 * Extract prefix from API key for display purposes
 * Shows first 16 characters: sk_live_xxxxxxxx
 */
export const getApiKeyPrefix = (apiKey: string): string => {
  return apiKey.substring(0, 16);
};

/**
 * Generate SDK credentials
 * gameId is client-provided, only generates apiKey and hash
 */
export const generateSdkCredentials = (gameId: string): {
  apiKey: string;
  credentialData: CredentialData;
} => {
  const apiKey = generateApiKey('live');
  const apiKeyHash = hashApiKey(apiKey);
  const apiKeyPrefix = getApiKeyPrefix(apiKey);

  return {
    apiKey,
    credentialData: {
      gameId,
      apiKeyHash,
      apiKeyPrefix,
      sdkEnabled: true,
    },
  };
};