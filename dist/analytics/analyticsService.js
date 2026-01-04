"use strict";
// src/analytics/analyticsService.ts
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.trackEvent = trackEvent;
exports.trackBatchEvents = trackBatchEvents;
exports.getGameSummary = getGameSummary;
exports.getGameTrends = getGameTrends;
exports.getGameErrors = getGameErrors;
exports.getGameVersions = getGameVersions;
exports.getPlatformSummary = getPlatformSummary;
exports.getPlatformTrends = getPlatformTrends;
exports.getPlatformVersions = getPlatformVersions;
exports.getGamesLeaderboard = getGamesLeaderboard;
exports.getGamesWithIssues = getGamesWithIssues;
const database_1 = require("firebase/database");
const firebase_1 = require("../config/firebase");
const crypto = __importStar(require("crypto"));
// ============================================
// Event to Stat Mapping
// ============================================
const EVENT_TO_STAT_MAP = {
    'sdk_initialized': 'initializations',
    'sdk_init_failed': 'initFailures',
    'wallet_connected': 'walletConnections',
    'wallet_connect_failed': 'walletFailures',
    'tournament_registered': 'registrations',
    'registration_failed': 'registrationFailures',
    'score_submitted': 'scoreSubmissions',
    'score_submit_failed': 'scoreFailures',
};
// ============================================
// Helper Functions
// ============================================
/**
 * Get ISO date string (YYYY-MM-DD) from timestamp
 */
function getDateString(timestamp) {
    const date = timestamp ? new Date(timestamp) : new Date();
    return date.toISOString().split('T')[0];
}
/**
 * Truncate wallet address to first 4 and last 4 characters
 */
function truncateWallet(walletAddress) {
    if (!walletAddress || walletAddress.length < 9)
        return walletAddress || null;
    return `${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}`;
}
/**
 * Generate MD5 hash for error grouping
 */
function hashError(eventName, errorMessage) {
    return crypto.createHash('md5').update(`${eventName}:${errorMessage}`).digest('hex');
}
/**
 * Generate unique event ID
 */
function generateEventId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
// ============================================
// Event Tracking Functions
// ============================================
/**
 * Track a single analytics event
 */
function trackEvent(gameId, event) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const date = getDateString(event.clientTimestamp);
            const eventId = generateEventId();
            const serverTimestamp = Date.now();
            // Prepare event data for storage
            // Remove undefined values as Firebase doesn't allow them
            const eventData = {
                eventName: event.eventName,
                eventData: event.eventData || {},
                sdkVersion: event.sdkVersion || '',
                unityVersion: event.unityVersion || '',
                platform: event.platform || '',
                osVersion: event.osVersion || '',
                environment: event.environment || '',
                tokenType: event.tokenType || '',
                sessionId: event.sessionId || '',
                clientTimestamp: event.clientTimestamp || serverTimestamp,
                serverTimestamp,
            };
            // Only include walletAddress if it exists (not null/undefined)
            const truncatedWallet = truncateWallet(event.walletAddress);
            if (truncatedWallet !== null && truncatedWallet !== undefined) {
                eventData.walletAddress = truncatedWallet;
            }
            // Store raw event (90-day retention handled by cleanup job)
            const eventRef = (0, database_1.ref)(firebase_1.db, `analytics/events/${gameId}/${eventId}`);
            yield (0, database_1.set)(eventRef, eventData);
            // Update aggregates
            yield updateDailyAggregates(gameId, date, event);
            yield updatePlatformDailyAggregates(date, event);
            // Track unique sessions
            if (event.sessionId) {
                yield trackSession(gameId, date, event.sessionId);
            }
            // Track unique wallets
            if (event.walletAddress) {
                yield trackUniqueWallet(gameId, date, event.walletAddress);
            }
            // Track errors
            if (event.eventName.includes('_failed') || event.eventName.includes('_error')) {
                yield trackError(gameId, date, event);
            }
            // Track SDK version
            if (event.sdkVersion) {
                yield trackVersion(date, event.sdkVersion, gameId);
            }
        }
        catch (error) {
            console.error('[Analytics] Error tracking event:', error);
            throw error;
        }
    });
}
/**
 * Track a batch of events (max 100)
 */
function trackBatchEvents(gameId, events) {
    return __awaiter(this, void 0, void 0, function* () {
        if (events.length > 100) {
            throw new Error('Batch size cannot exceed 100 events');
        }
        let successCount = 0;
        const errors = [];
        // Process events in parallel but track failures
        yield Promise.allSettled(events.map((event) => __awaiter(this, void 0, void 0, function* () {
            try {
                yield trackEvent(gameId, event);
                successCount++;
            }
            catch (error) {
                errors.push(error);
            }
        })));
        if (errors.length > 0) {
            console.error(`[Analytics] ${errors.length} events failed in batch:`, errors);
        }
        return successCount;
    });
}
// ============================================
// Aggregation Functions
// ============================================
/**
 * Update daily aggregates for a specific game
 */
function updateDailyAggregates(gameId, date, event) {
    return __awaiter(this, void 0, void 0, function* () {
        const dailyRef = (0, database_1.ref)(firebase_1.db, `analytics/daily/${gameId}/${date}`);
        const snapshot = yield (0, database_1.get)(dailyRef);
        // Get current data or initialize defaults
        let current;
        if (!snapshot.exists()) {
            current = {
                initializations: 0,
                initFailures: 0,
                walletConnections: 0,
                walletFailures: 0,
                registrations: 0,
                registrationFailures: 0,
                scoreSubmissions: 0,
                scoreFailures: 0,
                uniqueSessions: 0,
                uniqueWallets: 0,
                splEvents: 0,
                solEvents: 0,
                lastUpdated: Date.now(),
            };
            yield (0, database_1.set)(dailyRef, current);
        }
        else {
            current = snapshot.val();
        }
        const statKey = EVENT_TO_STAT_MAP[event.eventName];
        const updates = {
            lastUpdated: Date.now(),
        };
        // Increment event counter if mapped
        if (statKey) {
            updates[statKey] = (current[statKey] || 0) + 1;
        }
        // Track token type
        if (event.tokenType === 'SPL') {
            updates.splEvents = (current.splEvents || 0) + 1;
        }
        else if (event.tokenType === 'SOL') {
            updates.solEvents = (current.solEvents || 0) + 1;
        }
        // Apply updates
        yield (0, database_1.update)(dailyRef, updates);
    });
}
/**
 * Update platform-wide daily aggregates
 */
