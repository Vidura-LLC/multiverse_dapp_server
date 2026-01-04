"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PDA_SEEDS = exports.logAllPDAs = exports.getAllStakingPoolPDAs = exports.getAllPoolPDAs = exports.getDeveloperOnboardingRecordPDA = exports.getPlatformConfigPDA = exports.getRegistrationPDA = exports.getUserStakingPDA = exports.getPrizeEscrowPDA = exports.getPrizePoolPDA = exports.getTournamentEscrowPDA = exports.getTournamentPoolPDA = exports.getRewardEscrowPDA = exports.getRewardPoolPDA = exports.getStakingEscrowPDA = exports.getSOLVaultPDA = exports.getStakingPoolPDA = exports.TokenType = exports.SEEDS = void 0;
const web3_js_1 = require("@solana/web3.js");
const services_1 = require("../staking/services");
exports.SEEDS = {
    STAKING_POOL: "staking_pool",
    STAKING_POOL_ESCROW: "escrow",
    PRIZE_POOL: "prize_pool",
    PRIZE_POOL_ESCROW: "prize_escrow",
    REWARD_POOL: "reward_pool",
    REWARD_POOL_ESCROW: "reward_escrow",
    TOURNAMENT_POOL: "tournament_pool",
    USER_STAKING: "user_staking",
    REGISTRATION: "registration",
    TOURNAMENT_ESCROW: "escrow", // Tournament pool also uses "escrow" for its escrow
    SOL_VAULT: "sol_vault",
    PLATFORM_CONFIG: "platform_config",
    DEVELOPER_ONBOARDING: "developer_onboarding",
};
exports.PDA_SEEDS = exports.SEEDS;
var TokenType;
(function (TokenType) {
    TokenType[TokenType["SPL"] = 0] = "SPL";
    TokenType[TokenType["SOL"] = 1] = "SOL";
})(TokenType || (exports.TokenType = TokenType = {}));
// TokenType is strictly numeric (0=SPL, 1=SOL). Clients must send 0 or 1.
/**
 * Get Staking Pool PDA
 * @param adminPublicKey - Admin who initialized the pool
 * @param tokenType - Type of token (SPL or SOL)
 * @returns Staking Pool PDA
 */
const getStakingPoolPDA = (adminPublicKey, tokenType) => {
    const { program } = (0, services_1.getProgram)();
    return web3_js_1.PublicKey.findProgramAddressSync([
        Buffer.from(exports.SEEDS.STAKING_POOL),
        adminPublicKey.toBuffer(),
        Buffer.from([tokenType]) // ✅ CRITICAL: Include token type
    ], program.programId)[0];
};
exports.getStakingPoolPDA = getStakingPoolPDA;
/**
 * Get SOL Vault PDA
 * @param stakingPoolPublicKey - The staking pool PDA
 * @returns SOL Vault PDA
 */
const getSOLVaultPDA = (stakingPoolPublicKey) => {
    const { program } = (0, services_1.getProgram)();
    return web3_js_1.PublicKey.findProgramAddressSync([Buffer.from(exports.SEEDS.SOL_VAULT), stakingPoolPublicKey.toBuffer()], program.programId)[0];
};
exports.getSOLVaultPDA = getSOLVaultPDA;
/**
 * Get Staking Pool Escrow PDA
 * @param stakingPoolPublicKey - The staking pool PDA (already includes tokenType)
 * @returns Escrow account PDA for the staking pool
 */
const getStakingEscrowPDA = (stakingPoolPublicKey) => {
    const { program } = (0, services_1.getProgram)();
    return web3_js_1.PublicKey.findProgramAddressSync([Buffer.from(exports.SEEDS.STAKING_POOL_ESCROW), stakingPoolPublicKey.toBuffer()], program.programId)[0];
};
exports.getStakingEscrowPDA = getStakingEscrowPDA;
/**
 * Get Reward Pool PDA
 * @param adminPublicKey - Admin who initialized the pool
 * @param tokenType - Type of token (SPL or SOL)
 * @returns Reward Pool PDA
 */
