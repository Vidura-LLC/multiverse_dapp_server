"use strict";
//src/adminDashboard/services.ts
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
exports.getStakingStats = exports.calculateAPY = exports.getActiveStakers = exports.getStakingPoolData = exports.initializeRevenuePoolService = exports.initializeStakingPoolService = exports.checkPoolStatus = void 0;
const web3_js_1 = require("@solana/web3.js");
const spl_token_1 = require("@solana/spl-token");
const dotenv_1 = __importDefault(require("dotenv"));
const services_1 = require("../staking/services");
dotenv_1.default.config();
const anchor = __importStar(require("@project-serum/anchor"));
// ✅ Function to check pool status for staking, revenue, and prize pools
const checkPoolStatus = (adminPublicKey, tournamentId) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { program } = (0, services_1.getProgram)();
        const result = {
            success: true,
            stakingPool: {
                status: false, // false = needs initialization, true = exists
                stakingPoolAddress: '',
                poolEscrowAccountAddress: '',
            },
            revenuePool: {
                status: false, // false = needs initialization, true = exists
                revenuePoolAddress: '',
                revenueEscrowAccountAddress: '',
            },
            adminAddress: adminPublicKey.toString()
        };
        // ✅ 1. Check Staking Pool
        const [stakingPoolPublicKey] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("staking_pool"), adminPublicKey.toBuffer()], program.programId);
        const [stakingEscrowAccountPublicKey] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("escrow"), stakingPoolPublicKey.toBuffer()], program.programId);
        console.log("🔹 Checking Staking Pool PDA:", stakingPoolPublicKey.toString());
        const stakingPoolAccount = yield program.account.stakingPool.fetch(stakingPoolPublicKey);
        result.stakingPool = {
            status: stakingPoolAccount !== null,
            stakingPoolAddress: stakingPoolPublicKey.toString(),
            poolEscrowAccountAddress: stakingEscrowAccountPublicKey.toString(),
        };
        // ✅ 2. Check Revenue Pool
        const [revenuePoolPublicKey] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("revenue_pool"), adminPublicKey.toBuffer()], program.programId);
        const [revenueEscrowAccountPublicKey] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("revenue_escrow"), revenuePoolPublicKey.toBuffer()], program.programId);
        console.log("🔹 Checking Revenue Pool PDA:", revenuePoolPublicKey.toString());
        const revenuePoolAccount = yield program.account.revenuePool.fetch(revenuePoolPublicKey);
        result.revenuePool = {
            status: revenuePoolAccount !== null,
            revenuePoolAddress: revenuePoolPublicKey.toString(),
            revenueEscrowAccountAddress: revenueEscrowAccountPublicKey.toString(),
        };
        return result;
    }
    catch (err) {
        console.error("❌ Error checking pool status:", err);
        return {
            success: false,
            message: `Error checking pool status: ${err.message || err}`
        };
    }
});
exports.checkPoolStatus = checkPoolStatus;
// ✅ Function to initialize the staking pool and escrow account
const initializeStakingPoolService = (mintPublicKey, adminPublicKey) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { program, connection } = (0, services_1.getProgram)();
        // ✅ Staking pool doesn't exist - create initialization transaction
        console.log("🔄 Creating staking pool initialization transaction...");
        console.log("Admin PublicKey:", adminPublicKey.toBase58());
        const [stakingPoolPublicKey] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("staking_pool"), adminPublicKey.toBuffer()], program.programId);
        const [poolEscrowAccountPublicKey] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("escrow"), stakingPoolPublicKey.toBuffer()], program.programId);
        console.log("🔹 Staking Pool PDA Address:", stakingPoolPublicKey.toString());
        console.log("🔹 Pool Escrow Account Address:", poolEscrowAccountPublicKey.toString());
        // Get the latest blockhash
        const { blockhash } = yield connection.getLatestBlockhash("finalized");
        console.log("Latest Blockhash:", blockhash);
        // Create the transaction
        const transaction = yield program.methods
            .initializeAccounts()
            .accounts({
            admin: adminPublicKey,
            stakingPool: stakingPoolPublicKey,
            mint: mintPublicKey,
            poolEscrowAccount: poolEscrowAccountPublicKey,
            systemProgram: web3_js_1.SystemProgram.programId,
            tokenProgram: spl_token_1.TOKEN_2022_PROGRAM_ID,
        })
            .transaction();
        // Set recent blockhash and fee payer
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = adminPublicKey;
        // Serialize transaction and send it to the frontend
        return {
            success: true,
            message: "Transaction created successfully!",
            stakingPoolPublicKey: stakingPoolPublicKey.toBase58(),
            poolEscrowAccountPublicKey: poolEscrowAccountPublicKey.toBase58(),
            transaction: transaction.serialize({ requireAllSignatures: false }).toString("base64"),
        };
    }
    catch (err) {
        console.error("❌ Error initializing staking pool:", err);
        return {
            success: false,
            message: `Error initializing staking pool: ${err.message || err}`
        };
    }
});
exports.initializeStakingPoolService = initializeStakingPoolService;
/**
 * Initialize the global revenue pool
 * @param mintPublicKey - The token mint address
 * @returns Result object with transaction details and addresses
 */