function updatePlatformDailyAggregates(date, event) {
    return __awaiter(this, void 0, void 0, function* () {
        const platformRef = (0, database_1.ref)(firebase_1.db, `analytics/platformDaily/${date}`);
        const snapshot = yield (0, database_1.get)(platformRef);
        // Get current data or initialize defaults
        let current;
        if (!snapshot.exists()) {
            current = {
                totalInitializations: 0,
                totalInitFailures: 0,
                totalWalletConnections: 0,
                totalWalletFailures: 0,
                totalRegistrations: 0,
                totalRegistrationFailures: 0,
                totalScoreSubmissions: 0,
                totalScoreFailures: 0,
                totalUniqueSessions: 0,
                totalUniqueWallets: 0,
                activeGames: 0,
                splEvents: 0,
                solEvents: 0,
                lastUpdated: Date.now(),
            };
            yield (0, database_1.set)(platformRef, current);
        }
        else {
            current = snapshot.val();
        }
        const statKey = EVENT_TO_STAT_MAP[event.eventName];
        const updates = {
            lastUpdated: Date.now(),
        };
        // Increment event counter if mapped
        if (statKey) {
            const platformKey = `total${statKey.charAt(0).toUpperCase() + statKey.slice(1)}`;
            updates[platformKey] = (current[platformKey] || 0) + 1;
        }
        // Track token type
        if (event.tokenType === 'SPL') {
            updates.splEvents = (current.splEvents || 0) + 1;
        }
        else if (event.tokenType === 'SOL') {
            updates.solEvents = (current.solEvents || 0) + 1;
        }
        // Apply updates
        yield (0, database_1.update)(platformRef, updates);
    });
}
/**
 * Track unique session
 */
function trackSession(gameId, date, sessionId) {
    return __awaiter(this, void 0, void 0, function* () {
        const sessionRef = (0, database_1.ref)(firebase_1.db, `analytics/sessions/${gameId}/${date}/${sessionId}`);
        const snapshot = yield (0, database_1.get)(sessionRef);
        if (!snapshot.exists()) {
            yield (0, database_1.set)(sessionRef, {
                firstSeen: Date.now(),
                lastSeen: Date.now(),
            });
        }
        else {
            yield (0, database_1.update)(sessionRef, {
                lastSeen: Date.now(),
            });
        }
    });
}
/**
 * Track unique wallet
 */
function trackUniqueWallet(gameId, date, walletAddress) {
    return __awaiter(this, void 0, void 0, function* () {
        const truncated = truncateWallet(walletAddress);
        if (!truncated || truncated === null)
            return;
        const walletHash = crypto.createHash('md5').update(truncated).digest('hex');
        const walletRef = (0, database_1.ref)(firebase_1.db, `analytics/wallets/${gameId}/${date}/${walletHash}`);
        const snapshot = yield (0, database_1.get)(walletRef);
        if (!snapshot.exists()) {
            yield (0, database_1.set)(walletRef, {
                walletAddress: truncated,
                firstSeen: Date.now(),
                lastSeen: Date.now(),
            });
        }
        else {
            yield (0, database_1.update)(walletRef, {
                lastSeen: Date.now(),
            });
        }
    });
}
/**
 * Track error occurrence
 */
function trackError(gameId, date, event) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        if (!((_a = event.eventData) === null || _a === void 0 ? void 0 : _a.error))
            return;
        const errorMessage = typeof event.eventData.error === 'string'
            ? event.eventData.error
            : JSON.stringify(event.eventData.error);
        const errorHash = hashError(event.eventName, errorMessage);
        const errorRef = (0, database_1.ref)(firebase_1.db, `analytics/errors/${gameId}/${date}/${errorHash}`);
        const snapshot = yield (0, database_1.get)(errorRef);
        const errorType = event.eventData.errorType || 'unknown';
        const timestamp = Date.now();
        if (!snapshot.exists()) {
            yield (0, database_1.set)(errorRef, {
                eventName: event.eventName,
                errorMessage,
                errorType,
                count: 1,
                firstOccurred: timestamp,
                lastOccurred: timestamp,
            });
        }
        else {
            const current = snapshot.val();
            yield (0, database_1.update)(errorRef, {
                count: (current.count || 0) + 1,
                lastOccurred: timestamp,
            });
        }
    });
}
/**
 * Track SDK version usage
 */
function trackVersion(date, sdkVersion, gameId) {
    return __awaiter(this, void 0, void 0, function* () {
        const versionRef = (0, database_1.ref)(firebase_1.db, `analytics/versions/${date}/${sdkVersion}`);
        const snapshot = yield (0, database_1.get)(versionRef);
        if (!snapshot.exists()) {
            yield (0, database_1.set)(versionRef, {
                totalEvents: 1,
                gamesUsing: 1,
                gamesList: {
                    [gameId]: true,
                },
            });
        }
        else {
            const current = snapshot.val();
            const gamesList = current.gamesList || {};
            const isNewGame = !gamesList[gameId];
            yield (0, database_1.update)(versionRef, {
                totalEvents: (current.totalEvents || 0) + 1,
                gamesUsing: isNewGame ? (current.gamesUsing || 0) + 1 : current.gamesUsing,
                [`gamesList/${gameId}`]: true,
            });
        }
    });
}
// ============================================
// Developer Query Functions
// ============================================
/**
 * Get game summary for a date range
 */
