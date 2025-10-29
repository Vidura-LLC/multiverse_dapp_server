import { PublicKey } from "@solana/web3.js";
import { getProgram } from "../staking/services";


export const SEEDS = {
  STAKING_POOL: "staking_pool",
  STAKING_POOL_ESCROW: "escrow",
  REVENUE_POOL: "revenue_pool",
  REVENUE_POOL_ESCROW: "revenue_escrow",
  PRIZE_POOL: "prize_pool",
  PRIZE_POOL_ESCROW: "prize_escrow",
  REWARD_POOL: "reward_pool",
  REWARD_POOL_ESCROW: "reward_escrow",
  TOURNAMENT_POOL: "tournament_pool",
  USER_STAKING: "user_staking",
  REGISTRATION: "registration",
  TOURNAMENT_ESCROW: "escrow", // Tournament pool also uses "escrow" for its escrow
}

export enum TokenType {
  SPL = 0,
  SOL = 1,
}

// TokenType is strictly numeric (0=SPL, 1=SOL). Clients must send 0 or 1.

/**
 * Get Staking Pool PDA
 * @param adminPublicKey - Admin who initialized the pool
 * @param tokenType - Type of token (SPL or SOL)
 * @returns Staking Pool PDA
 */
export const getStakingPoolPDA = (
  adminPublicKey: PublicKey,
  tokenType: TokenType,
) => {
  const { program } = getProgram();
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from(SEEDS.STAKING_POOL), 
      adminPublicKey.toBuffer(),
      Buffer.from([tokenType]) // ✅ CRITICAL: Include token type
    ],
    program.programId
  )[0];
};

/**
 * Get Staking Pool Escrow PDA
 * @param stakingPoolPublicKey - The staking pool PDA (already includes tokenType)
 * @returns Escrow account PDA for the staking pool
 */
export const getStakingEscrowPDA = (stakingPoolPublicKey: PublicKey) => {
  const { program } = getProgram();
  return PublicKey.findProgramAddressSync(
    [Buffer.from(SEEDS.STAKING_POOL_ESCROW), stakingPoolPublicKey.toBuffer()],
    program.programId
  )[0];
};

/**
 * Get Revenue Pool PDA
 * @param adminPublicKey - Admin who initialized the pool
 * @param tokenType - Type of token (SPL or SOL)
 * @returns Revenue Pool PDA
 */
export const getRevenuePoolPDA = (adminPublicKey: PublicKey, tokenType: TokenType) => {
  const { program } = getProgram();
  return PublicKey.findProgramAddressSync(
    [Buffer.from(SEEDS.REVENUE_POOL), adminPublicKey.toBuffer(), Buffer.from([tokenType])],
    program.programId
  )[0];
};

/**
 * Get Revenue Pool Escrow PDA
 * @param revenuePoolPublicKey - The revenue pool PDA
 * @returns Escrow account PDA for the revenue pool
 */
export const getRevenueEscrowPDA = (revenuePoolPublicKey: PublicKey) => {
  const { program } = getProgram();
  return PublicKey.findProgramAddressSync(
    [Buffer.from(SEEDS.REVENUE_POOL_ESCROW), revenuePoolPublicKey.toBuffer()],
    program.programId
  )[0];
};

/**
 * Get Reward Pool PDA
 * @param adminPublicKey - Admin who initialized the pool
 * @param tokenType - Type of token (SPL or SOL)
 * @returns Reward Pool PDA
 */
export const getRewardPoolPDA = (adminPublicKey: PublicKey, tokenType: TokenType) => {
  const { program } = getProgram();
  return PublicKey.findProgramAddressSync(
    [Buffer.from(SEEDS.REWARD_POOL), adminPublicKey.toBuffer(), Buffer.from([tokenType])],
    program.programId
  )[0];
};

/**
 * Get Reward Pool Escrow PDA
 * @param rewardPoolPublicKey - The reward pool PDA
 * @returns Escrow account PDA for the reward pool
 */
export const getRewardEscrowPDA = (rewardPoolPublicKey: PublicKey) => {
  const { program } = getProgram();
  return PublicKey.findProgramAddressSync(
    [Buffer.from(SEEDS.REWARD_POOL_ESCROW), rewardPoolPublicKey.toBuffer()],
    program.programId
  )[0];
};

/**
 * Get Tournament Pool PDA
 * @param adminPublicKey - Admin who initialized the tournament
 * @param tournamentId - Unique tournament identifier
 * @param tokenType - Type of token (SPL or SOL)
 * @returns Tournament Pool PDA
 */
