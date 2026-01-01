// src/analytics/analyticsService.ts

import { ref, get, set, update } from 'firebase/database';
import { db } from '../config/firebase';
import * as crypto from 'crypto';

// ============================================
// Types and Interfaces
// ============================================

export interface AnalyticsEvent {
  eventName: string;
  eventData?: Record<string, any>;
  sdkVersion?: string;
  unityVersion?: string;
  platform?: string;        // Android, iOS, Editor, WebGL
  osVersion?: string;
  environment?: string;     // Devnet, Mainnet
  tokenType?: 'SPL' | 'SOL';
  sessionId?: string;
  walletAddress?: string;
  clientTimestamp?: number;
}

interface DailyAggregates {
  initializations: number;
  initFailures: number;
  walletConnections: number;
  walletFailures: number;
  registrations: number;
  registrationFailures: number;
  scoreSubmissions: number;
  scoreFailures: number;
  uniqueSessions: number;
  uniqueWallets: number;
  splEvents: number;
  solEvents: number;
  lastUpdated: number;
}

interface PlatformDailyAggregates {
  totalInitializations: number;
  totalInitFailures: number;
  totalWalletConnections: number;
  totalWalletFailures: number;
  totalRegistrations: number;
  totalRegistrationFailures: number;
  totalScoreSubmissions: number;
  totalScoreFailures: number;
  totalUniqueSessions: number;
  totalUniqueWallets: number;
  activeGames: number;
  splEvents: number;
  solEvents: number;
  lastUpdated: number;
}

interface ErrorData {
  eventName: string;
  errorMessage: string;
  errorType: string;
  totalCount: number;
  firstOccurred: number;
  lastOccurred: number;
}

interface VersionData {
  sdkVersion: string;
  totalEvents: number;
  gamesUsing: number;
  percentage: number;
}

interface GameSummary {
  summary: {
    totalInitializations: number;
    totalInitFailures: number;
    totalWalletConnections: number;
    totalWalletFailures: number;
    totalRegistrations: number;
    totalRegistrationFailures: number;
    totalScoreSubmissions: number;
    totalScoreFailures: number;
    totalSessions: number;
    totalWallets: number;
    splEvents: number;
    solEvents: number;
  };
  period: {
    days: number;
    startDate: string;
    endDate: string;
  };
}

interface TrendData {
  date: string;
  initializations: number;
  initFailures: number;
  walletConnections: number;
  walletFailures: number;
  registrations: number;
  registrationFailures: number;
  scoreSubmissions: number;
  scoreFailures: number;
  uniqueSessions: number;
  uniqueWallets: number;
  splEvents: number;
  solEvents: number;
}

interface PlatformSummary {
  summary: {
    totalInitializations: number;
    totalInitFailures: number;
    totalWalletConnections: number;
    totalWalletFailures: number;
    totalRegistrations: number;
    totalRegistrationFailures: number;
    totalScoreSubmissions: number;
    totalScoreFailures: number;
    totalSessions: number;
    totalWallets: number;
    activeGames: number;
    splEvents: number;
    solEvents: number;
  };
  period: {
    days: number;
    startDate: string;
    endDate: string;
  };
}

interface GameLeaderboard {
  gameId: string;
  initializations: number;
  walletConnections: number;
  registrations: number;
  scoreSubmissions: number;
  uniqueWallets: number;
  splEvents: number;
  solEvents: number;
}

interface GameIssue {
  gameId: string;
  totalInits: number;
  initFailures: number;
  walletConnections: number;
  walletFailures: number;
  initErrorRate: number;
  walletErrorRate: number;
}

// ============================================
// Event to Stat Mapping
// ============================================

