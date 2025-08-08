// src/staking/rewardCalculatorController.ts
// API Controllers for Phase 1 Reward Calculator

import { Request, Response } from "express";
import {
  calculateProjectedRewards,
  getCurrentPoolState,
  getCurrentStakers,
  getLockPeriodOptions,
  validateStakingInput,
  formatTokenAmount,
  formatPercentage,
  ProjectedRewardInput,
} from "./rewardCalculationService";

/**
 * Calculate projected rewards for a potential staker
 * POST /api/staking/calculate-projected-rewards
 * Body: { stakedAmount: number, lockPeriodDays: number, simulatedRevenueAmount?: number }
 */
export const calculateProjectedRewardsController = async (req: Request, res: Response) => {
  try {
    const { stakedAmount, lockPeriodDays, simulatedRevenueAmount } = req.body;

    // Validate input
    const input: ProjectedRewardInput = {
      stakedAmount: parseFloat(stakedAmount),
      lockPeriodDays: parseInt(lockPeriodDays),
      simulatedRevenueAmount: simulatedRevenueAmount ? parseFloat(simulatedRevenueAmount) : undefined,
    };

    const validationErrors = validateStakingInput(input);
    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid input parameters",
        errors: validationErrors,
      });
    }

    // Calculate projected rewards
    const projectedRewards = await calculateProjectedRewards(input);

    // Format the response for frontend consumption
    const formattedResponse = {
      success: true,
      data: {
        // User's staking position
        userStake: {
          amount: formatTokenAmount(input.stakedAmount),
          lockPeriod: `${input.lockPeriodDays} days`,
          multiplier: `${projectedRewards.userMultiplier}x`,
          weightedStake: formatTokenAmount(projectedRewards.userWeightedStake),
        },

        // Pool impact
        poolImpact: {
          currentTotalStaked: formatTokenAmount(projectedRewards.newTotalStaked - input.stakedAmount),
          newTotalStaked: formatTokenAmount(projectedRewards.newTotalStaked),
          currentTotalWeighted: formatTokenAmount(projectedRewards.newTotalWeightedStake - projectedRewards.userWeightedStake),
          newTotalWeighted: formatTokenAmount(projectedRewards.newTotalWeightedStake),
          userSharePercentage: formatPercentage(projectedRewards.userSharePercentage),
        },

        // Reward projections
        rewardProjections: {
          rewardPerEvent: formatTokenAmount(projectedRewards.rewardPerEvent),
          estimatedMonthlyRewards: formatTokenAmount(projectedRewards.historicalContext.estimatedMonthlyRewards),
          annualizedAPY: formatPercentage(projectedRewards.annualizedAPY),
          earlyStakerAdvantage: projectedRewards.earlyStakerAdvantage,
        },

        // Breakdown for transparency
        breakdown: {
          baseStake: formatTokenAmount(projectedRewards.breakdown.baseStake),
          appliedMultiplier: `${projectedRewards.breakdown.appliedMultiplier}x`,
          resultingWeightedStake: formatTokenAmount(projectedRewards.breakdown.resultingWeightedStake),
          shareOfPool: formatPercentage(projectedRewards.breakdown.shareOfPool),
        },

        // Historical context
        historicalContext: {
          averageRevenuePerEvent: formatTokenAmount(projectedRewards.historicalContext.averageRevenuePerEvent),
          eventsPerMonth: projectedRewards.historicalContext.eventsPerMonth,
          totalHistoricalEvents: 3, // From your document examples
        },

        // Calculation metadata
        calculatedAt: new Date().toISOString(),
        basedOnSimulation: !!input.simulatedRevenueAmount,
      },
    };

    res.json(formattedResponse);
  } catch (error) {
    console.error("❌ Error in calculateProjectedRewardsController:", error);
    res.status(500).json({
      success: false,
      message: "Failed to calculate projected rewards",
      error: error.message,
    });
  }
};

/**
 * Get current pool state and metrics
 * GET /api/staking/pool-state
 */
export const getPoolStateController = async (req: Request, res: Response) => {
  try {
    const poolState = await getCurrentPoolState();
    const currentStakers = await getCurrentStakers();

    // Calculate additional metrics
    const averageStakeAmount = poolState.activeStakersCount > 0 
      ? poolState.totalStaked / poolState.activeStakersCount 
      : 0;

    const averageMultiplier = currentStakers.length > 0
      ? currentStakers.reduce((sum, staker) => sum + staker.multiplier, 0) / currentStakers.length
      : 1.0;

    const response = {
      success: true,
      data: {
        poolMetrics: {
          totalStaked: formatTokenAmount(poolState.totalStaked),
          totalWeightedStake: formatTokenAmount(poolState.totalWeightedStake),
          currentEventId: poolState.currentEventId,
          totalAccumulatedRevenue: formatTokenAmount(poolState.totalAccumulatedRevenue),
          activeStakersCount: poolState.activeStakersCount,
          lastDistributionTimestamp: poolState.lastDistributionTimestamp,
          lastDistributionDate: poolState.lastDistributionTimestamp > 0 
            ? new Date(poolState.lastDistributionTimestamp * 1000).toISOString()
            : null,
        },
        
        stakingMetrics: {
          averageStakeAmount: formatTokenAmount(averageStakeAmount),
          averageMultiplier: `${averageMultiplier.toFixed(1)}x`,
          utilizationRate: poolState.totalStaked > 0 ? "Active" : "No stakes",
        },

        recentActivity: {
          hasRecentDistribution: (Date.now() / 1000 - poolState.lastDistributionTimestamp) < (7 * 24 * 60 * 60), // Within 7 days
          daysSinceLastDistribution: Math.floor((Date.now() / 1000 - poolState.lastDistributionTimestamp) / (24 * 60 * 60)),
        },

        calculatedAt: new Date().toISOString(),
      },
    };

    res.json(response);
  } catch (error) {
    console.error("❌ Error in getPoolStateController:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch pool state",
      error: error.message,
    });
  }
};