const getRewardPoolPDA = (adminPublicKey, tokenType) => {
    const { program } = (0, services_1.getProgram)();
    return web3_js_1.PublicKey.findProgramAddressSync([Buffer.from(exports.SEEDS.REWARD_POOL), adminPublicKey.toBuffer(), Buffer.from([tokenType])], program.programId)[0];
};
exports.getRewardPoolPDA = getRewardPoolPDA;
/**
 * Get Reward Pool Escrow PDA
 * @param rewardPoolPublicKey - The reward pool PDA
 * @returns Escrow account PDA for the reward pool
 */
const getRewardEscrowPDA = (rewardPoolPublicKey) => {
    const { program } = (0, services_1.getProgram)();
    return web3_js_1.PublicKey.findProgramAddressSync([Buffer.from(exports.SEEDS.REWARD_POOL_ESCROW), rewardPoolPublicKey.toBuffer()], program.programId)[0];
};
exports.getRewardEscrowPDA = getRewardEscrowPDA;
/**
 * Get Tournament Pool PDA
 * @param adminPublicKey - Admin who initialized the tournament
 * @param tournamentId - Unique tournament identifier
 * @param tokenType - Type of token (SPL or SOL)
 * @returns Tournament Pool PDA
 */
const getTournamentPoolPDA = (adminPublicKey, tournamentId, tokenType) => {
    const { program } = (0, services_1.getProgram)();
    const tournamentIdBytes = Buffer.from(tournamentId, "utf8");
    return web3_js_1.PublicKey.findProgramAddressSync([Buffer.from(exports.SEEDS.TOURNAMENT_POOL), adminPublicKey.toBuffer(), tournamentIdBytes, Buffer.from([tokenType])], program.programId)[0];
};
exports.getTournamentPoolPDA = getTournamentPoolPDA;
/**
 * Get Tournament Pool Escrow PDA
 * @param tournamentPoolPublicKey - The tournament pool PDA
 * @returns Escrow account PDA for the tournament pool
 */
const getTournamentEscrowPDA = (tournamentPoolPublicKey) => {
    const { program } = (0, services_1.getProgram)();
    return web3_js_1.PublicKey.findProgramAddressSync([Buffer.from(exports.SEEDS.TOURNAMENT_ESCROW), tournamentPoolPublicKey.toBuffer()], program.programId)[0];
};
exports.getTournamentEscrowPDA = getTournamentEscrowPDA;
/**
 * Get Prize Pool PDA
 * @param tournamentPoolPublicKey - The tournament pool PDA
 * @param tokenType - Type of token (SPL or SOL)
 * @returns Prize Pool PDA
 */
const getPrizePoolPDA = (tournamentPoolPublicKey) => {
    const { program } = (0, services_1.getProgram)();
    return web3_js_1.PublicKey.findProgramAddressSync([Buffer.from(exports.SEEDS.PRIZE_POOL), tournamentPoolPublicKey.toBuffer()], program.programId)[0];
};
exports.getPrizePoolPDA = getPrizePoolPDA;
/**
 * Get Prize Pool Escrow PDA
 * @param prizePoolPublicKey - The prize pool PDA
 * @returns Escrow account PDA for the prize pool
 */
const getPrizeEscrowPDA = (prizePoolPublicKey) => {
    const { program } = (0, services_1.getProgram)();
    return web3_js_1.PublicKey.findProgramAddressSync([Buffer.from(exports.SEEDS.PRIZE_POOL_ESCROW), prizePoolPublicKey.toBuffer()], program.programId)[0];
};
exports.getPrizeEscrowPDA = getPrizeEscrowPDA;
/**
 * Get User Staking Account PDA
 * @param stakingPoolPublicKey - The staking pool PDA (already includes tokenType)
 * @param userPublicKey - The user's public key
 * @returns User Staking Account PDA
 */