const EVENT_TO_STAT_MAP: Record<string, keyof DailyAggregates> = {
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
function getDateString(timestamp?: number): string {
  const date = timestamp ? new Date(timestamp) : new Date();
  return date.toISOString().split('T')[0];
}

/**
 * Truncate wallet address to first 4 and last 4 characters
 */
function truncateWallet(walletAddress?: string): string | null {
  if (!walletAddress || walletAddress.length < 9) return walletAddress || null;
  return `${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}`;
}

/**
 * Generate MD5 hash for error grouping
 */
function hashError(eventName: string, errorMessage: string): string {
  return crypto.createHash('md5').update(`${eventName}:${errorMessage}`).digest('hex');
}

/**
 * Generate unique event ID
 */
function generateEventId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// ============================================
// Event Tracking Functions
// ============================================

/**
 * Track a single analytics event
 */
export async function trackEvent(gameId: string, event: AnalyticsEvent): Promise<void> {
  try {
    const date = getDateString(event.clientTimestamp);
    const eventId = generateEventId();
    const serverTimestamp = Date.now();

    // Prepare event data for storage
    // Remove undefined values as Firebase doesn't allow them
    const eventData: any = {
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
    const eventRef = ref(db, `analytics/events/${gameId}/${eventId}`);
    await set(eventRef, eventData);

    // Update aggregates
    await updateDailyAggregates(gameId, date, event);
    await updatePlatformDailyAggregates(date, event);

    // Track unique sessions
    if (event.sessionId) {
      await trackSession(gameId, date, event.sessionId);
    }

    // Track unique wallets
    if (event.walletAddress) {
      await trackUniqueWallet(gameId, date, event.walletAddress);
    }

    // Track errors
    if (event.eventName.includes('_failed') || event.eventName.includes('_error')) {
      await trackError(gameId, date, event);
    }

    // Track SDK version
    if (event.sdkVersion) {
      await trackVersion(date, event.sdkVersion, gameId);
    }
  } catch (error) {
    console.error('[Analytics] Error tracking event:', error);
    throw error;
  }
}

/**
 * Track a batch of events (max 100)
 */
export async function trackBatchEvents(gameId: string, events: AnalyticsEvent[]): Promise<number> {
  if (events.length > 100) {
    throw new Error('Batch size cannot exceed 100 events');
  }

  let successCount = 0;
  const errors: Error[] = [];

  // Process events in parallel but track failures
  await Promise.allSettled(
    events.map(async (event) => {
      try {
        await trackEvent(gameId, event);
        successCount++;
      } catch (error) {
        errors.push(error as Error);
      }
    })
  );

  if (errors.length > 0) {
    console.error(`[Analytics] ${errors.length} events failed in batch:`, errors);
  }

  return successCount;
}

// ============================================
// Aggregation Functions
// ============================================

/**
 * Update daily aggregates for a specific game
 */
async function updateDailyAggregates(gameId: string, date: string, event: AnalyticsEvent): Promise<void> {
  const dailyRef = ref(db, `analytics/daily/${gameId}/${date}`);
  const snapshot = await get(dailyRef);

  // Get current data or initialize defaults
  let current: DailyAggregates;
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
    await set(dailyRef, current);
  } else {
    current = snapshot.val() as DailyAggregates;
  }

  const statKey = EVENT_TO_STAT_MAP[event.eventName];
  const updates: any = {
    lastUpdated: Date.now(),
  };

  // Increment event counter if mapped
  if (statKey) {
    updates[statKey] = (current[statKey] || 0) + 1;
  }

  // Track token type
  if (event.tokenType === 'SPL') {
    updates.splEvents = (current.splEvents || 0) + 1;
  } else if (event.tokenType === 'SOL') {
    updates.solEvents = (current.solEvents || 0) + 1;
  }

  // Apply updates
  await update(dailyRef, updates);
}

/**
 * Update platform-wide daily aggregates
 */
async function updatePlatformDailyAggregates(date: string, event: AnalyticsEvent): Promise<void> {
  const platformRef = ref(db, `analytics/platformDaily/${date}`);
  const snapshot = await get(platformRef);

  // Get current data or initialize defaults
  let current: PlatformDailyAggregates;
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
    await set(platformRef, current);
  } else {
    current = snapshot.val() as PlatformDailyAggregates;
  }

  const statKey = EVENT_TO_STAT_MAP[event.eventName];
  const updates: any = {
    lastUpdated: Date.now(),
  };

  // Increment event counter if mapped
  if (statKey) {
    const platformKey = `total${statKey.charAt(0).toUpperCase() + statKey.slice(1)}` as keyof PlatformDailyAggregates;
    updates[platformKey] = (current[platformKey] || 0) + 1;
  }

  // Track token type
  if (event.tokenType === 'SPL') {
    updates.splEvents = (current.splEvents || 0) + 1;
  } else if (event.tokenType === 'SOL') {
    updates.solEvents = (current.solEvents || 0) + 1;
  }

  // Apply updates
  await update(platformRef, updates);
}

