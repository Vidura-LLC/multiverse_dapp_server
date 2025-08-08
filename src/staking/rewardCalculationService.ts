// src/staking/rewardCalculationService.ts
// Phase 1: Core Calculation Engine for Projected Rewards

import * as anchor from "@project-serum/anchor";
import { PublicKey } from "@solana/web3.js";
import { getProgram } from "./services";
import { StakingPoolAccount } from "../adminDashboard/stakingStatsService";

/**
 * Lock period multipliers matching the smart contract
 */
export const LOCK_MULTIPLIERS = {
  30: 1.0,    // 1 month = 1x
  90: 1.5,    // 3 months = 1.5x  
  180: 2.0,   // 6 months = 2x
  365: 3.0,   // 12 months = 3x
} as const;

/**
 * Convert lock duration in days to multiplier
 */
export const getLockMultiplier = (lockDurationDays: number): number => {
  if (lockDurationDays >= 365) return LOCK_MULTIPLIERS[365];
  if (lockDurationDays >= 180) return LOCK_MULTIPLIERS[180];
  if (lockDurationDays >= 90) return LOCK_MULTIPLIERS[90];
  if (lockDurationDays >= 30) return LOCK_MULTIPLIERS[30];
  return 1.0; // Default for periods less than 30 days
};

/**
 * Convert lock duration in seconds to days and get multiplier
 */
export const getLockMultiplierFromSeconds = (lockDurationSeconds: number): number => {
  const lockDurationDays = Math.floor(lockDurationSeconds / (24 * 60 * 60));
  return getLockMultiplier(lockDurationDays);
};

/**
 * Interface for current staker data
 */
export interface CurrentStakerData {
  publicKey: string;
  owner: string;
  stakedAmount: number;
  lockDuration: number;
  lockDurationDays: number;
  stakeTimestamp: number;
  multiplier: number;
  weightedStake: number;
  joinedAtEvent: number;
  accumulatedRewards: number;
}

/**
 * Interface for pool state
 */
export interface PoolState {
  totalStaked: number;
  totalWeightedStake: number;
  currentEventId: number;
  totalAccumulatedRevenue: number;
  activeStakersCount: number;
  lastDistributionTimestamp: number;
}

/**
 * Interface for projected reward calculation input
 */
export interface ProjectedRewardInput {
  stakedAmount: number;
  lockPeriodDays: number;
  simulatedRevenueAmount?: number; // For simulation purposes
}

/**
 * Interface for projected reward calculation result
 */
export interface ProjectedRewardResult {
  // User's position in the pool
  userWeightedStake: number;
  userMultiplier: number;
  
  // Pool metrics after user joins
  newTotalStaked: number;
  newTotalWeightedStake: number;
  userSharePercentage: number;
  
  // Reward projections
  rewardPerEvent: number;           // Based on simulated revenue
  annualizedAPY: number;           // Estimated APY based on historical data
  earlyStakerAdvantage: string;    // Text explaining early staker benefits
  
  // Breakdown for transparency
  breakdown: {
    baseStake: number;
    appliedMultiplier: number;
    resultingWeightedStake: number;
    shareOfPool: number;
  };
  
  // Historical context
  historicalContext: {
    averageRevenuePerEvent: number;
    eventsPerMonth: number;
    estimatedMonthlyRewards: number;
  };
}

/**
 * Get current pool state from the blockchain
 */
export const getCurrentPoolState = async (adminPublicKey?: PublicKey): Promise<PoolState> => {
  try {
    const { program } = getProgram();
    
    // Use provided admin key or get from environment
    const adminKey = adminPublicKey || new PublicKey(process.env.ADMIN_PUBLIC_KEY || "");
    
    // Derive the staking pool PDA
    const [stakingPoolPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("staking_pool"), adminKey.toBuffer()],
      program.programId
    );
    
    const stakingPool = await program.account.stakingPool.fetch(stakingPoolPDA) as StakingPoolAccount;
    
    const tokenDecimals = 9; // Adjust based on your token decimals
    
    return {
      totalStaked: stakingPool.totalStaked.toNumber() / (10 ** tokenDecimals),
      totalWeightedStake: stakingPool.totalWeightedStake.toNumber() / (10 ** tokenDecimals),
      currentEventId: stakingPool.currentEventId.toNumber(),
      totalAccumulatedRevenue: stakingPool.totalAccumulatedRevenue.toNumber() / (10 ** tokenDecimals),
      activeStakersCount: stakingPool.activeStakersCount,
      lastDistributionTimestamp: stakingPool.lastDistributionTimestamp.toNumber(),
    };
  } catch (error) {
    console.error("❌ Error fetching pool state:", error);
    // Return default values if pool doesn't exist yet
    return {
      totalStaked: 0,
      totalWeightedStake: 0,
      currentEventId: 0,
      totalAccumulatedRevenue: 0,
      activeStakersCount: 0,
      lastDistributionTimestamp: 0,
    };
  }
};