export const getTournamentPoolPDA = (
  adminPublicKey: PublicKey,
  tournamentId: string,
  tokenType: TokenType
) => {
  const { program } = getProgram();
  const tournamentIdBytes = Buffer.from(tournamentId, "utf8");
  return PublicKey.findProgramAddressSync(
    [Buffer.from(SEEDS.TOURNAMENT_POOL), adminPublicKey.toBuffer(), tournamentIdBytes, Buffer.from([tokenType])],
    program.programId
  )[0];
};

/**
 * Get Tournament Pool Escrow PDA
 * @param tournamentPoolPublicKey - The tournament pool PDA
 * @returns Escrow account PDA for the tournament pool
 */
export const getTournamentEscrowPDA = (tournamentPoolPublicKey: PublicKey) => {
  const { program } = getProgram();
  return PublicKey.findProgramAddressSync(
    [Buffer.from(SEEDS.TOURNAMENT_ESCROW), tournamentPoolPublicKey.toBuffer()],
    program.programId
  )[0];
};

/**
 * Get Prize Pool PDA
 * @param tournamentPoolPublicKey - The tournament pool PDA
 * @param tokenType - Type of token (SPL or SOL)
 * @returns Prize Pool PDA
 */
export const getPrizePoolPDA = (tournamentPoolPublicKey: PublicKey) => {
  const { program } = getProgram();
  return PublicKey.findProgramAddressSync(
    [Buffer.from(SEEDS.PRIZE_POOL), tournamentPoolPublicKey.toBuffer()],
    program.programId
  )[0];
};

/**
 * Get Prize Pool Escrow PDA
 * @param prizePoolPublicKey - The prize pool PDA
 * @returns Escrow account PDA for the prize pool
 */
export const getPrizeEscrowPDA = (prizePoolPublicKey: PublicKey) => {
  const { program } = getProgram();
  return PublicKey.findProgramAddressSync(
    [Buffer.from(SEEDS.PRIZE_POOL_ESCROW), prizePoolPublicKey.toBuffer()],
    program.programId
  )[0];
};

/**
 * Get User Staking Account PDA
 * @param stakingPoolPublicKey - The staking pool PDA (already includes tokenType)
 * @param userPublicKey - The user's public key
 * @returns User Staking Account PDA
 */
export const getUserStakingPDA = (
  stakingPoolPublicKey: PublicKey,
  userPublicKey: PublicKey
) => {
  const { program } = getProgram();
  return PublicKey.findProgramAddressSync(
    [Buffer.from(SEEDS.USER_STAKING), stakingPoolPublicKey.toBuffer(), userPublicKey.toBuffer()],
    program.programId
  )[0];
};

/**
 * Get Registration Record PDA
 * @param tournamentPoolPublicKey - The tournament pool PDA
 * @param userPublicKey - The user's public key
 * @returns Registration Record PDA
 */
export const getRegistrationPDA = (
tournamentPoolPublicKey: PublicKey, userPublicKey: PublicKey) => {
  const { program } = getProgram();
  return PublicKey.findProgramAddressSync(
    [Buffer.from(SEEDS.REGISTRATION), tournamentPoolPublicKey.toBuffer(), userPublicKey.toBuffer()],
    program.programId
  )[0];
};

/**
 * Get all pool PDAs at once (convenience function)
 * @param adminPublicKey - Admin public key (optional)
 * @param opts - Optional parameters
 * @param opts.tournamentId - Tournament ID to derive tournament-related PDAs
 * @param opts.userPublicKey - User public key to derive user staking PDA
 * @param opts.tokenType - Token type for staking pool (defaults to SPL)
 * @returns Object containing all relevant PDAs
 */
