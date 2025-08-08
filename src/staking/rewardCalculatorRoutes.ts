// src/staking/rewardCalculatorRoutes.ts
// API Routes for Phase 1 Reward Calculator

import { Router, RequestHandler } from 'express';
import {
  calculateProjectedRewardsController,
  getPoolStateController,
  getLockPeriodOptionsController,
  compareLockPeriodsController,
  getCurrentStakersController,
} from './rewardCalculatorController';

const router = Router();

/**
 * POST /api/rewards/calculate
 * Calculate projected rewards for a potential staker
 * 
 * Body: {
 *   stakedAmount: number,        // Amount to stake
 *   lockPeriodDays: number,      // Lock period in days (30, 90, 180, 365)
 *   simulatedRevenueAmount?: number  // Optional: simulate specific revenue amount
 * }
 */
router.post('/calculate', calculateProjectedRewardsController as unknown as RequestHandler);

/**
 * GET /api/rewards/pool-state
 * Get current staking pool state and metrics
 */
router.get('/pool-state', getPoolStateController as unknown as RequestHandler);

/**
 * GET /api/rewards/lock-options
 * Get available lock period options with multipliers
 */
router.get('/lock-options', getLockPeriodOptionsController as unknown as RequestHandler);

/**
 * POST /api/rewards/compare
 * Compare rewards for different lock periods with the same stake amount
 * 
 * Body: {
 *   stakedAmount: number,            // Amount to stake
 *   simulatedRevenueAmount?: number  // Optional: simulate specific revenue amount
 * }
 */
router.post('/compare', compareLockPeriodsController as unknown as RequestHandler);

/**
 * GET /api/rewards/current-stakers
 * Get information about current stakers (for admin/analytics)
 */
router.get('/current-stakers', getCurrentStakersController as unknown as RequestHandler);

export default router;