/**
 * Get game summary for a date range
 * OPTIMIZED: Parallel queries and single fetch for sessions/wallets
 */
function getGameSummary(gameId, days) {
    return __awaiter(this, void 0, void 0, function* () {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        const summary = {
            totalInitializations: 0,
            totalInitFailures: 0,
            totalWalletConnections: 0,
            totalWalletFailures: 0,
            totalRegistrations: 0,
            totalRegistrationFailures: 0,
            totalScoreSubmissions: 0,
            totalScoreFailures: 0,
            totalSessions: 0,
            totalWallets: 0,
            splEvents: 0,
            solEvents: 0,
        };
        // Generate all date strings upfront
        const dateStrings = [];
        const currentDate = new Date(startDate);
        while (currentDate <= endDate) {
            dateStrings.push(getDateString(currentDate.getTime()));
            currentDate.setDate(currentDate.getDate() + 1);
        }
        // Fetch all daily data in parallel
        const dailyPromises = dateStrings.map((dateStr) => {
            const dailyRef = (0, database_1.ref)(firebase_1.db, `analytics/daily/${gameId}/${dateStr}`);
            return (0, database_1.get)(dailyRef).catch((error) => {
                var _a;
                if (error.code === 'PERMISSION_DENIED' || ((_a = error.message) === null || _a === void 0 ? void 0 : _a.includes('Permission denied'))) {
                    console.warn(`[Analytics] Permission denied for analytics/daily/${gameId}/${dateStr}`);
                }
                else {
                    console.error(`[Analytics] Error reading daily data for ${dateStr}:`, error);
                }
                return null;
            });
        });
        // Fetch sessions and wallets ONCE (not in loop)
        const [sessionsSnapshot, walletsSnapshot, ...dailySnapshots] = yield Promise.all([
            (0, database_1.get)((0, database_1.ref)(firebase_1.db, `analytics/sessions/${gameId}`)).catch((error) => {
                var _a;
                if (error.code === 'PERMISSION_DENIED' || ((_a = error.message) === null || _a === void 0 ? void 0 : _a.includes('Permission denied'))) {
                    console.warn(`[Analytics] Permission denied for analytics/sessions/${gameId}`);
                }
                else {
                    console.error(`[Analytics] Error reading sessions:`, error);
                }
                return null;
            }),
            (0, database_1.get)((0, database_1.ref)(firebase_1.db, `analytics/wallets/${gameId}`)).catch((error) => {
                var _a;
                if (error.code === 'PERMISSION_DENIED' || ((_a = error.message) === null || _a === void 0 ? void 0 : _a.includes('Permission denied'))) {
                    console.warn(`[Analytics] Permission denied for analytics/wallets/${gameId}`);
                }
                else {
                    console.error(`[Analytics] Error reading wallets:`, error);
                }
                return null;
            }),
            ...dailyPromises,
        ]);
        // Process daily data
        dailySnapshots.forEach((snapshot) => {
            if (snapshot === null || snapshot === void 0 ? void 0 : snapshot.exists()) {
                const data = snapshot.val();
                summary.totalInitializations += data.initializations || 0;
                summary.totalInitFailures += data.initFailures || 0;
                summary.totalWalletConnections += data.walletConnections || 0;
                summary.totalWalletFailures += data.walletFailures || 0;
                summary.totalRegistrations += data.registrations || 0;
                summary.totalRegistrationFailures += data.registrationFailures || 0;
                summary.totalScoreSubmissions += data.scoreSubmissions || 0;
                summary.totalScoreFailures += data.scoreFailures || 0;
                summary.splEvents += data.splEvents || 0;
                summary.solEvents += data.solEvents || 0;
            }
        });
        // Process sessions and wallets ONCE for all dates
        if (sessionsSnapshot === null || sessionsSnapshot === void 0 ? void 0 : sessionsSnapshot.exists()) {
            const sessions = sessionsSnapshot.val();
            for (const dateStr of dateStrings) {
                if (sessions[dateStr]) {
                    summary.totalSessions += Object.keys(sessions[dateStr]).length;
                }
            }
        }
        if (walletsSnapshot === null || walletsSnapshot === void 0 ? void 0 : walletsSnapshot.exists()) {
            const wallets = walletsSnapshot.val();
            for (const dateStr of dateStrings) {
                if (wallets[dateStr]) {
                    summary.totalWallets += Object.keys(wallets[dateStr]).length;
                }
            }
        }
        return {
            summary,
            period: {
                days,
                startDate: startDate.toISOString(),
                endDate: endDate.toISOString(),
            },
        };
    });
}
/**
 * Get game trends for a date range
 * OPTIMIZED: Parallel queries and single fetch for sessions/wallets
 */