const getUserStakingPDA = (stakingPoolPublicKey, userPublicKey) => {
    const { program } = (0, services_1.getProgram)();
    return web3_js_1.PublicKey.findProgramAddressSync([Buffer.from(exports.SEEDS.USER_STAKING), stakingPoolPublicKey.toBuffer(), userPublicKey.toBuffer()], program.programId)[0];
};
exports.getUserStakingPDA = getUserStakingPDA;
/**
 * Get Registration Record PDA
 * @param tournamentPoolPublicKey - The tournament pool PDA
 * @param userPublicKey - The user's public key
 * @returns Registration Record PDA
 */
const getRegistrationPDA = (tournamentPoolPublicKey, userPublicKey) => {
    const { program } = (0, services_1.getProgram)();
    return web3_js_1.PublicKey.findProgramAddressSync([Buffer.from(exports.SEEDS.REGISTRATION), tournamentPoolPublicKey.toBuffer(), userPublicKey.toBuffer()], program.programId)[0];
};
exports.getRegistrationPDA = getRegistrationPDA;
/**
 * Get Platform Config PDA
 * @returns Platform Config PDA
 */
const getPlatformConfigPDA = () => {
    const { program } = (0, services_1.getProgram)();
    return web3_js_1.PublicKey.findProgramAddressSync([Buffer.from(exports.SEEDS.PLATFORM_CONFIG)], program.programId)[0];
};
exports.getPlatformConfigPDA = getPlatformConfigPDA;
/**
 * Get Developer Onboarding Record PDA
 * @param developerPublicKey - The developer's public key
 * @returns Developer Onboarding Record PDA
 */
const getDeveloperOnboardingRecordPDA = (developerPublicKey) => {
    const { program } = (0, services_1.getProgram)();
    return web3_js_1.PublicKey.findProgramAddressSync([
        Buffer.from(exports.SEEDS.DEVELOPER_ONBOARDING),
        developerPublicKey.toBuffer()
    ], program.programId)[0];
};
exports.getDeveloperOnboardingRecordPDA = getDeveloperOnboardingRecordPDA;
/**
 * Get all pool PDAs at once (convenience function)
 * @param adminPublicKey - Admin public key (optional)
 * @param opts - Optional parameters
 * @param opts.tournamentId - Tournament ID to derive tournament-related PDAs
 * @param opts.userPublicKey - User public key to derive user staking PDA
 * @param opts.tokenType - Token type for staking pool (defaults to SPL)
 * @returns Object containing all relevant PDAs
 */