/**
 * Get lock period options with multipliers
 * GET /api/staking/lock-period-options
 */
export const getLockPeriodOptionsController = async (req: Request, res: Response) => {
  try {
    const lockPeriodOptions = getLockPeriodOptions();
    
    res.json({
      success: true,
      data: {
        options: lockPeriodOptions,
        note: "Choose your lock period wisely - longer periods get higher multipliers and more total rewards from participating in more revenue distributions",
        calculatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("❌ Error in getLockPeriodOptionsController:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch lock period options",
      error: error.message,
    });
  }
};

/**
 * Compare different lock period scenarios for the same stake amount
 * POST /api/staking/compare-lock-periods
 * Body: { stakedAmount: number, simulatedRevenueAmount?: number }
 */
export const compareLockPeriodsController = async (req: Request, res: Response) => {
  try {
    const { stakedAmount, simulatedRevenueAmount } = req.body;

    if (!stakedAmount || stakedAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid staked amount is required",
      });
    }

    const lockPeriods = [30, 90, 180, 365];
    const comparisons = [];

    // Calculate rewards for each lock period
    for (const lockPeriodDays of lockPeriods) {
      try {
        const input: ProjectedRewardInput = {
          stakedAmount: parseFloat(stakedAmount),
          lockPeriodDays,
          simulatedRevenueAmount: simulatedRevenueAmount ? parseFloat(simulatedRevenueAmount) : undefined,
        };

        const result = await calculateProjectedRewards(input);
        
        comparisons.push({
          lockPeriod: `${lockPeriodDays} days`,
          lockPeriodLabel: lockPeriodDays === 30 ? "1 Month" : 
                          lockPeriodDays === 90 ? "3 Months" :
                          lockPeriodDays === 180 ? "6 Months" : "12 Months",
          multiplier: `${result.userMultiplier}x`,
          userSharePercentage: formatPercentage(result.userSharePercentage),
          rewardPerEvent: formatTokenAmount(result.rewardPerEvent),
          estimatedMonthlyRewards: formatTokenAmount(result.historicalContext.estimatedMonthlyRewards),
          annualizedAPY: formatPercentage(result.annualizedAPY),
          weightedStake: formatTokenAmount(result.userWeightedStake),
        });
      } catch (error) {
        console.error(`Error calculating for ${lockPeriodDays} days:`, error);
      }
    }

    // Find the best option
    const bestAPY = Math.max(...comparisons.map(c => parseFloat(c.annualizedAPY.replace('%', ''))));
    const bestOption = comparisons.find(c => parseFloat(c.annualizedAPY.replace('%', '')) === bestAPY);

    res.json({
      success: true,
      data: {
        stakedAmount: formatTokenAmount(parseFloat(stakedAmount)),
        comparisons,
        recommendation: {
          bestOption: bestOption?.lockPeriodLabel,
          bestAPY: bestOption?.annualizedAPY,
          reason: "Highest projected APY with maximum participation in future revenue distributions"
        },
        calculatedAt: new Date().toISOString(),
        basedOnSimulation: !!simulatedRevenueAmount,
      },
    });
  } catch (error) {
    console.error("❌ Error in compareLockPeriodsController:", error);
    res.status(500).json({
      success: false,
      message: "Failed to compare lock periods",
      error: error.message,
    });
  }
};

/**
 * Get current stakers information (for admin dashboard)
 * GET /api/staking/current-stakers
 */
export const getCurrentStakersController = async (req: Request, res: Response) => {
  try {
    const currentStakers = await getCurrentStakers();
    const poolState = await getCurrentPoolState();

    const stakersWithDetails = currentStakers.map(staker => ({
      publicKey: staker.publicKey,
      owner: staker.owner,
      stakedAmount: formatTokenAmount(staker.stakedAmount),
      lockPeriod: `${staker.lockDurationDays} days`,
      multiplier: `${staker.multiplier}x`,
      weightedStake: formatTokenAmount(staker.weightedStake),
      shareOfPool: formatPercentage((staker.weightedStake / poolState.totalWeightedStake) * 100),
      joinedAtEvent: staker.joinedAtEvent,
      accumulatedRewards: formatTokenAmount(staker.accumulatedRewards),
      stakeDate: new Date(staker.stakeTimestamp * 1000).toISOString(),
    }));

    res.json({
      success: true,
      data: {
        totalStakers: currentStakers.length,
        stakers: stakersWithDetails,
        poolSummary: {
          totalStaked: formatTokenAmount(poolState.totalStaked),
          totalWeightedStake: formatTokenAmount(poolState.totalWeightedStake),
          currentEventId: poolState.currentEventId,
        },
        calculatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("❌ Error in getCurrentStakersController:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch current stakers",
      error: error.message,
    });
  }
};