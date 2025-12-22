"use strict";
//src/adminDashboard/services.ts
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
exports.getPlatformConfigService = exports.transferSuperAdminService = exports.updatePlatformWalletService = exports.updatePlatformConfigService = exports.initializePlatformConfigService = exports.checkPoolStatus = exports.initializeRewardPoolService = exports.initializePrizePoolService = exports.initializeStakingPoolService = void 0;
const web3_js_1 = require("@solana/web3.js");
const spl_token_1 = require("@solana/spl-token");
const dotenv_1 = __importDefault(require("dotenv"));
const services_1 = require("../staking/services");
dotenv_1.default.config();
const getPDAs_1 = require("../utils/getPDAs");
// ✅ Function to initialize the staking pool and escrow account
const initializeStakingPoolService = (mintPublicKey_1, ...args_1) => __awaiter(void 0, [mintPublicKey_1, ...args_1], void 0, function* (mintPublicKey, tokenType = getPDAs_1.TokenType.SPL, adminPublicKey) {
    try {
        const { program, connection } = (0, services_1.getProgram)();
        console.log("\n🔄 Creating staking pool initialization transaction...");
        console.log("Token Type:", tokenType === getPDAs_1.TokenType.SPL ? "SPL" : "SOL");
        console.log("Admin PublicKey:", adminPublicKey.toBase58());
        // Get staking pool PDA
        const stakingPoolPublicKey = (0, getPDAs_1.getStakingPoolPDA)(adminPublicKey, tokenType);
        console.log("🔹 Staking Pool PDA Address:", stakingPoolPublicKey.toBase58());
        // Get escrow PDA
        const poolEscrowAccountPublicKey = (0, getPDAs_1.getStakingEscrowPDA)(stakingPoolPublicKey);
        console.log("🔹 Pool Escrow Account Address:", poolEscrowAccountPublicKey.toBase58());
        const { blockhash } = yield connection.getLatestBlockhash("finalized");
        console.log("Latest Blockhash:", blockhash);
        // ✅ KEY FIX: For SOL, use SystemProgram as mint
        const actualMint = tokenType === getPDAs_1.TokenType.SOL
            ? web3_js_1.SystemProgram.programId // Dummy mint for SOL
            : mintPublicKey;
        // Build the transaction
        const tokenTypeArg = tokenType === getPDAs_1.TokenType.SPL ? { spl: {} } : { sol: {} };
        const transaction = yield program.methods
            .initializeAccounts(tokenTypeArg)
            .accounts({
            stakingPool: stakingPoolPublicKey,
            poolEscrowAccount: poolEscrowAccountPublicKey,
            mint: actualMint, // ✅ Use SystemProgram for SOL
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
            stakingPoolPublicKey: stakingPoolPublicKey.toBase58(),
            poolEscrowAccountPublicKey: poolEscrowAccountPublicKey.toBase58(),
            tokenType: tokenType === getPDAs_1.TokenType.SPL ? "SPL" : "SOL",
            transaction: transaction.serialize({ requireAllSignatures: false }).toString('base64'),
        };
    }
    catch (err) {
        console.error("❌ Error creating staking pool initialization transaction:", err);
        return {
            success: false,
            message: `Error creating transaction: ${err.message || err}`,
        };
    }
});
exports.initializeStakingPoolService = initializeStakingPoolService;
/**
* Initialize a prize pool for a specific tournament
* @param tournamentId - The tournament ID
* @param mintPublicKey - The token mint address
* @param tokenType - The token type
* @param adminPublicKey - The admin public key
* @returns Result object with transaction details and addresses
*/
/**
 * Initialize a prize pool for a specific tournament
 */
const initializePrizePoolService = (tournamentId, mintPublicKey, adminPublicKey, tokenType) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { program, connection } = (0, services_1.getProgram)();
        console.log("Initializing Prize Pool for Tournament:");
        console.log("Tournament ID:", tournamentId);
        console.log("Admin PublicKey:", adminPublicKey.toBase58());
        console.log("Token Type:", tokenType === getPDAs_1.TokenType.SPL ? "SPL" : "SOL");
        const tournamentPoolPublicKey = (0, getPDAs_1.getTournamentPoolPDA)(adminPublicKey, tournamentId, tokenType);
        console.log("🔹 Tournament Pool PDA Address:", tournamentPoolPublicKey.toString());
        const prizePoolPublicKey = (0, getPDAs_1.getPrizePoolPDA)(tournamentPoolPublicKey);
        console.log("🔹 Prize Pool PDA Address:", prizePoolPublicKey.toString());
        let prizeEscrowPublicKey;
        let finalMintPublicKey;
        if (tokenType === getPDAs_1.TokenType.SOL) {
            prizeEscrowPublicKey = web3_js_1.SystemProgram.programId;
            finalMintPublicKey = web3_js_1.SystemProgram.programId;
            console.log("🔹 SOL Prize Pool (no escrow needed)");
        }
        else {
            prizeEscrowPublicKey = (0, getPDAs_1.getPrizeEscrowPDA)(prizePoolPublicKey);
            finalMintPublicKey = mintPublicKey;
            console.log("🔹 Prize Escrow PDA Address:", prizeEscrowPublicKey.toString());
            console.log("🔹 Mint PublicKey:", mintPublicKey.toBase58());
        }
        const { blockhash } = yield connection.getLatestBlockhash("finalized");
        // ✅ Build instruction first, then modify account metas
        const instruction = yield program.methods
            .initializePrizePool(tournamentId)
            .accounts({
            prizePool: prizePoolPublicKey,
            tournamentPool: tournamentPoolPublicKey,
            prizeEscrowAccount: prizeEscrowPublicKey,
            mint: finalMintPublicKey,
            creator: adminPublicKey,
            systemProgram: web3_js_1.SystemProgram.programId,
            tokenProgram: tokenType === getPDAs_1.TokenType.SPL ? spl_token_1.TOKEN_2022_PROGRAM_ID : web3_js_1.SystemProgram.programId,
        })
            .instruction();
        // ✅ For SPL tournaments, ensure prize_escrow_account and mint are writable
        if (tokenType === getPDAs_1.TokenType.SPL) {
            const escrowAccountIndex = instruction.keys.findIndex(key => key.pubkey.equals(prizeEscrowPublicKey));
            if (escrowAccountIndex !== -1) {
                instruction.keys[escrowAccountIndex].isWritable = true;
                console.log("✅ Marked prize_escrow_account as writable");
            }
            const mintAccountIndex = instruction.keys.findIndex(key => key.pubkey.equals(finalMintPublicKey));
            if (mintAccountIndex !== -1) {
                instruction.keys[mintAccountIndex].isWritable = true;
                console.log("✅ Marked mint as writable");
            }
        }
        const transaction = new web3_js_1.Transaction().add(instruction);
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = adminPublicKey;
        return {
            success: true,
            message: "Transaction created successfully!",
            transaction: transaction.serialize({ requireAllSignatures: false }).toString('base64'),
            prizePool: prizePoolPublicKey.toString(),
            prizeEscrowAccountPublicKey: prizeEscrowPublicKey.toString(),
            tokenType: tokenType === getPDAs_1.TokenType.SPL ? "SPL" : "SOL",
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
const initializeRewardPoolService = (mintPublicKey_1, adminPublicKey_1, ...args_1) => __awaiter(void 0, [mintPublicKey_1, adminPublicKey_1, ...args_1], void 0, function* (mintPublicKey, adminPublicKey, tokenType = getPDAs_1.TokenType.SPL) {
    try {
        const { program, connection } = (0, services_1.getProgram)();
        // Derive PDAs
        const rewardPoolPublicKey = (0, getPDAs_1.getRewardPoolPDA)(adminPublicKey, tokenType);
        const rewardEscrowPublicKey = (0, getPDAs_1.getRewardEscrowPDA)(rewardPoolPublicKey);
        const actualMint = tokenType === getPDAs_1.TokenType.SOL
            ? web3_js_1.SystemProgram.programId // Dummy mint for SOL
            : mintPublicKey;
        const tokenTypeArg = tokenType === getPDAs_1.TokenType.SPL ? { spl: {} } : { sol: {} };
        // Build unsigned tx
        const { blockhash } = yield connection.getLatestBlockhash("finalized");
        const transaction = yield program.methods
            .initializeRewardPool(tokenTypeArg)
            .accounts({
            rewardPool: rewardPoolPublicKey,
            rewardEscrowAccount: rewardEscrowPublicKey,
            mint: actualMint,
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
            tokenType: tokenType === getPDAs_1.TokenType.SPL ? "SPL" : "SOL",
        };
    }
    catch (err) {
        console.error("❌ Error creating initializeRewardPool tx:", err);
        return { success: false, message: `Error creating tx: ${err.message || err}` };
    }
});
exports.initializeRewardPoolService = initializeRewardPoolService;
// ✅ Function to check pool status for staking and reward pools
const checkPoolStatus = (adminPublicKey, tokenType) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { program } = (0, services_1.getProgram)();
        const result = {
            success: true,
            stakingPool: {
                status: false, // false = needs initialization, true = exists
                tokenType: null,
            },
            rewardPool: {
                status: false, // false = needs initialization, true = exists
                tokenType: null,
            },
            adminAddress: adminPublicKey.toString()
        };
        // ✅ 1. Check Staking Pool
        const stakingPoolPublicKey = (0, getPDAs_1.getStakingPoolPDA)(adminPublicKey, tokenType);
        console.log("🔹 Checking Staking Pool PDA:", stakingPoolPublicKey.toString());
        const stakingPoolAccount = yield program.account.stakingPool.fetchNullable(stakingPoolPublicKey);
        result.stakingPool = {
            status: stakingPoolAccount !== null,
            tokenType: stakingPoolAccount ?
                (stakingPoolAccount.tokenType.hasOwnProperty('spl') ? 'SPL' : 'SOL') :
                null,
        };
        // ✅ 2. Check Reward Pool
        const rewardPoolPublicKey = (0, getPDAs_1.getRewardPoolPDA)(adminPublicKey, tokenType);
        console.log("🔹 Checking Reward Pool PDA:", rewardPoolPublicKey.toString());
        const rewardPoolAccount = yield program.account.rewardPool.fetchNullable(rewardPoolPublicKey);
        result.rewardPool = {
            status: rewardPoolAccount !== null,
            tokenType: rewardPoolAccount ?
                (rewardPoolAccount.tokenType.hasOwnProperty('spl') ? 'SPL' : 'SOL') :
                null,
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
// ==============================
// PLATFORM CONFIGURATION SERVICES
// ==============================
/**
 * Initialize platform configuration (super admin only, one-time)
 * Sets the revenue share split between developers and platform
 */
const initializePlatformConfigService = (superAdminPublicKey_1, platformWalletPublicKey_1, ...args_1) => __awaiter(void 0, [superAdminPublicKey_1, platformWalletPublicKey_1, ...args_1], void 0, function* (superAdminPublicKey, platformWalletPublicKey, developerShareBps = 9000, platformShareBps = 1000) {
    try {
        const { program, connection } = (0, services_1.getProgram)();
        const platformConfigPDA = (0, getPDAs_1.getPlatformConfigPDA)();
        // Validate shares sum to 10000 (100%)
        if (developerShareBps + platformShareBps !== 10000) {
            return {
                success: false,
                message: `Share percentages must sum to 10000 (100%). Current total: ${developerShareBps + platformShareBps}`
            };
        }
        // Validate share ranges
        if (developerShareBps < 0 || developerShareBps > 10000 ||
            platformShareBps < 0 || platformShareBps > 10000) {
            return {
                success: false,
                message: "Share percentages must be between 0 and 10000"
            };
        }
        console.log("Initializing Platform Config:");
        console.log("🔹 Platform Config PDA:", platformConfigPDA.toString());
        console.log("🔹 Super Admin:", superAdminPublicKey.toString());
        console.log("🔹 Platform Wallet:", platformWalletPublicKey.toString());
        console.log(`🔹 Developer Share: ${developerShareBps / 100}%`);
        console.log(`🔹 Platform Share: ${platformShareBps / 100}%`);
        const instruction = yield program.methods
            .initializePlatformConfig(developerShareBps, platformShareBps)
            .accounts({
            platformConfig: platformConfigPDA,
            platformWallet: platformWalletPublicKey,
            superAdmin: superAdminPublicKey,
            systemProgram: web3_js_1.SystemProgram.programId,
        })
            .instruction();
        const transaction = new web3_js_1.Transaction().add(instruction);
        const { blockhash } = yield connection.getLatestBlockhash("finalized");
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = superAdminPublicKey;
        return {
            success: true,
            message: "Platform config initialization transaction prepared",
            platformConfigPDA: platformConfigPDA.toString(),
            transaction: transaction.serialize({ requireAllSignatures: false }).toString('base64')
        };
    }
    catch (error) {
        console.error("❌ Error initializing platform config:", error);
        return {
            success: false,
            message: `Error initializing platform config: ${error.message || error}`
        };
    }
});
exports.initializePlatformConfigService = initializePlatformConfigService;
/**
 * Update platform configuration (super admin only)
 * Allows adjusting the revenue share percentages
 */
const updatePlatformConfigService = (superAdminPublicKey, developerShareBps, platformShareBps) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { program, connection } = (0, services_1.getProgram)();
        const platformConfigPDA = (0, getPDAs_1.getPlatformConfigPDA)();
        // Validate shares sum to 10000 (100%)
        if (developerShareBps + platformShareBps !== 10000) {
            return {
                success: false,
                message: `Share percentages must sum to 10000 (100%). Current total: ${developerShareBps + platformShareBps}`
            };
        }
        // Validate share ranges
        if (developerShareBps < 0 || developerShareBps > 10000 ||
            platformShareBps < 0 || platformShareBps > 10000) {
            return {
                success: false,
                message: "Share percentages must be between 0 and 10000"
            };
        }
        console.log("Updating Platform Config:");
        console.log("🔹 Platform Config PDA:", platformConfigPDA.toString());
        console.log("🔹 Super Admin:", superAdminPublicKey.toString());
        console.log(`🔹 Developer Share: ${developerShareBps / 100}%`);
        console.log(`🔹 Platform Share: ${platformShareBps / 100}%`);
        const instruction = yield program.methods
            .updatePlatformConfig(developerShareBps, platformShareBps)
            .accounts({
            platformConfig: platformConfigPDA,
            superAdmin: superAdminPublicKey,
        })
            .instruction();
        const transaction = new web3_js_1.Transaction().add(instruction);
        const { blockhash } = yield connection.getLatestBlockhash("finalized");
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = superAdminPublicKey;
        return {
            success: true,
            message: "Platform config update transaction prepared",
            transaction: transaction.serialize({ requireAllSignatures: false }).toString('base64')
        };
    }
    catch (error) {
        console.error("❌ Error updating platform config:", error);
        return {
            success: false,
            message: `Error updating platform config: ${error.message || error}`
        };
    }
});
exports.updatePlatformConfigService = updatePlatformConfigService;
/**
 * Update platform wallet (super admin only)
 */
const updatePlatformWalletService = (superAdminPublicKey, newPlatformWalletPublicKey) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { program, connection } = (0, services_1.getProgram)();
        const platformConfigPDA = (0, getPDAs_1.getPlatformConfigPDA)();
        console.log("Updating Platform Wallet:");
        console.log("🔹 Platform Config PDA:", platformConfigPDA.toString());
        console.log("🔹 Super Admin:", superAdminPublicKey.toString());
        console.log("🔹 New Platform Wallet:", newPlatformWalletPublicKey.toString());
        const instruction = yield program.methods
            .updatePlatformWallet()
            .accounts({
            platformConfig: platformConfigPDA,
            newPlatformWallet: newPlatformWalletPublicKey,
            superAdmin: superAdminPublicKey,
        })
            .instruction();
        const transaction = new web3_js_1.Transaction().add(instruction);
        const { blockhash } = yield connection.getLatestBlockhash("finalized");
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = superAdminPublicKey;
        return {
            success: true,
            message: "Platform wallet update transaction prepared",
            transaction: transaction.serialize({ requireAllSignatures: false }).toString('base64')
        };
    }
    catch (error) {
        console.error("❌ Error updating platform wallet:", error);
        return {
            success: false,
            message: `Error updating platform wallet: ${error.message || error}`
        };
    }
});
exports.updatePlatformWalletService = updatePlatformWalletService;
/**
 * Transfer super admin role (super admin only)
 */