const initializeRevenuePoolService = (mintPublicKey, adminPublicKey) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { program, connection } = (0, services_1.getProgram)();
        // Log initial parameters for clarity
        console.log("Initializing Revenue Pool:");
        console.log("Admin PublicKey:", adminPublicKey.toBase58());
        console.log("Mint PublicKey:", mintPublicKey.toBase58());
        // Derive the PDA for the revenue pool
        const [revenuePoolPublicKey] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("revenue_pool"), adminPublicKey.toBuffer()], program.programId);
        // Derive the PDA for the revenue escrow account
        const [revenueEscrowPublicKey] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("revenue_escrow"), revenuePoolPublicKey.toBuffer()], program.programId);
        console.log("🔹 Revenue Pool PDA Address:", revenuePoolPublicKey.toString());
        console.log("🔹 Revenue Escrow PDA Address:", revenueEscrowPublicKey.toString());
        // Get the latest blockhash
        const { blockhash } = yield connection.getLatestBlockhash("finalized");
        console.log("Latest Blockhash:", blockhash);
        // Create the transaction
        const transaction = yield program.methods
            .initializeRevenuePool()
            .accounts({
            revenuePool: revenuePoolPublicKey,
            revenueEscrowAccount: revenueEscrowPublicKey,
            mint: mintPublicKey,
            admin: adminPublicKey,
            systemProgram: anchor.web3.SystemProgram.programId,
            tokenProgram: spl_token_1.TOKEN_2022_PROGRAM_ID,
        })
            .transaction();
        // Set recent blockhash and fee payer
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = adminPublicKey;
        // Serialize transaction and send it to the frontend
        return {
            success: true,
            message: "Transaction created successfully!",
            transaction: transaction.serialize({ requireAllSignatures: false }).toString('base64'),
        };
    }
    catch (err) {
        console.error("❌ Error initializing revenue pool:", err);
        return {
            success: false,
            message: `Error initializing revenue pool: ${err.message || err}`
        };
    }
});
exports.initializeRevenuePoolService = initializeRevenuePoolService;
/**
* Get the staking pool data from the blockchain
*/
const getStakingPoolData = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { program, adminPublicKey } = (0, services_1.getProgram)();
        // Derive the staking pool PDA
        const [stakingPoolPublicKey] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("staking_pool"), adminPublicKey.toBuffer()], program.programId);
        console.log("🔹 Fetching Staking Pool PDA:", stakingPoolPublicKey.toString());
        // Fetch the staking pool data
        const stakingPoolData = yield program.account.stakingPool.fetch(stakingPoolPublicKey);
        return {
            success: true,
            data: {
                admin: stakingPoolData.admin.toString(),
                mint: stakingPoolData.mint.toString(),
                totalStaked: stakingPoolData.totalStaked.toString(),
                stakingPoolAddress: stakingPoolPublicKey.toString(),
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
 * Note: This is a simplified approach. In production, you might want to maintain
 * a list of stakers in your database for better performance.
 */
const getActiveStakers = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { program, connection } = (0, services_1.getProgram)();
        // Get all program accounts of type UserStakingAccount
        const userStakingAccounts = yield program.account.userStakingAccount.all();
        console.log(`🔹 Found ${userStakingAccounts.length} user staking accounts`);
        // Filter active stakers (those with staked amount > 0)
        const activeStakers = userStakingAccounts.filter(account => {
            const userData = account.account;
            return userData.stakedAmount.gt(new anchor.BN(0));
        });
        console.log(`🔹 Active stakers: ${activeStakers.length}`);
        // Calculate detailed staker information
        const stakersInfo = activeStakers.map(account => {
            const userData = account.account;
            const tokenDecimals = 9; // Adjust based on your token decimals
            const readableStakedAmount = userData.stakedAmount.toNumber() / (Math.pow(10, tokenDecimals));
            return {
                publicKey: account.publicKey.toString(),
                owner: userData.owner.toString(),
                stakedAmount: readableStakedAmount,
                stakeTimestamp: userData.stakeTimestamp.toString(),
                lockDuration: userData.lockDuration.toString(),
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
 * This is a simplified calculation - you may need to adjust based on your reward mechanism
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
/**
 * Get comprehensive staking statistics
 */
const getStakingStats = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        console.log("📊 Fetching comprehensive staking statistics...");
        // Fetch all data in parallel
        const [poolResult, stakersResult, apyResult] = yield Promise.all([
            (0, exports.getStakingPoolData)(),
            (0, exports.getActiveStakers)(),
            (0, exports.calculateAPY)()
        ]);
        // Check if any requests failed
        if (!poolResult.success) {
            return {
                success: false,
                message: `Failed to fetch pool data: ${poolResult.message}`
            };
        }
        if (!stakersResult.success) {
            return {
                success: false,
                message: `Failed to fetch stakers data: ${stakersResult.message}`
            };
        }
        if (!apyResult.success) {
            return {
                success: false,
                message: `Failed to calculate APY: ${apyResult.message}`
            };
        }
        // Convert total staked to readable format
        const tokenDecimals = 9; // Adjust based on your token decimals
        const totalStakedRaw = new anchor.BN(poolResult.data.totalStaked);
        const totalStakedReadable = totalStakedRaw.toNumber() / (Math.pow(10, tokenDecimals));
        return {
            success: true,
            data: {
                totalStaked: {
                    raw: poolResult.data.totalStaked,
                    formatted: totalStakedReadable.toLocaleString(),
                    readable: totalStakedReadable
                },
                activeStakers: stakersResult.data.activeStakersCount,
                totalStakers: stakersResult.data.totalStakers,
                currentAPY: apyResult.data.currentAPY,
                apyBreakdown: {
                    baseAPY: apyResult.data.baseAPY,
                    tournamentBonusAPY: apyResult.data.tournamentBonusAPY
                },
                stakingPoolAddress: poolResult.data.stakingPoolAddress,
                mintAddress: poolResult.data.mint,
                lastUpdated: new Date().toISOString()
            }
        };
    }
    catch (err) {
        console.error("❌ Error fetching staking statistics:", err);
        return {
            success: false,
            message: `Error fetching staking statistics: ${err.message || err}`
        };
    }
});
exports.getStakingStats = getStakingStats;
//# sourceMappingURL=services.js.map