function getGameTrends(gameId, days) {
    return __awaiter(this, void 0, void 0, function* () {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        // Generate all date strings upfront
        const dateStrings = [];
        const currentDate = new Date(startDate);
        while (currentDate <= endDate) {
            dateStrings.push(getDateString(currentDate.getTime()));
            currentDate.setDate(currentDate.getDate() + 1);
        }
        // Fetch all daily data in parallel
        const dailyPromises = dateStrings.map((dateStr) => {
            const dailyRef = (0, database_1.ref)(firebase_1.db, `analytics/daily/${gameId}/${dateStr}`);
            return (0, database_1.get)(dailyRef).catch((error) => {
                var _a;
                if (error.code === 'PERMISSION_DENIED' || ((_a = error.message) === null || _a === void 0 ? void 0 : _a.includes('Permission denied'))) {
                    console.warn(`[Analytics] Permission denied for analytics/daily/${gameId}/${dateStr}`);
                }
                else {
                    console.error(`[Analytics] Error reading daily trends for ${dateStr}:`, error);
                }
                return null;
            });
        });
        // Fetch sessions and wallets ONCE (not in loop)
        const [sessionsSnapshot, walletsSnapshot, ...dailySnapshots] = yield Promise.all([
            (0, database_1.get)((0, database_1.ref)(firebase_1.db, `analytics/sessions/${gameId}`)).catch((error) => {
                var _a;
                if (error.code === 'PERMISSION_DENIED' || ((_a = error.message) === null || _a === void 0 ? void 0 : _a.includes('Permission denied'))) {
                    console.warn(`[Analytics] Permission denied for analytics/sessions/${gameId}`);
                }
                else {
                    console.error(`[Analytics] Error reading sessions:`, error);
                }
                return null;
            }),
            (0, database_1.get)((0, database_1.ref)(firebase_1.db, `analytics/wallets/${gameId}`)).catch((error) => {
                var _a;
                if (error.code === 'PERMISSION_DENIED' || ((_a = error.message) === null || _a === void 0 ? void 0 : _a.includes('Permission denied'))) {
                    console.warn(`[Analytics] Permission denied for analytics/wallets/${gameId}`);
                }
                else {
                    console.error(`[Analytics] Error reading wallets:`, error);
                }
                return null;
            }),
            ...dailyPromises,
        ]);
        // Pre-process sessions and wallets data for quick lookup
        const sessionsData = (sessionsSnapshot === null || sessionsSnapshot === void 0 ? void 0 : sessionsSnapshot.exists()) ? sessionsSnapshot.val() : {};
        const walletsData = (walletsSnapshot === null || walletsSnapshot === void 0 ? void 0 : walletsSnapshot.exists()) ? walletsSnapshot.val() : {};
        // Build trends array
        const trends = dateStrings.map((dateStr, index) => {
            const trend = {
                date: dateStr,
                initializations: 0,
                initFailures: 0,
                walletConnections: 0,
                walletFailures: 0,
                registrations: 0,
                registrationFailures: 0,
                scoreSubmissions: 0,
                scoreFailures: 0,
                uniqueSessions: 0,
                uniqueWallets: 0,
                splEvents: 0,
                solEvents: 0,
            };
            // Process daily data
            const snapshot = dailySnapshots[index];
            if (snapshot === null || snapshot === void 0 ? void 0 : snapshot.exists()) {
                const data = snapshot.val();
                trend.initializations = data.initializations || 0;
                trend.initFailures = data.initFailures || 0;
                trend.walletConnections = data.walletConnections || 0;
                trend.walletFailures = data.walletFailures || 0;
                trend.registrations = data.registrations || 0;
                trend.registrationFailures = data.registrationFailures || 0;
                trend.scoreSubmissions = data.scoreSubmissions || 0;
                trend.scoreFailures = data.scoreFailures || 0;
                trend.splEvents = data.splEvents || 0;
                trend.solEvents = data.solEvents || 0;
            }
            // Process sessions and wallets from pre-fetched data
            if (sessionsData[dateStr]) {
                trend.uniqueSessions = Object.keys(sessionsData[dateStr]).length;
            }
            if (walletsData[dateStr]) {
                trend.uniqueWallets = Object.keys(walletsData[dateStr]).length;
            }
            return trend;
        });
        return trends;
    });
}
/**
 * Get game errors for a date range
 * OPTIMIZED: Parallel queries
 */
function getGameErrors(gameId, days) {
    return __awaiter(this, void 0, void 0, function* () {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        const errorMap = new Map();
        // Generate all date strings upfront
        const dateStrings = [];
        const currentDate = new Date(startDate);
        while (currentDate <= endDate) {
            dateStrings.push(getDateString(currentDate.getTime()));
            currentDate.setDate(currentDate.getDate() + 1);
        }
        // Fetch all error data in parallel
        const errorPromises = dateStrings.map((dateStr) => {
            const errorsRef = (0, database_1.ref)(firebase_1.db, `analytics/errors/${gameId}/${dateStr}`);
            return (0, database_1.get)(errorsRef).catch((error) => {
                var _a;
                if (error.code === 'PERMISSION_DENIED' || ((_a = error.message) === null || _a === void 0 ? void 0 : _a.includes('Permission denied'))) {
                    console.warn(`[Analytics] Permission denied for analytics/errors/${gameId}/${dateStr}`);
                }
                else {
                    console.error(`[Analytics] Error reading errors for ${dateStr}:`, error);
                }
                return null;
            });
        });
        const errorSnapshots = yield Promise.all(errorPromises);
        // Process all error data
        errorSnapshots.forEach((snapshot) => {
            if (snapshot === null || snapshot === void 0 ? void 0 : snapshot.exists()) {
                const errors = snapshot.val();
                if (errors && typeof errors === 'object') {
                    for (const errorHash in errors) {
                        const error = errors[errorHash];
                        if (!error || typeof error !== 'object') {
                            continue;
                        }
                        const key = `${error.eventName || 'unknown'}:${error.errorMessage || 'unknown'}`;
                        if (errorMap.has(key)) {
                            const existing = errorMap.get(key);
                            existing.totalCount += error.count || 0;
                            existing.lastOccurred = Math.max(existing.lastOccurred, error.lastOccurred || 0);
                        }
                        else {
                            errorMap.set(key, {
                                eventName: error.eventName || 'unknown',
                                errorMessage: error.errorMessage || 'unknown',
                                errorType: error.errorType || 'unknown',
                                totalCount: error.count || 0,
                                firstOccurred: error.firstOccurred || 0,
                                lastOccurred: error.lastOccurred || 0,
                            });
                        }
                    }
                }
            }
        });
        return Array.from(errorMap.values()).sort((a, b) => b.totalCount - a.totalCount);
    });
}
/**
 * Get game SDK versions for a date range
 * OPTIMIZED: Parallel queries
 */