const transferSuperAdminService = (superAdminPublicKey, newSuperAdminPublicKey) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { program, connection } = (0, services_1.getProgram)();
        const platformConfigPDA = (0, getPDAs_1.getPlatformConfigPDA)();
        console.log("Transferring Super Admin:");
        console.log("🔹 Platform Config PDA:", platformConfigPDA.toString());
        console.log("🔹 Current Super Admin:", superAdminPublicKey.toString());
        console.log("🔹 New Super Admin:", newSuperAdminPublicKey.toString());
        const instruction = yield program.methods
            .transferSuperAdmin()
            .accounts({
            platformConfig: platformConfigPDA,
            newSuperAdmin: newSuperAdminPublicKey,
            superAdmin: superAdminPublicKey,
        })
            .instruction();
        const transaction = new web3_js_1.Transaction().add(instruction);
        const { blockhash } = yield connection.getLatestBlockhash("finalized");
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = superAdminPublicKey;
        return {
            success: true,
            message: "Super admin transfer transaction prepared",
            transaction: transaction.serialize({ requireAllSignatures: false }).toString('base64')
        };
    }
    catch (error) {
        console.error("❌ Error transferring super admin:", error);
        return {
            success: false,
            message: `Error transferring super admin: ${error.message || error}`
        };
    }
});
exports.transferSuperAdminService = transferSuperAdminService;
/**
 * Get platform configuration
 */
const getPlatformConfigService = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { program } = (0, services_1.getProgram)();
        const platformConfigPDA = (0, getPDAs_1.getPlatformConfigPDA)();
        const config = (yield program.account.platformConfig.fetch(platformConfigPDA));
        return {
            success: true,
            data: {
                superAdmin: config.superAdmin.toString(),
                platformWallet: config.platformWallet.toString(),
                developerShareBps: Number(config.developerShareBps),
                platformShareBps: Number(config.platformShareBps),
                developerSharePercent: Number(config.developerShareBps) / 100,
                platformSharePercent: Number(config.platformShareBps) / 100,
                isInitialized: config.isInitialized,
                bump: config.bump,
            }
        };
    }
    catch (error) {
        console.error("❌ Error fetching platform config:", error);
        return {
            success: false,
            message: `Error fetching platform config: ${error.message || error}`,
            data: null
        };
    }
});
exports.getPlatformConfigService = getPlatformConfigService;
//# sourceMappingURL=services.js.map