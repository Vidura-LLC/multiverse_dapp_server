"use strict";
//src/adminDashboard/stakingStatsService.ts
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateAPY = exports.getActiveStakers = exports.getStakingPoolData = exports.formatTokenAmount = void 0;
const web3_js_1 = require("@solana/web3.js");
const dotenv_1 = __importDefault(require("dotenv"));
const services_1 = require("../staking/services");
dotenv_1.default.config();
const anchor = __importStar(require("@project-serum/anchor"));
const getPDAs_1 = require("../utils/getPDAs");
/**
 * Helper function to format token amounts properly
 */
const formatTokenAmount = (amount, decimals = 9) => {
    if (amount === 0)
        return 0;
    // For very small amounts, show more decimal places
    if (amount < 1) {
        return parseFloat(amount.toFixed(6).replace(/\.?0+$/, ''));
    }
    // For larger amounts, use standard locale formatting
    if (amount >= 1000000) {
        return Number((amount / 1000000).toFixed(2));
    }
    else if (amount >= 1000) {
        return Number((amount / 1000).toFixed(2));
    }
    return amount;
};
exports.formatTokenAmount = formatTokenAmount;
/**
 * Get the staking pool data from the blockchain
 */
const getStakingPoolData = (adminPublicKey, tokenType) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { program, connection } = (0, services_1.getProgram)();
        // Derive the staking pool PDA
        const [stakingPoolPublicKey] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from(getPDAs_1.SEEDS.STAKING_POOL), adminPublicKey.toBuffer(), Buffer.from([tokenType])], program.programId);
        // Derive the staking pool escrow account (consistent seed)
        const [stakingEscrowPublicKey] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from(getPDAs_1.SEEDS.STAKING_POOL_ESCROW), stakingPoolPublicKey.toBuffer()], program.programId);
        console.log("🔹 Fetching Staking Pool PDA:", stakingPoolPublicKey.toString());
        // Check if the revenue pool account exists
        const accountExists = yield connection.getAccountInfo(stakingPoolPublicKey);
        if (!accountExists) {
            return {
                success: false,
                message: "Staking pool has not been initialized yet."
            };
        }
        // Fetch the staking pool data
        const stakingPoolData = yield program.account.stakingPool.fetch(stakingPoolPublicKey);
        return {
            success: true,
            data: {
                admin: stakingPoolData.admin.toString(),
                mint: stakingPoolData.mint.toString(),
                totalStaked: stakingPoolData.totalStaked.toString(),
                totalWeight: stakingPoolData.totalWeight.toString(),
                accRewardPerWeight: stakingPoolData.accRewardPerWeight.toString(),
                epochIndex: stakingPoolData.epochIndex.toString(),
                tokenType: stakingPoolData.tokenType.hasOwnProperty('spl') ? getPDAs_1.TokenType.SPL : getPDAs_1.TokenType.SOL,
                stakingPoolAddress: stakingPoolPublicKey.toString(),
                stakingEscrowPublicKey: stakingEscrowPublicKey.toString(),
                bump: stakingPoolData.bump.toString(),
            }
        };
    }
    catch (err) {
        console.error("❌ Error fetching staking pool data:", err);
        return {
            success: false,
            message: `Error fetching staking pool data: ${err.message || err}`
        };
    }
});
exports.getStakingPoolData = getStakingPoolData;
/**
 * Get all active stakers by scanning user staking accounts
 * Filters by tokenType to only return stakers for the specified pool
 */