function getGameVersions(gameId, days) {
    return __awaiter(this, void 0, void 0, function* () {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        const versionMap = new Map();
        // Generate all date strings upfront
        const dateStrings = [];
        const currentDate = new Date(startDate);
        while (currentDate <= endDate) {
            dateStrings.push(getDateString(currentDate.getTime()));
            currentDate.setDate(currentDate.getDate() + 1);
        }
        // Fetch all version data in parallel
        const versionPromises = dateStrings.map((dateStr) => {
            const versionsRef = (0, database_1.ref)(firebase_1.db, `analytics/versions/${dateStr}`);
            return (0, database_1.get)(versionsRef).catch((error) => {
                var _a;
                if (error.code === 'PERMISSION_DENIED' || ((_a = error.message) === null || _a === void 0 ? void 0 : _a.includes('Permission denied'))) {
                    console.warn(`[Analytics] Permission denied for analytics/versions/${dateStr}`);
                }
                else {
                    console.error(`[Analytics] Error reading versions for ${dateStr}:`, error);
                }
                return null;
            });
        });
        const versionSnapshots = yield Promise.all(versionPromises);
        // Process all version data
        versionSnapshots.forEach((snapshot) => {
            if (snapshot === null || snapshot === void 0 ? void 0 : snapshot.exists()) {
                const versions = snapshot.val();
                for (const sdkVersion in versions) {
                    const version = versions[sdkVersion];
                    if (version.gamesList && version.gamesList[gameId]) {
                        if (versionMap.has(sdkVersion)) {
                            const existing = versionMap.get(sdkVersion);
                            existing.totalEvents += version.totalEvents || 0;
                            existing.gamesUsing.add(gameId);
                        }
                        else {
                            versionMap.set(sdkVersion, {
                                totalEvents: version.totalEvents || 0,
                                gamesUsing: new Set([gameId]),
                            });
                        }
                    }
                }
            }
        });
        const totalEvents = Array.from(versionMap.values()).reduce((sum, v) => sum + v.totalEvents, 0);
        return Array.from(versionMap.entries())
            .map(([sdkVersion, data]) => ({
            sdkVersion,
            totalEvents: data.totalEvents,
            gamesUsing: data.gamesUsing.size,
            percentage: totalEvents > 0 ? Math.round((data.totalEvents / totalEvents) * 100) : 0,
        }))
            .sort((a, b) => b.totalEvents - a.totalEvents);
    });
}
// ============================================
// Admin Query Functions
// ============================================
/**
 * Get platform summary for a date range
 * OPTIMIZED: Parallel queries and single fetch for sessions/wallets
 */
function getPlatformSummary(days) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        const summary = {
            totalInitializations: 0,
            totalInitFailures: 0,
            totalWalletConnections: 0,
            totalWalletFailures: 0,
            totalRegistrations: 0,
            totalRegistrationFailures: 0,
            totalScoreSubmissions: 0,
            totalScoreFailures: 0,
            totalSessions: 0,
            totalWallets: 0,
            activeGames: 0,
            splEvents: 0,
            solEvents: 0,
        };
        const activeGamesSet = new Set();
        // Generate all date strings upfront
        const dateStrings = [];
        const currentDate = new Date(startDate);
        while (currentDate <= endDate) {
            dateStrings.push(getDateString(currentDate.getTime()));
            currentDate.setDate(currentDate.getDate() + 1);
        }
        // Fetch all platform daily data in parallel
        const platformPromises = dateStrings.map((dateStr) => {
            const platformRef = (0, database_1.ref)(firebase_1.db, `analytics/platformDaily/${dateStr}`);
            return (0, database_1.get)(platformRef).catch((error) => {
                var _a;
                if (error.code === 'PERMISSION_DENIED' || ((_a = error.message) === null || _a === void 0 ? void 0 : _a.includes('Permission denied'))) {
                    console.warn(`[Analytics] Permission denied for analytics/platformDaily/${dateStr}`);
                }
                else {
                    console.error(`[Analytics] Error reading platform daily data for ${dateStr}:`, error);
                }
                return null;
            });
        });
        // Fetch sessions and wallets ONCE (not in loop)
        const [sessionsSnapshot, walletsSnapshot, ...platformSnapshots] = yield Promise.all([
            (0, database_1.get)((0, database_1.ref)(firebase_1.db, `analytics/sessions`)).catch((error) => {
                var _a;
                if (error.code === 'PERMISSION_DENIED' || ((_a = error.message) === null || _a === void 0 ? void 0 : _a.includes('Permission denied'))) {
                    console.warn(`[Analytics] Permission denied for analytics/sessions`);
                }
                else {
                    console.error(`[Analytics] Error reading sessions:`, error);
                }
                return null;
            }),
            (0, database_1.get)((0, database_1.ref)(firebase_1.db, `analytics/wallets`)).catch((error) => {
                var _a;
                if (error.code === 'PERMISSION_DENIED' || ((_a = error.message) === null || _a === void 0 ? void 0 : _a.includes('Permission denied'))) {
                    console.warn(`[Analytics] Permission denied for analytics/wallets`);
                }
                else {
                    console.error(`[Analytics] Error reading wallets:`, error);
                }
                return null;
            }),
            ...platformPromises,
        ]);
        // Process platform daily data
        platformSnapshots.forEach((snapshot, index) => {
            if (snapshot === null || snapshot === void 0 ? void 0 : snapshot.exists()) {
                const data = snapshot.val();
                summary.totalInitializations += data.totalInitializations || 0;
                summary.totalInitFailures += data.totalInitFailures || 0;
                summary.totalWalletConnections += data.totalWalletConnections || 0;
                summary.totalWalletFailures += data.totalWalletFailures || 0;
                summary.totalRegistrations += data.totalRegistrations || 0;
                summary.totalRegistrationFailures += data.totalRegistrationFailures || 0;
                summary.totalScoreSubmissions += data.totalScoreSubmissions || 0;
                summary.totalScoreFailures += data.totalScoreFailures || 0;
                summary.splEvents += data.splEvents || 0;
                summary.solEvents += data.solEvents || 0;
            }
        });
        // Process sessions and wallets ONCE for all dates
        if (sessionsSnapshot === null || sessionsSnapshot === void 0 ? void 0 : sessionsSnapshot.exists()) {
            const sessions = sessionsSnapshot.val();
            for (const gameId in sessions) {
                activeGamesSet.add(gameId);
                for (const dateStr of dateStrings) {
                    if ((_a = sessions[gameId]) === null || _a === void 0 ? void 0 : _a[dateStr]) {
                        summary.totalSessions += Object.keys(sessions[gameId][dateStr]).length;
                    }
                }
            }
        }
        if (walletsSnapshot === null || walletsSnapshot === void 0 ? void 0 : walletsSnapshot.exists()) {
            const wallets = walletsSnapshot.val();
            for (const gameId in wallets) {
                activeGamesSet.add(gameId);
                for (const dateStr of dateStrings) {
                    if ((_b = wallets[gameId]) === null || _b === void 0 ? void 0 : _b[dateStr]) {
                        summary.totalWallets += Object.keys(wallets[gameId][dateStr]).length;
                    }
                }
            }
        }
        summary.activeGames = activeGamesSet.size;
        return {
            summary,
            period: {
                days,
                startDate: startDate.toISOString(),
                endDate: endDate.toISOString(),
            },
        };
    });
}
/**
 * Get platform trends for a date range
 * OPTIMIZED: Parallel queries and single fetch for sessions/wallets
 */