export const getAllPoolPDAs = (
  adminPublicKey?: PublicKey,
  opts?: { 
    tournamentId?: string; 
    userPublicKey?: PublicKey;
    tokenType?: TokenType;
  }
) => {
  const admin = adminPublicKey ?? getProgram().adminPublicKey;
  const tokenType = opts?.tokenType ?? TokenType.SPL;

  // Staking-related PDAs
  const stakingPool = getStakingPoolPDA(admin, tokenType);
  const stakingEscrow = getStakingEscrowPDA(stakingPool);

  // Revenue-related PDAs
  const revenuePool = getRevenuePoolPDA(admin, tokenType);
  const revenueEscrow = getRevenueEscrowPDA(revenuePool);

  // Reward-related PDAs
  const rewardPool = getRewardPoolPDA(admin, tokenType);
  const rewardEscrow = getRewardEscrowPDA(rewardPool);

  // Tournament-related PDAs (if tournamentId provided)
  let tournamentPool: PublicKey | undefined;
  let tournamentEscrow: PublicKey | undefined;
  let prizePool: PublicKey | undefined;
  let prizeEscrow: PublicKey | undefined;
  let registration: PublicKey | undefined;

  if (opts?.tournamentId) {
    tournamentPool = getTournamentPoolPDA(admin, opts.tournamentId, tokenType);
    tournamentEscrow = getTournamentEscrowPDA(tournamentPool);
    prizePool = getPrizePoolPDA(tournamentPool);
    prizeEscrow = getPrizeEscrowPDA(prizePool);

    // If user is also provided, get registration PDA
    if (opts?.userPublicKey) {
      registration = getRegistrationPDA(tournamentPool, opts.userPublicKey);
    }
  }

  // User staking PDA (if user provided)
  let userStaking: PublicKey | undefined;
  if (opts?.userPublicKey) {
    userStaking = getUserStakingPDA(stakingPool, opts.userPublicKey);
  }

  return {
    stakingPool,
    stakingEscrow,
    revenuePool,
    revenueEscrow,
    rewardPool,
    rewardEscrow,
    tournamentPool,
    tournamentEscrow, // ✅ Added
    prizePool,
    prizeEscrow,
    userStaking,
    registration, // ✅ Added
  };
};

/**
 * Get all PDAs for both SPL and SOL staking pools
 * Useful for displaying both pool types in UI
 * @param adminPublicKey - Admin public key (optional)
 * @param opts - Optional parameters
 * @returns Object containing PDAs for both SPL and SOL pools
 */
export const getAllStakingPoolPDAs = (
  adminPublicKey?: PublicKey,
  opts?: { userPublicKey?: PublicKey }
) => {
  const admin = adminPublicKey ?? getProgram().adminPublicKey;

  // SPL Pool PDAs
  const splStakingPool = getStakingPoolPDA(admin, TokenType.SPL);
  const splStakingEscrow = getStakingEscrowPDA(splStakingPool);
  const splUserStaking = opts?.userPublicKey 
    ? getUserStakingPDA(splStakingPool, opts.userPublicKey)
    : undefined;

  // SOL Pool PDAs
  const solStakingPool = getStakingPoolPDA(admin, TokenType.SOL);
  const solStakingEscrow = getStakingEscrowPDA(solStakingPool);
  const solUserStaking = opts?.userPublicKey
    ? getUserStakingPDA(solStakingPool, opts.userPublicKey)
    : undefined;

  return {
    spl: {
      stakingPool: splStakingPool,
      stakingEscrow: splStakingEscrow,
      userStaking: splUserStaking,
    },
    sol: {
      stakingPool: solStakingPool,
      stakingEscrow: solStakingEscrow,
      userStaking: solUserStaking,
    },
  };
};

/**
 * Helper function to log all PDAs for debugging
 * @param adminPublicKey - Admin public key (optional)
 * @param opts - Optional parameters
 */
export const logAllPDAs = (
  adminPublicKey?: PublicKey,
  opts?: { 
    tournamentId?: string; 
    userPublicKey?: PublicKey;
    tokenType?: TokenType;
  }
) => {
  const pdas = getAllPoolPDAs(adminPublicKey, opts);
  
  console.log("=== ALL PDAs ===");
  console.log("Staking Pool:", pdas.stakingPool.toBase58());
  console.log("Staking Escrow:", pdas.stakingEscrow.toBase58());
  console.log("Revenue Pool:", pdas.revenuePool.toBase58());
  console.log("Revenue Escrow:", pdas.revenueEscrow.toBase58());
  console.log("Reward Pool:", pdas.rewardPool.toBase58());
  console.log("Reward Escrow:", pdas.rewardEscrow.toBase58());

  if (pdas.tournamentPool) {
    console.log("Tournament Pool:", pdas.tournamentPool.toBase58());
    console.log("Tournament Escrow:", pdas.tournamentEscrow?.toBase58());
    console.log("Prize Pool:", pdas.prizePool?.toBase58());
    console.log("Prize Escrow:", pdas.prizeEscrow?.toBase58());
    console.log("Registration:", pdas.registration?.toBase58());
  }

  if (pdas.userStaking) {
    console.log("User Staking:", pdas.userStaking.toBase58());
  }

  console.log("================");

  return pdas;
};

// Export individual seed constants for direct use if needed
export { SEEDS as PDA_SEEDS };