const getAllPoolPDAs = (adminPublicKey, opts) => {
    var _a;
    const admin = adminPublicKey !== null && adminPublicKey !== void 0 ? adminPublicKey : (0, services_1.getProgram)().adminPublicKey;
    const tokenType = (_a = opts === null || opts === void 0 ? void 0 : opts.tokenType) !== null && _a !== void 0 ? _a : TokenType.SPL;
    // Staking-related PDAs
    const stakingPool = (0, exports.getStakingPoolPDA)(admin, tokenType);
    const stakingEscrow = (0, exports.getStakingEscrowPDA)(stakingPool);
    // Reward-related PDAs
    const rewardPool = (0, exports.getRewardPoolPDA)(admin, tokenType);
    const rewardEscrow = (0, exports.getRewardEscrowPDA)(rewardPool);
    // Tournament-related PDAs (if tournamentId provided)
    let tournamentPool;
    let tournamentEscrow;
    let prizePool;
    let prizeEscrow;
    let registration;
    if (opts === null || opts === void 0 ? void 0 : opts.tournamentId) {
        tournamentPool = (0, exports.getTournamentPoolPDA)(admin, opts.tournamentId, tokenType);
        tournamentEscrow = (0, exports.getTournamentEscrowPDA)(tournamentPool);
        prizePool = (0, exports.getPrizePoolPDA)(tournamentPool);
        prizeEscrow = (0, exports.getPrizeEscrowPDA)(prizePool);
        // If user is also provided, get registration PDA
        if (opts === null || opts === void 0 ? void 0 : opts.userPublicKey) {
            registration = (0, exports.getRegistrationPDA)(tournamentPool, opts.userPublicKey);
        }
    }
    // User staking PDA (if user provided)
    let userStaking;
    if (opts === null || opts === void 0 ? void 0 : opts.userPublicKey) {
        userStaking = (0, exports.getUserStakingPDA)(stakingPool, opts.userPublicKey);
    }
    return {
        stakingPool,
        stakingEscrow,
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
exports.getAllPoolPDAs = getAllPoolPDAs;
/**
 * Get all PDAs for both SPL and SOL staking pools
 * Useful for displaying both pool types in UI
 * @param adminPublicKey - Admin public key (optional)
 * @param opts - Optional parameters
 * @returns Object containing PDAs for both SPL and SOL pools
 */
const getAllStakingPoolPDAs = (adminPublicKey, opts) => {
    const admin = adminPublicKey !== null && adminPublicKey !== void 0 ? adminPublicKey : (0, services_1.getProgram)().adminPublicKey;
    // SPL Pool PDAs
    const splStakingPool = (0, exports.getStakingPoolPDA)(admin, TokenType.SPL);
    const splStakingEscrow = (0, exports.getStakingEscrowPDA)(splStakingPool);
    const splUserStaking = (opts === null || opts === void 0 ? void 0 : opts.userPublicKey)
        ? (0, exports.getUserStakingPDA)(splStakingPool, opts.userPublicKey)
        : undefined;
    // SOL Pool PDAs
    const solStakingPool = (0, exports.getStakingPoolPDA)(admin, TokenType.SOL);
    const solStakingEscrow = (0, exports.getStakingEscrowPDA)(solStakingPool);
    const solUserStaking = (opts === null || opts === void 0 ? void 0 : opts.userPublicKey)
        ? (0, exports.getUserStakingPDA)(solStakingPool, opts.userPublicKey)
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
exports.getAllStakingPoolPDAs = getAllStakingPoolPDAs;
/**
 * Helper function to log all PDAs for debugging
 * @param adminPublicKey - Admin public key (optional)
 * @param opts - Optional parameters
 */
const logAllPDAs = (adminPublicKey, opts) => {
    var _a, _b, _c, _d;
    const pdas = (0, exports.getAllPoolPDAs)(adminPublicKey, opts);
    console.log("=== ALL PDAs ===");
    console.log("Staking Pool:", pdas.stakingPool.toBase58());
    console.log("Staking Escrow:", pdas.stakingEscrow.toBase58());
    console.log("Reward Pool:", pdas.rewardPool.toBase58());
    console.log("Reward Escrow:", pdas.rewardEscrow.toBase58());
    if (pdas.tournamentPool) {
        console.log("Tournament Pool:", pdas.tournamentPool.toBase58());
        console.log("Tournament Escrow:", (_a = pdas.tournamentEscrow) === null || _a === void 0 ? void 0 : _a.toBase58());
        console.log("Prize Pool:", (_b = pdas.prizePool) === null || _b === void 0 ? void 0 : _b.toBase58());
        console.log("Prize Escrow:", (_c = pdas.prizeEscrow) === null || _c === void 0 ? void 0 : _c.toBase58());
        console.log("Registration:", (_d = pdas.registration) === null || _d === void 0 ? void 0 : _d.toBase58());
    }
    if (pdas.userStaking) {
        console.log("User Staking:", pdas.userStaking.toBase58());
    }
    console.log("================");
    return pdas;
};
exports.logAllPDAs = logAllPDAs;
//# sourceMappingURL=getPDAs.js.map