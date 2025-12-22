"use strict";
// src/utils/sdkCredentialsHelper.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateSdkCredentials = exports.getApiKeyPrefix = exports.hashApiKey = exports.generateApiKey = void 0;
const crypto_1 = __importDefault(require("crypto"));
/**
 * Generate a secure API key
 * Format: sk_live_<48 random hex characters>
 */
const generateApiKey = (environment = 'live') => {
    const prefix = environment === 'live' ? 'sk_live_' : 'sk_test_';
    return `${prefix}${crypto_1.default.randomBytes(24).toString('hex')}`;
};
exports.generateApiKey = generateApiKey;
/**
 * Hash API key using SHA-256
 */
const hashApiKey = (apiKey) => {
    return crypto_1.default.createHash('sha256').update(apiKey).digest('hex');
};
exports.hashApiKey = hashApiKey;
/**
 * Extract prefix from API key for display purposes
 * Shows first 16 characters: sk_live_xxxxxxxx
 */
const getApiKeyPrefix = (apiKey) => {
    return apiKey.substring(0, 16);
};
exports.getApiKeyPrefix = getApiKeyPrefix;
/**
 * Generate SDK credentials
 * gameId is client-provided, only generates apiKey and hash
 */
const generateSdkCredentials = (gameId) => {
    const apiKey = (0, exports.generateApiKey)('live');
    const apiKeyHash = (0, exports.hashApiKey)(apiKey);
    const apiKeyPrefix = (0, exports.getApiKeyPrefix)(apiKey);
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
exports.generateSdkCredentials = generateSdkCredentials;
//# sourceMappingURL=sdkCredentialsHelper.js.map