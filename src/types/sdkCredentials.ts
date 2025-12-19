// src/types/sdkCredentials.ts

import { TGameStatus } from "./game";

export interface GeneratedCredentials {
  gameId: string;
  apiKey: string;
  apiKeyPrefix: string;
  warning: string;
}

export interface CredentialData {
  gameId: string;
  apiKeyHash: string;
  apiKeyPrefix: string;
  sdkEnabled: boolean;
}

export interface CreateGameParams {
  gameId: string;              // Client-provided, used everywhere
  name: string;
  description: string;
  userId: string;
  adminPublicKey: string;
  image?: string;
  status?: TGameStatus;
}