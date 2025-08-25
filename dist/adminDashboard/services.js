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
exports.checkPoolStatus = exports.initializeRewardPoolService = exports.initializePrizePoolService = exports.initializeRevenuePoolService = exports.initializeStakingPoolService = void 0;
const web3_js_1 = require("@solana/web3.js");
const spl_token_1 = require("@solana/spl-token");
const dotenv_1 = __importDefault(require("dotenv"));
const services_1 = require("../staking/services");
dotenv_1.default.config();
const anchor = __importStar(require("@project-serum/anchor"));
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
* Initialize a prize pool for a specific tournament
* @param tournamentId - The tournament ID
* @param mintPublicKey - The token mint address
* @returns Result object with transaction details and addresses
*/
const initializePrizePoolService = (tournamentId, mintPublicKey, adminPublicKey) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { program, connection } = (0, services_1.getProgram)();
        // Log initial parameters for clarity
        console.log("Initializing Prize Pool for Tournament:");
        console.log("Tournament ID:", tournamentId);
        console.log("Admin PublicKey:", adminPublicKey.toBase58());
        console.log("Mint PublicKey:", mintPublicKey.toBase58());
        // First, derive the tournament pool PDA to ensure it exists
        const tournamentIdBytes = Buffer.from(tournamentId, "utf8");
        const [tournamentPoolPublicKey] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("tournament_pool"), adminPublicKey.toBuffer(), tournamentIdBytes], program.programId);
        console.log("🔹 Tournament Pool PDA Address:", tournamentPoolPublicKey.toString());
        // Add this to initializePrizePoolService
        console.log("Full tournament pool key:", tournamentPoolPublicKey.toString());
        console.log("Tournament ID bytes:", tournamentIdBytes);
        console.log("Admin pubkey:", adminPublicKey.toString());
        // Derive the PDA for the prize pool (now derived from tournament pool)
        const [prizePoolPublicKey] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("prize_pool"), tournamentPoolPublicKey.toBuffer()], program.programId);
        // Derive the PDA for the prize escrow account
        const [prizeEscrowPublicKey] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("prize_escrow"), prizePoolPublicKey.toBuffer()], program.programId);
        console.log("🔹 Prize Pool PDA Address:", prizePoolPublicKey.toString());
        console.log("🔹 Prize Escrow PDA Address:", prizeEscrowPublicKey.toString());
        // Get the latest blockhash
        const { blockhash } = yield connection.getLatestBlockhash("finalized");
        console.log("Latest Blockhash:", blockhash);
        // Create the transaction
        const transaction = yield program.methods
            .initializePrizePool(tournamentId)
            .accounts({
            prizePool: prizePoolPublicKey,
            tournamentPool: tournamentPoolPublicKey,
            prizeEscrowAccount: prizeEscrowPublicKey,
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
            prizePool: prizePoolPublicKey.toString(),
        };
    }
    catch (err) {
        console.error("❌ Error initializing prize pool:", err);
        return {
            success: false,
            message: `Error initializing prize pool: ${err.message || err}`
        };
    }
});
exports.initializePrizePoolService = initializePrizePoolService;
// ✅ Initialize Reward Pool (admin-only)
const initializeRewardPoolService = (mintPublicKey, adminPublicKey) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { program, connection } = (0, services_1.getProgram)();
        // Derive PDAs
        const [rewardPoolPublicKey] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("reward_pool"), adminPublicKey.toBuffer()], program.programId);
        const [rewardEscrowPublicKey] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("reward_escrow"), rewardPoolPublicKey.toBuffer()], program.programId);
        // Build unsigned tx
        const { blockhash } = yield connection.getLatestBlockhash("finalized");
        const transaction = yield program.methods
            .initializeRewardPool()
            .accounts({
            rewardPool: rewardPoolPublicKey,
            rewardEscrowAccount: rewardEscrowPublicKey,
            mint: mintPublicKey,
            admin: adminPublicKey,
            systemProgram: web3_js_1.SystemProgram.programId,
            tokenProgram: spl_token_1.TOKEN_2022_PROGRAM_ID,
        })
            .transaction();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = adminPublicKey;
        return {
            success: true,
            message: "Transaction created successfully!",
            rewardPool: rewardPoolPublicKey.toBase58(),
            rewardEscrow: rewardEscrowPublicKey.toBase58(),
            transaction: transaction.serialize({ requireAllSignatures: false }).toString("base64"),
        };
    }
    catch (err) {
        console.error("❌ Error creating initializeRewardPool tx:", err);
        return { success: false, message: `Error creating tx: ${err.message || err}` };
    }
});
exports.initializeRewardPoolService = initializeRewardPoolService;
// ✅ Function to check pool status for staking, revenue, and prize pools
const checkPoolStatus = (adminPublicKey, tournamentId) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { program } = (0, services_1.getProgram)();
        const result = {
            success: true,
            stakingPool: {
                status: false, // false = needs initialization, true = exists
            },
            revenuePool: {
                status: false, // false = needs initialization, true = exists
            },
            rewardPool: {
                status: false, // false = needs initialization, true = exists
            },
            adminAddress: adminPublicKey.toString()
        };
        // ✅ 1. Check Staking Pool
        const [stakingPoolPublicKey] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("staking_pool"), adminPublicKey.toBuffer()], program.programId);
        const [stakingEscrowAccountPublicKey] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("escrow"), stakingPoolPublicKey.toBuffer()], program.programId);
        console.log("🔹 Checking Staking Pool PDA:", stakingPoolPublicKey.toString());
        const stakingPoolAccount = yield program.account.stakingPool.fetchNullable(stakingPoolPublicKey);
        result.stakingPool = {
            status: stakingPoolAccount !== null,
        };
        // ✅ 2. Check Revenue Pool
        const [revenuePoolPublicKey] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("revenue_pool"), adminPublicKey.toBuffer()], program.programId);
        const [revenueEscrowAccountPublicKey] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("revenue_escrow"), revenuePoolPublicKey.toBuffer()], program.programId);
        console.log("🔹 Checking Revenue Pool PDA:", revenuePoolPublicKey.toString());
        const revenuePoolAccount = yield program.account.revenuePool.fetchNullable(revenuePoolPublicKey);
        result.revenuePool = {
            status: revenuePoolAccount !== null,
        };
        // ✅ 3. Check Reward Pool
        const [rewardPoolPublicKey] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("reward_pool"), adminPublicKey.toBuffer()], program.programId);
        const [rewardEscrowAccountPublicKey] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("reward_escrow"), rewardPoolPublicKey.toBuffer()], program.programId);
        console.log("🔹 Checking Reward Pool PDA:", rewardPoolPublicKey.toString());
        const rewardPoolAccount = yield program.account.rewardPool.fetchNullable(rewardPoolPublicKey);
        result.rewardPool = {
            status: rewardPoolAccount !== null,
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
//# sourceMappingURL=services.js.map