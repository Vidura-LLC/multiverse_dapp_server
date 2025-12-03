// src/types/game.ts

export type TGameStatus = "draft" | "published";

export type TGameCreate = {
    gameId: string;
    name: string;
    description: string;
    image: File | null;
    status: TGameStatus;
    createdBy: string;
}

export type Game = {
    id: string;              // Same as gameId
    gameId: string;          // Client-provided, used everywhere (SDK, Firebase, tournaments)
    userId: string;
    name: string;
    description: string;
    image: string;
    createdAt: Date;
    updatedAt: Date;
    status: TGameStatus;
    createdBy: string;

    // SDK credentials
    apiKeyHash: string;
    apiKeyPrefix: string;
    sdkEnabled: boolean;

    apiKeyRotatedAt?: string;
    sdkRevokedAt?: string;
    sdkEnabledAt?: string;
}

export type GameCreateResponse = {
    game: {
        gameId: string;
        name: string;
        description: string;
        createdAt: string;
        status: TGameStatus;
    };
    sdkCredentials: {
        gameId: string;
        apiKey: string;
        apiKeyPrefix: string;
        warning: string;
    };
}

export type GameSdkStatus = {
    gameId: string;
    sdkEnabled: boolean;
    apiKeyPrefix: string | null;
    apiKeyRotatedAt: string | null;
    createdAt: string;
}