function getPlatformTrends(days) {
    return __awaiter(this, void 0, void 0, function* () {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        // Generate all date strings upfront
        const dateStrings = [];
        const currentDate = new Date(startDate);
        while (currentDate <= endDate) {
            dateStrings.push(getDateString(currentDate.getTime()));
            currentDate.setDate(currentDate.getDate() + 1);
        }
        // Fetch all platform daily data in parallel
        const platformPromises = dateStrings.map((dateStr) => {
            const platformRef = (0, database_1.ref)(firebase_1.db, `analytics/platformDaily/${dateStr}`);
            return (0, database_1.get)(platformRef).catch((error) => {
                var _a;
                if (error.code === 'PERMISSION_DENIED' || ((_a = error.message) === null || _a === void 0 ? void 0 : _a.includes('Permission denied'))) {
                    console.warn(`[Analytics] Permission denied for analytics/platformDaily/${dateStr}`);
                }
                else {
                    console.error(`[Analytics] Error reading platform trends for ${dateStr}:`, error);
                }
                return null;
            });
        });
        // Fetch sessions and wallets ONCE (not in loop)
        const [sessionsSnapshot, walletsSnapshot, ...platformSnapshots] = yield Promise.all([
            (0, database_1.get)((0, database_1.ref)(firebase_1.db, `analytics/sessions`)).catch((error) => {
                var _a;
                if (error.code === 'PERMISSION_DENIED' || ((_a = error.message) === null || _a === void 0 ? void 0 : _a.includes('Permission denied'))) {
                    console.warn(`[Analytics] Permission denied for analytics/sessions`);
                }
                else {
                    console.error(`[Analytics] Error reading sessions:`, error);
                }
                return null;
            }),
            (0, database_1.get)((0, database_1.ref)(firebase_1.db, `analytics/wallets`)).catch((error) => {
                var _a;
                if (error.code === 'PERMISSION_DENIED' || ((_a = error.message) === null || _a === void 0 ? void 0 : _a.includes('Permission denied'))) {
                    console.warn(`[Analytics] Permission denied for analytics/wallets`);
                }
                else {
                    console.error(`[Analytics] Error reading wallets:`, error);
                }
                return null;
            }),
            ...platformPromises,
        ]);
        // Pre-process sessions and wallets data for quick lookup
        const sessionsData = (sessionsSnapshot === null || sessionsSnapshot === void 0 ? void 0 : sessionsSnapshot.exists()) ? sessionsSnapshot.val() : {};
        const walletsData = (walletsSnapshot === null || walletsSnapshot === void 0 ? void 0 : walletsSnapshot.exists()) ? walletsSnapshot.val() : {};
        // Build trends array
        const trends = dateStrings.map((dateStr, index) => {
            var _a, _b;
            const trend = {
                date: dateStr,
                initializations: 0,
                initFailures: 0,
                walletConnections: 0,
                walletFailures: 0,
                registrations: 0,
                registrationFailures: 0,
                scoreSubmissions: 0,
                scoreFailures: 0,
                uniqueSessions: 0,
                uniqueWallets: 0,
                splEvents: 0,
                solEvents: 0,
            };
            // Process platform daily data
            const snapshot = platformSnapshots[index];
            if (snapshot === null || snapshot === void 0 ? void 0 : snapshot.exists()) {
                const data = snapshot.val();
                trend.initializations = data.totalInitializations || 0;
                trend.initFailures = data.totalInitFailures || 0;
                trend.walletConnections = data.totalWalletConnections || 0;
                trend.walletFailures = data.totalWalletFailures || 0;
                trend.registrations = data.totalRegistrations || 0;
                trend.registrationFailures = data.totalRegistrationFailures || 0;
                trend.scoreSubmissions = data.totalScoreSubmissions || 0;
                trend.scoreFailures = data.totalScoreFailures || 0;
                trend.splEvents = data.splEvents || 0;
                trend.solEvents = data.solEvents || 0;
            }
            // Count unique sessions and wallets from pre-fetched data
            let sessionCount = 0;
            for (const gameId in sessionsData) {
                if ((_a = sessionsData[gameId]) === null || _a === void 0 ? void 0 : _a[dateStr]) {
                    sessionCount += Object.keys(sessionsData[gameId][dateStr]).length;
                }
            }
            trend.uniqueSessions = sessionCount;
            let walletCount = 0;
            for (const gameId in walletsData) {
                if ((_b = walletsData[gameId]) === null || _b === void 0 ? void 0 : _b[dateStr]) {
                    walletCount += Object.keys(walletsData[gameId][dateStr]).length;
                }
            }
            trend.uniqueWallets = walletCount;
            return trend;
        });
        // Transform TrendData to match frontend PlatformDailyTrend interface
        return trends.map(trend => ({
            date: trend.date,
            totalInitializations: trend.initializations,
            totalInitFailures: trend.initFailures,
            totalWalletConnections: trend.walletConnections,
            totalWalletFailures: trend.walletFailures,
            totalRegistrations: trend.registrations,
            totalRegistrationFailures: trend.registrationFailures,
            totalScoreSubmissions: trend.scoreSubmissions,
            totalScoreFailures: trend.scoreFailures,
            totalUniqueSessions: trend.uniqueSessions,
            totalUniqueWallets: trend.uniqueWallets,
            splEvents: trend.splEvents,
            solEvents: trend.solEvents,
        }));
    });
}
/**
 * Get platform SDK versions for a date range
 * OPTIMIZED: Parallel queries for all dates
 */