/**
 * Track unique session
 */
async function trackSession(gameId: string, date: string, sessionId: string): Promise<void> {
  const sessionRef = ref(db, `analytics/sessions/${gameId}/${date}/${sessionId}`);
  const snapshot = await get(sessionRef);

  if (!snapshot.exists()) {
    await set(sessionRef, {
      firstSeen: Date.now(),
      lastSeen: Date.now(),
    });
  } else {
    await update(sessionRef, {
      lastSeen: Date.now(),
    });
  }
}

/**
 * Track unique wallet
 */
async function trackUniqueWallet(gameId: string, date: string, walletAddress: string): Promise<void> {
  const truncated = truncateWallet(walletAddress);
  if (!truncated || truncated === null) return;

  const walletHash = crypto.createHash('md5').update(truncated).digest('hex');
  const walletRef = ref(db, `analytics/wallets/${gameId}/${date}/${walletHash}`);
  const snapshot = await get(walletRef);

  if (!snapshot.exists()) {
    await set(walletRef, {
      walletAddress: truncated,
      firstSeen: Date.now(),
      lastSeen: Date.now(),
    });
  } else {
    await update(walletRef, {
      lastSeen: Date.now(),
    });
  }
}

/**
 * Track error occurrence
 */
async function trackError(gameId: string, date: string, event: AnalyticsEvent): Promise<void> {
  if (!event.eventData?.error) return;

  const errorMessage = typeof event.eventData.error === 'string' 
    ? event.eventData.error 
    : JSON.stringify(event.eventData.error);
  const errorHash = hashError(event.eventName, errorMessage);
  const errorRef = ref(db, `analytics/errors/${gameId}/${date}/${errorHash}`);
  const snapshot = await get(errorRef);

  const errorType = event.eventData.errorType || 'unknown';
  const timestamp = Date.now();

  if (!snapshot.exists()) {
    await set(errorRef, {
      eventName: event.eventName,
      errorMessage,
      errorType,
      count: 1,
      firstOccurred: timestamp,
      lastOccurred: timestamp,
    });
  } else {
    const current = snapshot.val();
    await update(errorRef, {
      count: (current.count || 0) + 1,
      lastOccurred: timestamp,
    });
  }
}

/**
 * Track SDK version usage
 */