/**
 * Get all current stakers data from the blockchain
 */
export const getCurrentStakers = async (): Promise<CurrentStakerData[]> => {
  try {
    const { program } = getProgram();
    
    // Get all user staking accounts
    const userStakingAccounts = await program.account.userStakingAccount.all();
    
    const tokenDecimals = 9; // Adjust based on your token decimals
    
    // Filter active stakers and map their data
    const activeStakers = userStakingAccounts
      .filter(account => {
        const userData = account.account as any;
        return userData.stakedAmount.gt(new anchor.BN(0));
      })
      .map(account => {
        const userData = account.account as any;
        const stakedAmount = userData.stakedAmount.toNumber() / (10 ** tokenDecimals);
        const lockDuration = userData.lockDuration.toNumber();
        const lockDurationDays = Math.floor(lockDuration / (24 * 60 * 60));
        const multiplier = getLockMultiplierFromSeconds(lockDuration);
        const weightedStake = stakedAmount * multiplier;
        
        return {
          publicKey: account.publicKey.toString(),
          owner: userData.owner.toString(),
          stakedAmount,
          lockDuration,
          lockDurationDays,
          stakeTimestamp: userData.stakeTimestamp.toNumber(),
          multiplier,
          weightedStake,
          joinedAtEvent: userData.joinedAtEvent?.toNumber() || 0,
          accumulatedRewards: userData.accumulatedRewards?.toNumber() / (10 ** tokenDecimals) || 0,
        };
      });
    
    return activeStakers;
  } catch (error) {
    console.error("❌ Error fetching current stakers:", error);
    return [];
  }
};

/**
 * Get historical revenue data for projections
 */
export const getHistoricalRevenueData = async () => {
  try {
    // TODO: Implement based on your revenue distribution events
    // For now, return mock data based on your document examples
    return {
      averageRevenuePerEvent: 100, // Average of 50, 100, 150 CRD from your examples
      eventsPerMonth: 4, // Assuming weekly tournaments
      totalEvents: 3, // Total historical events
      revenueHistory: [50, 100, 150], // From your document
    };
  } catch (error) {
    console.error("❌ Error fetching historical revenue data:", error);
    return {
      averageRevenuePerEvent: 50,
      eventsPerMonth: 2,
      totalEvents: 0,
      revenueHistory: [],
    };
  }
};

/**
 * Calculate projected rewards for a potential staker
 * This is the main function for Phase 1
 */