function getPlatformVersions(days) {
    return __awaiter(this, void 0, void 0, function* () {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        const versionMap = new Map();
        // Generate all date strings upfront
        const dateStrings = [];
        const currentDate = new Date(startDate);
        while (currentDate <= endDate) {
            dateStrings.push(getDateString(currentDate.getTime()));
            currentDate.setDate(currentDate.getDate() + 1);
        }
        // Fetch all version data in parallel
        const versionPromises = dateStrings.map((dateStr) => {
            const versionsRef = (0, database_1.ref)(firebase_1.db, `analytics/versions/${dateStr}`);
            return (0, database_1.get)(versionsRef).catch((error) => {
                var _a;
                if (error.code === 'PERMISSION_DENIED' || ((_a = error.message) === null || _a === void 0 ? void 0 : _a.includes('Permission denied'))) {
                    console.warn(`[Analytics] Permission denied for analytics/versions/${dateStr}`);
                }
                else {
                    console.error(`[Analytics] Error reading versions for ${dateStr}:`, error);
                }
                return null;
            });
        });
        const versionSnapshots = yield Promise.all(versionPromises);
        // Process all snapshots
        versionSnapshots.forEach(snapshot => {
            if (snapshot === null || snapshot === void 0 ? void 0 : snapshot.exists()) {
                const versions = snapshot.val();
                if (versions && typeof versions === 'object') {
                    for (const sdkVersion in versions) {
                        const version = versions[sdkVersion];
                        if (!version || typeof version !== 'object') {
                            continue;
                        }
                        const gamesList = version.gamesList || {};
                        const totalEvents = version.totalEvents || 0;
                        if (versionMap.has(sdkVersion)) {
                            const existing = versionMap.get(sdkVersion);
                            existing.totalEvents += totalEvents;
                            if (gamesList && typeof gamesList === 'object') {
                                Object.keys(gamesList).forEach(gameId => existing.gamesUsing.add(gameId));
                            }
                        }
                        else {
                            versionMap.set(sdkVersion, {
                                totalEvents,
                                gamesUsing: gamesList && typeof gamesList === 'object'
                                    ? new Set(Object.keys(gamesList))
                                    : new Set(),
                            });
                        }
                    }
                }
            }
        });
        try {
            const totalEvents = Array.from(versionMap.values()).reduce((sum, v) => sum + ((v === null || v === void 0 ? void 0 : v.totalEvents) || 0), 0);
            return Array.from(versionMap.entries())
                .map(([sdkVersion, data]) => {
                var _a;
                if (!data || typeof data !== 'object') {
                    return null;
                }
                return {
                    sdkVersion,
                    totalEvents: data.totalEvents || 0,
                    gamesUsing: ((_a = data.gamesUsing) === null || _a === void 0 ? void 0 : _a.size) || 0,
                    percentage: totalEvents > 0 ? Math.round(((data.totalEvents || 0) / totalEvents) * 100) : 0,
                };
            })
                .filter((item) => item !== null)
                .sort((a, b) => b.totalEvents - a.totalEvents);
        }
        catch (error) {
            console.error('[Analytics] Error processing platform versions:', error);
            return []; // Return empty array on processing error
        }
    });
}
/**
 * Get games leaderboard
 * OPTIMIZED: Fetch daily and wallets data once, process in memory
 */