const getActiveStakers = (adminPublicKey, tokenType) => __awaiter(void 0, void 0, void 0, function* () {
    // For backward compatibility, if no params provided, get all stakers
    if (!adminPublicKey || tokenType === undefined) {
        const { program } = (0, services_1.getProgram)();
        const userStakingAccounts = yield program.account.userStakingAccount.all();
        const activeStakers = userStakingAccounts.filter(account => {
            const userData = account.account;
            return userData.stakedAmount.gt(new anchor.BN(0));
        });
        // Return all stakers if no filter provided (old behavior)
        const stakersInfo = activeStakers.map(account => {
            const userData = account.account;
            const tokenDecimals = 9;
            const readableStakedAmount = userData.stakedAmount.toNumber() / (Math.pow(10, tokenDecimals));
            return {
                publicKey: account.publicKey.toString(),
                owner: userData.owner.toString(),
                stakedAmount: readableStakedAmount,
                stakedAmountFormatted: (0, exports.formatTokenAmount)(readableStakedAmount),
                stakeTimestamp: userData.stakeTimestamp.toString(),
                stakeDate: new Date(userData.stakeTimestamp.toNumber() * 1000).toISOString(),
                lockDuration: userData.lockDuration.toString(),
                lockDurationDays: Math.floor(userData.lockDuration.toNumber() / (24 * 60 * 60)),
                weight: userData.weight.toString(),
                rewardDebt: userData.rewardDebt.toString(),
                pendingRewards: userData.pendingRewards.toString(),
            };
        });
        return {
            success: true,
            data: {
                activeStakersCount: activeStakers.length,
                totalStakers: userStakingAccounts.length,
                stakers: stakersInfo
            }
        };
    }
    // New behavior: filter by tokenType
    try {
        const { program } = (0, services_1.getProgram)();
        // Derive the staking pool PDA for the given tokenType
        const stakingPoolPublicKey = (0, getPDAs_1.getStakingPoolPDA)(adminPublicKey, tokenType);
        console.log(`🔹 Filtering stakers for pool: ${stakingPoolPublicKey.toBase58()}`);
        console.log(`🔹 Token Type: ${tokenType === getPDAs_1.TokenType.SPL ? 'SPL' : 'SOL'}`);
        // Get all program accounts of type UserStakingAccount
        const userStakingAccounts = yield program.account.userStakingAccount.all();
        console.log(`🔹 Found ${userStakingAccounts.length} total user staking accounts`);
        // Filter to only accounts that belong to this specific staking pool
        // We check if the account's PDA can be derived from our staking pool
        const poolStakingAccounts = userStakingAccounts.filter(account => {
            try {
                const userData = account.account;
                // Derive what the PDA should be for this pool + owner
                const expectedPDA = (0, getPDAs_1.getUserStakingPDA)(stakingPoolPublicKey, userData.owner);
                // Check if this account matches our expected PDA
                return account.publicKey.equals(expectedPDA);
            }
            catch (_a) {
                return false;
            }
        });
        console.log(`🔹 Found ${poolStakingAccounts.length} staking accounts for this pool`);
        // Filter active stakers (those with staked amount > 0)
        const activeStakers = poolStakingAccounts.filter(account => {
            const userData = account.account;
            return userData.stakedAmount.gt(new anchor.BN(0));
        });
        console.log(`🔹 Active stakers for ${tokenType === getPDAs_1.TokenType.SPL ? 'SPL' : 'SOL'}: ${activeStakers.length}`);
        // Calculate detailed staker information
        const stakersInfo = activeStakers.map(account => {
            const userData = account.account;
            const tokenDecimals = 9; // Adjust based on your token decimals
            const readableStakedAmount = userData.stakedAmount.toNumber() / (Math.pow(10, tokenDecimals));
            return {
                publicKey: account.publicKey.toString(),
                owner: userData.owner.toString(),
                stakedAmount: readableStakedAmount,
                stakedAmountFormatted: (0, exports.formatTokenAmount)(readableStakedAmount),
                stakeTimestamp: userData.stakeTimestamp.toString(),
                stakeDate: new Date(userData.stakeTimestamp.toNumber() * 1000).toISOString(),
                lockDuration: userData.lockDuration.toString(),
                lockDurationDays: Math.floor(userData.lockDuration.toNumber() / (24 * 60 * 60)),
                weight: userData.weight.toString(),
                rewardDebt: userData.rewardDebt.toString(),
                pendingRewards: userData.pendingRewards.toString(),
            };
        });
        return {
            success: true,
            data: {
                activeStakersCount: activeStakers.length,
                totalStakers: userStakingAccounts.length,
                stakers: stakersInfo
            }
        };
    }
    catch (err) {
        console.error("❌ Error fetching active stakers:", err);
        return {
            success: false,
            message: `Error fetching active stakers: ${err.message || err}`
        };
    }
});
exports.getActiveStakers = getActiveStakers;
/**
 * Calculate APY based on staking rewards and time
 */
const calculateAPY = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // For now, we'll return a calculated APY based on your tokenomics
        // You might want to calculate this based on:
        // 1. Revenue from tournaments going to staking rewards
        // 2. Time-based multipliers for different lock periods
        // 3. Total staked amount vs circulating supply
        // Example calculation (adjust based on your actual reward mechanism):
        const baseAPY = 8.0; // Base 8% APY
        const tournamentBonusAPY = 4.4; // Additional 4.4% from tournament revenue
        const totalAPY = baseAPY + tournamentBonusAPY;
        return {
            success: true,
            data: {
                currentAPY: totalAPY,
                baseAPY: baseAPY,
                tournamentBonusAPY: tournamentBonusAPY,
                calculatedAt: new Date().toISOString()
            }
        };
    }
    catch (err) {
        console.error("❌ Error calculating APY:", err);
        return {
            success: false,
            message: `Error calculating APY: ${err.message || err}`
        };
    }
});
exports.calculateAPY = calculateAPY;
//# sourceMappingURL=stakingStatsService.js.map