export const calculateProjectedRewards = async (
  input: ProjectedRewardInput
): Promise<ProjectedRewardResult> => {
  try {
    // Get current pool state
    const poolState = await getCurrentPoolState();
    const currentStakers = await getCurrentStakers();
    const historicalData = await getHistoricalRevenueData();
    
    // Calculate user's metrics
    const userMultiplier = getLockMultiplier(input.lockPeriodDays);
    const userWeightedStake = input.stakedAmount * userMultiplier;
    
    // Calculate new pool totals after user joins
    const newTotalStaked = poolState.totalStaked + input.stakedAmount;
    const newTotalWeightedStake = poolState.totalWeightedStake + userWeightedStake;
    
    // Calculate user's share percentage
    const userSharePercentage = (userWeightedStake / newTotalWeightedStake) * 100;
    
    // Use simulated revenue or historical average
    const revenuePerEvent = input.simulatedRevenueAmount || historicalData.averageRevenuePerEvent;
    const rewardPerEvent = (userWeightedStake / newTotalWeightedStake) * revenuePerEvent;
    
    // Calculate estimated monthly rewards
    const estimatedMonthlyRewards = rewardPerEvent * historicalData.eventsPerMonth;
    
    // Calculate annualized APY estimate
    // APY = (Monthly Rewards * 12) / Staked Amount * 100
    const annualizedAPY = (estimatedMonthlyRewards * 12) / input.stakedAmount * 100;
    
    // Determine early staker advantage message
    const earlyStakerAdvantage = poolState.activeStakersCount === 0 
      ? "🎯 First staker! You'll participate in ALL future revenue distributions."
      : `⚡ Join ${poolState.activeStakersCount} other stakers and participate in all future distributions.`;
    
    return {
      userWeightedStake,
      userMultiplier,
      newTotalStaked,
      newTotalWeightedStake,
      userSharePercentage,
      rewardPerEvent,
      annualizedAPY,
      earlyStakerAdvantage,
      breakdown: {
        baseStake: input.stakedAmount,
        appliedMultiplier: userMultiplier,
        resultingWeightedStake: userWeightedStake,
        shareOfPool: userSharePercentage,
      },
      historicalContext: {
        averageRevenuePerEvent: historicalData.averageRevenuePerEvent,
        eventsPerMonth: historicalData.eventsPerMonth,
        estimatedMonthlyRewards,
      },
    };
  } catch (error) {
    console.error("❌ Error calculating projected rewards:", error);
    throw new Error(`Failed to calculate projected rewards: ${error.message}`);
  }
};

/**
 * Get lock period options with their multipliers
 */
export const getLockPeriodOptions = () => {
  return [
    {
      days: 30,
      label: "1 Month",
      multiplier: LOCK_MULTIPLIERS[30],
      description: "Minimum lock period with 1x rewards"
    },
    {
      days: 90,
      label: "3 Months", 
      multiplier: LOCK_MULTIPLIERS[90],
      description: "1.5x reward multiplier - 50% bonus"
    },
    {
      days: 180,
      label: "6 Months",
      multiplier: LOCK_MULTIPLIERS[180], 
      description: "2x reward multiplier - 100% bonus"
    },
    {
      days: 365,
      label: "12 Months",
      multiplier: LOCK_MULTIPLIERS[365],
      description: "3x reward multiplier - 200% bonus"
    }
  ];
};

/**
 * Validate staking input
 */
export const validateStakingInput = (input: ProjectedRewardInput): string[] => {
  const errors: string[] = [];
  
  if (input.stakedAmount <= 0) {
    errors.push("Staked amount must be greater than 0");
  }
  
  if (input.stakedAmount > 1000000) { // Arbitrary max limit
    errors.push("Staked amount is too large");
  }
  
  if (![30, 90, 180, 365].includes(input.lockPeriodDays)) {
    errors.push("Lock period must be 30, 90, 180, or 365 days");
  }
  
  return errors;
};

/**
 * Format token amount for display
 */
export const formatTokenAmount = (amount: number, decimals: number = 2): string => {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount);
};

/**
 * Format percentage for display
 */
export const formatPercentage = (percentage: number, decimals: number = 2): string => {
  return `${percentage.toFixed(decimals)}%`;
};

/**
 * Calculate time until lock expires for existing stakers
 */
export const calculateTimeUntilUnlock = (stakeTimestamp: number, lockDuration: number): {
  isLocked: boolean;
  timeRemaining: number;
  formattedTimeRemaining: string;
} => {
  const currentTime = Math.floor(Date.now() / 1000);
  const unlockTime = stakeTimestamp + lockDuration;
  const timeRemaining = unlockTime - currentTime;
  
  if (timeRemaining <= 0) {
    return {
      isLocked: false,
      timeRemaining: 0,
      formattedTimeRemaining: "Unlocked"
    };
  }
  
  const days = Math.floor(timeRemaining / (24 * 60 * 60));
  const hours = Math.floor((timeRemaining % (24 * 60 * 60)) / (60 * 60));
  
  return {
    isLocked: true,
    timeRemaining,
    formattedTimeRemaining: `${days} days, ${hours} hours`
  };
}; 