function getGamesLeaderboard(days, limit) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        // Generate all date strings upfront
        const dateStrings = [];
        const currentDate = new Date(startDate);
        while (currentDate <= endDate) {
            dateStrings.push(getDateString(currentDate.getTime()));
            currentDate.setDate(currentDate.getDate() + 1);
        }
        const gameMap = new Map();
        // Fetch daily and wallets data ONCE (not in loop)
        const [dailySnapshot, walletsSnapshot] = yield Promise.all([
            (0, database_1.get)((0, database_1.ref)(firebase_1.db, `analytics/daily`)).catch((error) => {
                var _a;
                if (error.code === 'PERMISSION_DENIED' || ((_a = error.message) === null || _a === void 0 ? void 0 : _a.includes('Permission denied'))) {
                    console.warn(`[Analytics] Permission denied for analytics/daily`);
                }
                else {
                    console.error(`[Analytics] Error reading daily data for leaderboard:`, error);
                }
                return null;
            }),
            (0, database_1.get)((0, database_1.ref)(firebase_1.db, `analytics/wallets`)).catch((error) => {
                var _a;
                if (error.code === 'PERMISSION_DENIED' || ((_a = error.message) === null || _a === void 0 ? void 0 : _a.includes('Permission denied'))) {
                    console.warn(`[Analytics] Permission denied for analytics/wallets`);
                }
                else {
                    console.error(`[Analytics] Error reading wallets for leaderboard:`, error);
                }
                return null;
            }),
        ]);
        // Process daily data for all dates
        if (dailySnapshot === null || dailySnapshot === void 0 ? void 0 : dailySnapshot.exists()) {
            const games = dailySnapshot.val();
            for (const gameId in games) {
                for (const dateStr of dateStrings) {
                    if ((_a = games[gameId]) === null || _a === void 0 ? void 0 : _a[dateStr]) {
                        const data = games[gameId][dateStr];
                        if (!gameMap.has(gameId)) {
                            gameMap.set(gameId, {
                                gameId,
                                initializations: 0,
                                walletConnections: 0,
                                registrations: 0,
                                scoreSubmissions: 0,
                                uniqueWallets: 0,
                                splEvents: 0,
                                solEvents: 0,
                            });
                        }
                        const game = gameMap.get(gameId);
                        game.initializations += data.initializations || 0;
                        game.walletConnections += data.walletConnections || 0;
                        game.registrations += data.registrations || 0;
                        game.scoreSubmissions += data.scoreSubmissions || 0;
                        game.splEvents += data.splEvents || 0;
                        game.solEvents += data.solEvents || 0;
                    }
                }
            }
        }
        // Process wallets data for all dates
        if (walletsSnapshot === null || walletsSnapshot === void 0 ? void 0 : walletsSnapshot.exists()) {
            const wallets = walletsSnapshot.val();
            for (const gameId in wallets) {
                for (const dateStr of dateStrings) {
                    if ((_b = wallets[gameId]) === null || _b === void 0 ? void 0 : _b[dateStr]) {
                        if (!gameMap.has(gameId)) {
                            gameMap.set(gameId, {
                                gameId,
                                initializations: 0,
                                walletConnections: 0,
                                registrations: 0,
                                scoreSubmissions: 0,
                                uniqueWallets: 0,
                                splEvents: 0,
                                solEvents: 0,
                            });
                        }
                        gameMap.get(gameId).uniqueWallets += Object.keys(wallets[gameId][dateStr]).length;
                    }
                }
            }
        }
        return Array.from(gameMap.values())
            .sort((a, b) => (b.initializations + b.walletConnections) - (a.initializations + a.walletConnections))
            .slice(0, limit);
    });
}
/**
 * Get games with issues (high error rates)
 * OPTIMIZED: Fetch daily data once, process in memory
 */
function getGamesWithIssues(days, minErrorRate) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        // Generate all date strings upfront
        const dateStrings = [];
        const currentDate = new Date(startDate);
        while (currentDate <= endDate) {
            dateStrings.push(getDateString(currentDate.getTime()));
            currentDate.setDate(currentDate.getDate() + 1);
        }
        const gameMap = new Map();
        // Fetch daily data ONCE (not in loop)
        const dailySnapshot = yield (0, database_1.get)((0, database_1.ref)(firebase_1.db, `analytics/daily`)).catch((error) => {
            var _a;
            if (error.code === 'PERMISSION_DENIED' || ((_a = error.message) === null || _a === void 0 ? void 0 : _a.includes('Permission denied'))) {
                console.warn(`[Analytics] Permission denied for analytics/daily`);
            }
            else {
                console.error(`[Analytics] Error reading daily data for issues:`, error);
            }
            return null;
        });
        // Process daily data for all dates
        if (dailySnapshot === null || dailySnapshot === void 0 ? void 0 : dailySnapshot.exists()) {
            const games = dailySnapshot.val();
            for (const gameId in games) {
                for (const dateStr of dateStrings) {
                    if ((_a = games[gameId]) === null || _a === void 0 ? void 0 : _a[dateStr]) {
                        const data = games[gameId][dateStr];
                        if (!gameMap.has(gameId)) {
                            gameMap.set(gameId, {
                                gameId,
                                totalInits: 0,
                                initFailures: 0,
                                walletConnections: 0,
                                walletFailures: 0,
                                initErrorRate: 0,
                                walletErrorRate: 0,
                            });
                        }
                        const game = gameMap.get(gameId);
                        game.totalInits += (data.initializations || 0) + (data.initFailures || 0);
                        game.initFailures += data.initFailures || 0;
                        game.walletConnections += (data.walletConnections || 0) + (data.walletFailures || 0);
                        game.walletFailures += data.walletFailures || 0;
                    }
                }
            }
        }
        // Calculate error rates and filter
        const issues = [];
        for (const [gameId, game] of gameMap.entries()) {
            game.initErrorRate = game.totalInits > 0
                ? (game.initFailures / game.totalInits) * 100
                : 0;
            game.walletErrorRate = game.walletConnections > 0
                ? (game.walletFailures / game.walletConnections) * 100
                : 0;
            if (game.initErrorRate >= minErrorRate || game.walletErrorRate >= minErrorRate) {
                issues.push(game);
            }
        }
        return issues.sort((a, b) => Math.max(b.initErrorRate, b.walletErrorRate) - Math.max(a.initErrorRate, a.walletErrorRate));
    });
}
//# sourceMappingURL=analyticsService.js.map