async function trackVersion(date: string, sdkVersion: string, gameId: string): Promise<void> {
  const versionRef = ref(db, `analytics/versions/${date}/${sdkVersion}`);
  const snapshot = await get(versionRef);

  if (!snapshot.exists()) {
    await set(versionRef, {
      totalEvents: 1,
      gamesUsing: 1,
      gamesList: {
        [gameId]: true,
      },
    });
  } else {
    const current = snapshot.val();
    const gamesList = current.gamesList || {};
    const isNewGame = !gamesList[gameId];

    await update(versionRef, {
      totalEvents: (current.totalEvents || 0) + 1,
      gamesUsing: isNewGame ? (current.gamesUsing || 0) + 1 : current.gamesUsing,
      [`gamesList/${gameId}`]: true,
    });
  }
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
export async function getGameSummary(gameId: string, days: number): Promise<GameSummary> {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const summary: GameSummary['summary'] = {
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
  const dateStrings: string[] = [];
  const currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    dateStrings.push(getDateString(currentDate.getTime()));
    currentDate.setDate(currentDate.getDate() + 1);
  }

  // Fetch all daily data in parallel
  const dailyPromises = dateStrings.map((dateStr): Promise<any> => {
    const dailyRef = ref(db, `analytics/daily/${gameId}/${dateStr}`);
    return get(dailyRef).catch((error: any): any => {
      if (error.code === 'PERMISSION_DENIED' || error.message?.includes('Permission denied')) {
        console.warn(`[Analytics] Permission denied for analytics/daily/${gameId}/${dateStr}`);
      } else {
        console.error(`[Analytics] Error reading daily data for ${dateStr}:`, error);
      }
      return null;
    });
  });

  // Fetch sessions and wallets ONCE (not in loop)
  const [sessionsSnapshot, walletsSnapshot, ...dailySnapshots] = await Promise.all([
    get(ref(db, `analytics/sessions/${gameId}`)).catch((error: any): any => {
      if (error.code === 'PERMISSION_DENIED' || error.message?.includes('Permission denied')) {
        console.warn(`[Analytics] Permission denied for analytics/sessions/${gameId}`);
      } else {
        console.error(`[Analytics] Error reading sessions:`, error);
      }
      return null;
    }),
    get(ref(db, `analytics/wallets/${gameId}`)).catch((error: any): any => {
      if (error.code === 'PERMISSION_DENIED' || error.message?.includes('Permission denied')) {
        console.warn(`[Analytics] Permission denied for analytics/wallets/${gameId}`);
      } else {
        console.error(`[Analytics] Error reading wallets:`, error);
      }
      return null;
    }),
    ...dailyPromises,
  ]);

  // Process daily data
  dailySnapshots.forEach((snapshot) => {
    if (snapshot?.exists()) {
      const data = snapshot.val() as DailyAggregates;
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
  if (sessionsSnapshot?.exists()) {
    const sessions = sessionsSnapshot.val();
    for (const dateStr of dateStrings) {
      if (sessions[dateStr]) {
        summary.totalSessions += Object.keys(sessions[dateStr]).length;
      }
    }
  }

  if (walletsSnapshot?.exists()) {
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
}

/**
 * Get game trends for a date range
 * OPTIMIZED: Parallel queries and single fetch for sessions/wallets
 */
export async function getGameTrends(gameId: string, days: number): Promise<TrendData[]> {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  // Generate all date strings upfront
  const dateStrings: string[] = [];
  const currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    dateStrings.push(getDateString(currentDate.getTime()));
    currentDate.setDate(currentDate.getDate() + 1);
  }

  // Fetch all daily data in parallel
  const dailyPromises = dateStrings.map((dateStr): Promise<any> => {
    const dailyRef = ref(db, `analytics/daily/${gameId}/${dateStr}`);
    return get(dailyRef).catch((error: any): any => {
      if (error.code === 'PERMISSION_DENIED' || error.message?.includes('Permission denied')) {
        console.warn(`[Analytics] Permission denied for analytics/daily/${gameId}/${dateStr}`);
      } else {
        console.error(`[Analytics] Error reading daily trends for ${dateStr}:`, error);
      }
      return null;
    });
  });

  // Fetch sessions and wallets ONCE (not in loop)
  const [sessionsSnapshot, walletsSnapshot, ...dailySnapshots] = await Promise.all([
    get(ref(db, `analytics/sessions/${gameId}`)).catch((error: any): any => {
      if (error.code === 'PERMISSION_DENIED' || error.message?.includes('Permission denied')) {
        console.warn(`[Analytics] Permission denied for analytics/sessions/${gameId}`);
      } else {
        console.error(`[Analytics] Error reading sessions:`, error);
      }
      return null;
    }),
    get(ref(db, `analytics/wallets/${gameId}`)).catch((error: any): any => {
      if (error.code === 'PERMISSION_DENIED' || error.message?.includes('Permission denied')) {
        console.warn(`[Analytics] Permission denied for analytics/wallets/${gameId}`);
      } else {
        console.error(`[Analytics] Error reading wallets:`, error);
      }
      return null;
    }),
    ...dailyPromises,
  ]);

  // Pre-process sessions and wallets data for quick lookup
  const sessionsData = sessionsSnapshot?.exists() ? sessionsSnapshot.val() : {};
  const walletsData = walletsSnapshot?.exists() ? walletsSnapshot.val() : {};

  // Build trends array
  const trends: TrendData[] = dateStrings.map((dateStr, index) => {
    const trend: TrendData = {
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
    if (snapshot?.exists()) {
      const data = snapshot.val() as DailyAggregates;
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
}

/**
 * Get game errors for a date range
 * OPTIMIZED: Parallel queries
 */
export async function getGameErrors(gameId: string, days: number): Promise<ErrorData[]> {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const errorMap = new Map<string, ErrorData>();

  // Generate all date strings upfront
  const dateStrings: string[] = [];
  const currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    dateStrings.push(getDateString(currentDate.getTime()));
    currentDate.setDate(currentDate.getDate() + 1);
  }

  // Fetch all error data in parallel
  const errorPromises = dateStrings.map((dateStr): Promise<any> => {
    const errorsRef = ref(db, `analytics/errors/${gameId}/${dateStr}`);
    return get(errorsRef).catch((error: any): any => {
      if (error.code === 'PERMISSION_DENIED' || error.message?.includes('Permission denied')) {
        console.warn(`[Analytics] Permission denied for analytics/errors/${gameId}/${dateStr}`);
      } else {
        console.error(`[Analytics] Error reading errors for ${dateStr}:`, error);
      }
      return null;
    });
  });

  const errorSnapshots = await Promise.all(errorPromises);

  // Process all error data
  errorSnapshots.forEach((snapshot) => {
    if (snapshot?.exists()) {
      const errors = snapshot.val();
      if (errors && typeof errors === 'object') {
        for (const errorHash in errors) {
          const error = errors[errorHash];
          if (!error || typeof error !== 'object') {
            continue;
          }
          
          const key = `${error.eventName || 'unknown'}:${error.errorMessage || 'unknown'}`;

          if (errorMap.has(key)) {
            const existing = errorMap.get(key)!;
            existing.totalCount += error.count || 0;
            existing.lastOccurred = Math.max(existing.lastOccurred, error.lastOccurred || 0);
          } else {
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
}

/**
 * Get game SDK versions for a date range
 * OPTIMIZED: Parallel queries
 */
export async function getGameVersions(gameId: string, days: number): Promise<VersionData[]> {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const versionMap = new Map<string, { totalEvents: number; gamesUsing: Set<string> }>();

  // Generate all date strings upfront
  const dateStrings: string[] = [];
  const currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    dateStrings.push(getDateString(currentDate.getTime()));
    currentDate.setDate(currentDate.getDate() + 1);
  }

  // Fetch all version data in parallel
  const versionPromises = dateStrings.map((dateStr): Promise<any> => {
    const versionsRef = ref(db, `analytics/versions/${dateStr}`);
    return get(versionsRef).catch((error: any): any => {
      if (error.code === 'PERMISSION_DENIED' || error.message?.includes('Permission denied')) {
        console.warn(`[Analytics] Permission denied for analytics/versions/${dateStr}`);
      } else {
        console.error(`[Analytics] Error reading versions for ${dateStr}:`, error);
      }
      return null;
    });
  });

  const versionSnapshots = await Promise.all(versionPromises);

  // Process all version data
  versionSnapshots.forEach((snapshot) => {
    if (snapshot?.exists()) {
      const versions = snapshot.val();
      for (const sdkVersion in versions) {
        const version = versions[sdkVersion];
        if (version.gamesList && version.gamesList[gameId]) {
          if (versionMap.has(sdkVersion)) {
            const existing = versionMap.get(sdkVersion)!;
            existing.totalEvents += version.totalEvents || 0;
            existing.gamesUsing.add(gameId);
          } else {
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
}

// ============================================
// Admin Query Functions
// ============================================

/**
 * Get platform summary for a date range
 * OPTIMIZED: Parallel queries and single fetch for sessions/wallets
 */
export async function getPlatformSummary(days: number): Promise<PlatformSummary> {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const summary: PlatformSummary['summary'] = {
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

  const activeGamesSet = new Set<string>();
  
  // Generate all date strings upfront
  const dateStrings: string[] = [];
  const currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    dateStrings.push(getDateString(currentDate.getTime()));
    currentDate.setDate(currentDate.getDate() + 1);
  }

  // Fetch all platform daily data in parallel
  const platformPromises = dateStrings.map((dateStr): Promise<any> => {
    const platformRef = ref(db, `analytics/platformDaily/${dateStr}`);
    return get(platformRef).catch((error: any): any => {
      if (error.code === 'PERMISSION_DENIED' || error.message?.includes('Permission denied')) {
        console.warn(`[Analytics] Permission denied for analytics/platformDaily/${dateStr}`);
      } else {
        console.error(`[Analytics] Error reading platform daily data for ${dateStr}:`, error);
      }
      return null;
    });
  });

  // Fetch sessions and wallets ONCE (not in loop)
  const [sessionsSnapshot, walletsSnapshot, ...platformSnapshots] = await Promise.all([
    get(ref(db, `analytics/sessions`)).catch((error: any): any => {
      if (error.code === 'PERMISSION_DENIED' || error.message?.includes('Permission denied')) {
        console.warn(`[Analytics] Permission denied for analytics/sessions`);
      } else {
        console.error(`[Analytics] Error reading sessions:`, error);
      }
      return null;
    }),
    get(ref(db, `analytics/wallets`)).catch((error: any): any => {
      if (error.code === 'PERMISSION_DENIED' || error.message?.includes('Permission denied')) {
        console.warn(`[Analytics] Permission denied for analytics/wallets`);
      } else {
        console.error(`[Analytics] Error reading wallets:`, error);
      }
      return null;
    }),
    ...platformPromises,
  ]);

  // Process platform daily data
  platformSnapshots.forEach((snapshot, index) => {
    if (snapshot?.exists()) {
      const data = snapshot.val() as PlatformDailyAggregates;
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
  if (sessionsSnapshot?.exists()) {
    const sessions = sessionsSnapshot.val();
    for (const gameId in sessions) {
      activeGamesSet.add(gameId);
      for (const dateStr of dateStrings) {
        if (sessions[gameId]?.[dateStr]) {
          summary.totalSessions += Object.keys(sessions[gameId][dateStr]).length;
        }
      }
    }
  }

  if (walletsSnapshot?.exists()) {
    const wallets = walletsSnapshot.val();
    for (const gameId in wallets) {
      activeGamesSet.add(gameId);
      for (const dateStr of dateStrings) {
        if (wallets[gameId]?.[dateStr]) {
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
}

/**
 * Get platform trends for a date range
 * OPTIMIZED: Parallel queries and single fetch for sessions/wallets
 */
export async function getPlatformTrends(days: number): Promise<TrendData[]> {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  // Generate all date strings upfront
  const dateStrings: string[] = [];
  const currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    dateStrings.push(getDateString(currentDate.getTime()));
    currentDate.setDate(currentDate.getDate() + 1);
  }

  // Fetch all platform daily data in parallel
  const platformPromises = dateStrings.map((dateStr): Promise<any> => {
    const platformRef = ref(db, `analytics/platformDaily/${dateStr}`);
    return get(platformRef).catch((error: any): any => {
      if (error.code === 'PERMISSION_DENIED' || error.message?.includes('Permission denied')) {
        console.warn(`[Analytics] Permission denied for analytics/platformDaily/${dateStr}`);
      } else {
        console.error(`[Analytics] Error reading platform trends for ${dateStr}:`, error);
      }
      return null;
    });
  });

  // Fetch sessions and wallets ONCE (not in loop)
  const [sessionsSnapshot, walletsSnapshot, ...platformSnapshots] = await Promise.all([
    get(ref(db, `analytics/sessions`)).catch((error: any): any => {
      if (error.code === 'PERMISSION_DENIED' || error.message?.includes('Permission denied')) {
        console.warn(`[Analytics] Permission denied for analytics/sessions`);
      } else {
        console.error(`[Analytics] Error reading sessions:`, error);
      }
      return null;
    }),
    get(ref(db, `analytics/wallets`)).catch((error: any): any => {
      if (error.code === 'PERMISSION_DENIED' || error.message?.includes('Permission denied')) {
        console.warn(`[Analytics] Permission denied for analytics/wallets`);
      } else {
        console.error(`[Analytics] Error reading wallets:`, error);
      }
      return null;
    }),
    ...platformPromises,
  ]);

  // Pre-process sessions and wallets data for quick lookup
  const sessionsData = sessionsSnapshot?.exists() ? sessionsSnapshot.val() : {};
  const walletsData = walletsSnapshot?.exists() ? walletsSnapshot.val() : {};

  // Build trends array
  const trends: TrendData[] = dateStrings.map((dateStr, index) => {
    const trend: TrendData = {
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
    if (snapshot?.exists()) {
      const data = snapshot.val() as PlatformDailyAggregates;
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
      if (sessionsData[gameId]?.[dateStr]) {
        sessionCount += Object.keys(sessionsData[gameId][dateStr]).length;
      }
    }
    trend.uniqueSessions = sessionCount;

    let walletCount = 0;
    for (const gameId in walletsData) {
      if (walletsData[gameId]?.[dateStr]) {
        walletCount += Object.keys(walletsData[gameId][dateStr]).length;
      }
    }
    trend.uniqueWallets = walletCount;

    return trend;
  });

  return trends;
}

/**
 * Get platform SDK versions for a date range
 * OPTIMIZED: Parallel queries for all dates
 */
export async function getPlatformVersions(days: number): Promise<VersionData[]> {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const versionMap = new Map<string, { totalEvents: number; gamesUsing: Set<string> }>();
  
  // Generate all date strings upfront
  const dateStrings: string[] = [];
  const currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    dateStrings.push(getDateString(currentDate.getTime()));
    currentDate.setDate(currentDate.getDate() + 1);
  }

  // Fetch all version data in parallel
  const versionPromises = dateStrings.map((dateStr): Promise<any> => {
    const versionsRef = ref(db, `analytics/versions/${dateStr}`);
    return get(versionsRef).catch((error: any): any => {
      if (error.code === 'PERMISSION_DENIED' || error.message?.includes('Permission denied')) {
        console.warn(`[Analytics] Permission denied for analytics/versions/${dateStr}`);
      } else {
        console.error(`[Analytics] Error reading versions for ${dateStr}:`, error);
      }
      return null;
    });
  });

  const versionSnapshots = await Promise.all(versionPromises);

  // Process all snapshots
  versionSnapshots.forEach(snapshot => {
    if (snapshot?.exists()) {
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
            const existing = versionMap.get(sdkVersion)!;
            existing.totalEvents += totalEvents;
            if (gamesList && typeof gamesList === 'object') {
              Object.keys(gamesList).forEach(gameId => existing.gamesUsing.add(gameId));
            }
          } else {
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
    const totalEvents = Array.from(versionMap.values()).reduce((sum, v) => sum + (v?.totalEvents || 0), 0);

    return Array.from(versionMap.entries())
      .map(([sdkVersion, data]) => {
        if (!data || typeof data !== 'object') {
          return null;
        }
        return {
          sdkVersion,
          totalEvents: data.totalEvents || 0,
          gamesUsing: data.gamesUsing?.size || 0,
          percentage: totalEvents > 0 ? Math.round(((data.totalEvents || 0) / totalEvents) * 100) : 0,
        };
      })
      .filter((item): item is VersionData => item !== null)
      .sort((a, b) => b.totalEvents - a.totalEvents);
  } catch (error: any) {
    console.error('[Analytics] Error processing platform versions:', error);
    return []; // Return empty array on processing error
  }
}

/**
 * Get games leaderboard
 * OPTIMIZED: Fetch daily and wallets data once, process in memory
 */
export async function getGamesLeaderboard(days: number, limit: number): Promise<GameLeaderboard[]> {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  // Generate all date strings upfront
  const dateStrings: string[] = [];
  const currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    dateStrings.push(getDateString(currentDate.getTime()));
    currentDate.setDate(currentDate.getDate() + 1);
  }

  const gameMap = new Map<string, GameLeaderboard>();

  // Fetch daily and wallets data ONCE (not in loop)
  const [dailySnapshot, walletsSnapshot] = await Promise.all([
    get(ref(db, `analytics/daily`)).catch((error: any): any => {
      if (error.code === 'PERMISSION_DENIED' || error.message?.includes('Permission denied')) {
        console.warn(`[Analytics] Permission denied for analytics/daily`);
      } else {
        console.error(`[Analytics] Error reading daily data for leaderboard:`, error);
      }
      return null;
    }),
    get(ref(db, `analytics/wallets`)).catch((error: any): any => {
      if (error.code === 'PERMISSION_DENIED' || error.message?.includes('Permission denied')) {
        console.warn(`[Analytics] Permission denied for analytics/wallets`);
      } else {
        console.error(`[Analytics] Error reading wallets for leaderboard:`, error);
      }
      return null;
    }),
  ]);

  // Process daily data for all dates
  if (dailySnapshot?.exists()) {
    const games = dailySnapshot.val();
    for (const gameId in games) {
      for (const dateStr of dateStrings) {
        if (games[gameId]?.[dateStr]) {
          const data = games[gameId][dateStr] as DailyAggregates;

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

          const game = gameMap.get(gameId)!;
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
  if (walletsSnapshot?.exists()) {
    const wallets = walletsSnapshot.val();
    for (const gameId in wallets) {
      for (const dateStr of dateStrings) {
        if (wallets[gameId]?.[dateStr]) {
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
          gameMap.get(gameId)!.uniqueWallets += Object.keys(wallets[gameId][dateStr]).length;
        }
      }
    }
  }

  return Array.from(gameMap.values())
    .sort((a, b) => (b.initializations + b.walletConnections) - (a.initializations + a.walletConnections))
    .slice(0, limit);
}

/**
 * Get games with issues (high error rates)
 * OPTIMIZED: Fetch daily data once, process in memory
 */
export async function getGamesWithIssues(days: number, minErrorRate: number): Promise<GameIssue[]> {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  // Generate all date strings upfront
  const dateStrings: string[] = [];
  const currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    dateStrings.push(getDateString(currentDate.getTime()));
    currentDate.setDate(currentDate.getDate() + 1);
  }

  const gameMap = new Map<string, GameIssue>();

  // Fetch daily data ONCE (not in loop)
  const dailySnapshot = await get(ref(db, `analytics/daily`)).catch((error: any): any => {
    if (error.code === 'PERMISSION_DENIED' || error.message?.includes('Permission denied')) {
      console.warn(`[Analytics] Permission denied for analytics/daily`);
    } else {
      console.error(`[Analytics] Error reading daily data for issues:`, error);
    }
    return null;
  });

  // Process daily data for all dates
  if (dailySnapshot?.exists()) {
    const games = dailySnapshot.val();
    for (const gameId in games) {
      for (const dateStr of dateStrings) {
        if (games[gameId]?.[dateStr]) {
          const data = games[gameId][dateStr] as DailyAggregates;

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

          const game = gameMap.get(gameId)!;
          game.totalInits += (data.initializations || 0) + (data.initFailures || 0);
          game.initFailures += data.initFailures || 0;
          game.walletConnections += (data.walletConnections || 0) + (data.walletFailures || 0);
          game.walletFailures += data.walletFailures || 0;
        }
      }
    }
  }

  // Calculate error rates and filter
  const issues: GameIssue[] = [];
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
}

