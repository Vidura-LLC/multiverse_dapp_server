"use strict";
//backend/src/staking/services.ts
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
exports.createAssociatedTokenAccount = exports.accrueRewardsService = exports.getUserStakingAccount = exports.claimRewardsService = exports.unstakeTokenService = exports.stakeTokenService = exports.getProgram = void 0;
const web3_js_1 = require("@solana/web3.js");
const anchor = __importStar(require("@project-serum/anchor"));
const spl_token_1 = require("@solana/spl-token");
const dotenv_1 = __importDefault(require("dotenv"));
const getPDAs_1 = require("../utils/getPDAs");
dotenv_1.default.config();
// Helper function to get the program
const getProgram = () => {
    const idl = require("../staking/idl_developer_split.json");
    const walletKeypair = require("../staking/developer_split-Admin-wallet-keypair.json");
    const adminKeypair = web3_js_1.Keypair.fromSecretKey(new Uint8Array(walletKeypair));
    const adminPublicKey = adminKeypair.publicKey;
    const connection = new web3_js_1.Connection("https://api.devnet.solana.com", "confirmed");
    const programId = new web3_js_1.PublicKey("DgQ1EXnbWqgSeMwQBwPeaphmT76Jpsapegd9kQKJ6buX");
    const provider = new anchor.AnchorProvider(connection, new anchor.Wallet(adminKeypair), anchor.AnchorProvider.defaultOptions());
    anchor.setProvider(provider);
    return {
        program: new anchor.Program(idl, programId, provider),
        adminPublicKey,
        adminKeypair,
        connection,
    };
};
exports.getProgram = getProgram;
// Function to stake tokens into the staking pool
const stakeTokenService = (mintPublicKey, userPublicKey, amount, lockDuration, adminPublicKey, tokenType) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { program, connection } = (0, exports.getProgram)();
        console.log("Staking Details:");
        console.log("User PublicKey:", userPublicKey.toBase58());
        console.log("Admin PublicKey:", adminPublicKey.toBase58());
        console.log("Amount to stake:", amount);
        console.log("Lock Duration (in seconds):", lockDuration);
        console.log("Token Type:", tokenType === getPDAs_1.TokenType.SPL ? "SPL" : "SOL");
        if (!lockDuration || typeof lockDuration !== 'number') {
            throw new Error('Invalid lock duration provided');
        }
        const stakingPoolPublicKey = (0, getPDAs_1.getStakingPoolPDA)(adminPublicKey, tokenType);
        const userStakingAccountPublicKey = (0, getPDAs_1.getUserStakingPDA)(stakingPoolPublicKey, userPublicKey);
        // ✅ FIX: Use actual SOL vault PDA
        const poolEscrowAccountPublicKey = tokenType === getPDAs_1.TokenType.SOL
            ? (0, getPDAs_1.getSOLVaultPDA)(stakingPoolPublicKey) // ✅ Use actual SOL vault
            : (0, getPDAs_1.getStakingEscrowPDA)(stakingPoolPublicKey);
        const actualMint = tokenType === getPDAs_1.TokenType.SOL
            ? web3_js_1.SystemProgram.programId
            : mintPublicKey;
        let userTokenAccountPublicKey;
        if (tokenType === getPDAs_1.TokenType.SPL) {
            userTokenAccountPublicKey = (0, spl_token_1.getAssociatedTokenAddressSync)(mintPublicKey, userPublicKey, false, spl_token_1.TOKEN_2022_PROGRAM_ID);
            console.log("User Token Account PublicKey:", userTokenAccountPublicKey.toBase58());
            const ataInfo = yield connection.getAccountInfo(userTokenAccountPublicKey);
            if (!ataInfo) {
                console.log("⚠️ User Token Account does not exist. User needs to create ATA first.");
            }
        }
        else {
            userTokenAccountPublicKey = web3_js_1.SystemProgram.programId;
        }
        const { blockhash } = yield connection.getLatestBlockhash("finalized");
        const tokenDecimals = 9;
        const amountInBaseUnits = Math.floor(amount * Math.pow(10, tokenDecimals));
        console.log(`Converting ${amount} tokens to ${amountInBaseUnits} base units`);
        console.log("Pool Escrow Account:", poolEscrowAccountPublicKey.toBase58());
        // Build instruction
        const instruction = yield program.methods
            .stake(new anchor.BN(amountInBaseUnits), new anchor.BN(lockDuration))
            .accounts({
            user: userPublicKey,
            stakingPool: stakingPoolPublicKey,
            userStakingAccount: userStakingAccountPublicKey,
            userTokenAccount: userTokenAccountPublicKey,
            poolEscrowAccount: poolEscrowAccountPublicKey,
            mint: actualMint,
            tokenProgram: spl_token_1.TOKEN_2022_PROGRAM_ID,
            systemProgram: web3_js_1.SystemProgram.programId,
        })
            .instruction();
        // ✅ Mark pool_escrow_account as writable for BOTH token types
        const escrowIndex = instruction.keys.findIndex(k => k.pubkey.equals(poolEscrowAccountPublicKey));
        if (escrowIndex !== -1) {
            instruction.keys[escrowIndex].isWritable = true;
            console.log(`✅ Marked pool_escrow_account as writable`);
        }
        // ✅ For SPL, also mark user_token_account as writable
        if (tokenType === getPDAs_1.TokenType.SPL) {
            const userTokenIndex = instruction.keys.findIndex(k => k.pubkey.equals(userTokenAccountPublicKey));
            if (userTokenIndex !== -1) {
                instruction.keys[userTokenIndex].isWritable = true;
                console.log(`✅ Marked user_token_account as writable for SPL`);
            }
        }
        const transaction = new web3_js_1.Transaction();
        transaction.add(instruction);
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = userPublicKey;
        console.log("✅ Transaction accounts:");
        instruction.keys.forEach((key, idx) => {
            console.log(`  ${idx}: ${key.pubkey.toBase58()} - Signer: ${key.isSigner}, Writable: ${key.isWritable}`);
        });
        return {
            success: true,
            message: "Transaction created successfully!",
            transaction: transaction.serialize({ requireAllSignatures: false }).toString('base64'),
        };
    }
    catch (err) {
        console.error("❌ Error creating staking transaction:", err);
        return {
            success: false,
            message: `Error creating staking transaction: ${err.message || err}`
        };
    }
});
exports.stakeTokenService = stakeTokenService;
// Function to unstake tokens from the staking pool
const unstakeTokenService = (mintPublicKey, userPublicKey, adminPublicKey, tokenType) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { program, connection } = (0, exports.getProgram)();
        console.log("Unstaking Details:");
        console.log("User PublicKey:", userPublicKey.toBase58());
        console.log("Admin PublicKey:", adminPublicKey.toBase58());
        console.log("Token Type:", tokenType === getPDAs_1.TokenType.SPL ? "SPL" : "SOL");
        const stakingPoolPublicKey = (0, getPDAs_1.getStakingPoolPDA)(adminPublicKey, tokenType);
        const userStakingAccountPublicKey = (0, getPDAs_1.getUserStakingPDA)(stakingPoolPublicKey, userPublicKey);
        // ✅ FIX: Use actual SOL vault PDA, not SystemProgram
        const poolEscrowAccountPublicKey = tokenType === getPDAs_1.TokenType.SOL
            ? (0, getPDAs_1.getSOLVaultPDA)(stakingPoolPublicKey) // ✅ Use actual SOL vault
            : (0, getPDAs_1.getStakingEscrowPDA)(stakingPoolPublicKey);
        const userStakingAccountResponse = yield (0, exports.getUserStakingAccount)(userPublicKey, adminPublicKey, tokenType);
        console.log("User Staking Account Response:", userStakingAccountResponse);
        if (userStakingAccountResponse.success && userStakingAccountResponse.data) {
            const stakedAmount = userStakingAccountResponse.data.stakedAmount;
            const stakedAmountRaw = userStakingAccountResponse.data.stakedAmountRaw || '0';
            console.log(`Unstaking ${stakedAmount} tokens (${stakedAmountRaw} base units)`);
        }
        const actualMint = tokenType === getPDAs_1.TokenType.SOL
            ? web3_js_1.SystemProgram.programId
            : mintPublicKey;
        let userTokenAccountPublicKey;
        if (tokenType === getPDAs_1.TokenType.SPL) {
            userTokenAccountPublicKey = (0, spl_token_1.getAssociatedTokenAddressSync)(mintPublicKey, userPublicKey, false, spl_token_1.TOKEN_2022_PROGRAM_ID);
            console.log("User Token Account PublicKey:", userTokenAccountPublicKey.toBase58());
            const ataInfo = yield connection.getAccountInfo(userTokenAccountPublicKey);
            if (!ataInfo) {
                console.log("⚠️ User Token Account does not exist. User needs to create ATA first.");
            }
        }
        else {
            userTokenAccountPublicKey = web3_js_1.SystemProgram.programId;
        }
        const { blockhash } = yield connection.getLatestBlockhash('finalized');
        console.log("Pool Escrow Account:", poolEscrowAccountPublicKey.toBase58());
        // Build instruction
        const instruction = yield program.methods
            .unstake()
            .accounts({
            user: userPublicKey,
            stakingPool: stakingPoolPublicKey,
            userStakingAccount: userStakingAccountPublicKey,
            userTokenAccount: userTokenAccountPublicKey,
            poolEscrowAccount: poolEscrowAccountPublicKey,
            mint: actualMint,
            tokenProgram: spl_token_1.TOKEN_2022_PROGRAM_ID,
            systemProgram: web3_js_1.SystemProgram.programId,
        })
            .instruction();
        // ✅ Mark pool_escrow_account as writable for BOTH token types
        const escrowIndex = instruction.keys.findIndex(k => k.pubkey.equals(poolEscrowAccountPublicKey));
        if (escrowIndex !== -1) {
            instruction.keys[escrowIndex].isWritable = true;
            console.log(`✅ Marked pool_escrow_account as writable`);
        }
        // ✅ For SPL, also mark user_token_account as writable
        if (tokenType === getPDAs_1.TokenType.SPL) {
            const userTokenIndex = instruction.keys.findIndex(k => k.pubkey.equals(userTokenAccountPublicKey));
            if (userTokenIndex !== -1) {
                instruction.keys[userTokenIndex].isWritable = true;
                console.log(`✅ Marked user_token_account as writable for SPL`);
            }
        }
        const transaction = new web3_js_1.Transaction();
        transaction.add(instruction);
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = userPublicKey;
        console.log("✅ Transaction accounts:");
        instruction.keys.forEach((key, idx) => {
            console.log(`  ${idx}: ${key.pubkey.toBase58()} - Signer: ${key.isSigner}, Writable: ${key.isWritable}`);
        });
        return {
            success: true,
            message: "Transaction created successfully!",
            tokenType: tokenType === getPDAs_1.TokenType.SPL ? "SPL" : "SOL",
            transaction: transaction.serialize({ requireAllSignatures: false }).toString('base64'),
        };
    }
    catch (err) {
        console.error("❌ Error creating unstake transaction:", err);
        return {
            success: false,
            message: `Error creating unstake transaction: ${err.message || err}`
        };
    }
});
exports.unstakeTokenService = unstakeTokenService;
// Function to claim staking rewards
const claimRewardsService = (userPublicKey, adminPublicKey, tokenType) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { program, connection } = (0, exports.getProgram)();
        const stakingPoolPublicKey = (0, getPDAs_1.getStakingPoolPDA)(adminPublicKey, tokenType);
        const userStakingAccountPublicKey = (0, getPDAs_1.getUserStakingPDA)(stakingPoolPublicKey, userPublicKey);
        const rewardPoolPublicKey = (0, getPDAs_1.getRewardPoolPDA)(adminPublicKey, tokenType);
        const rewardEscrowPublicKey = (0, getPDAs_1.getRewardEscrowPDA)(rewardPoolPublicKey);
        // Fetch staking pool to obtain mint
        const stakingPoolAccount = yield program.account.stakingPool.fetch(stakingPoolPublicKey);
        const mintPublicKey = stakingPoolAccount.mint;
        // Ensure the user has an ATA
        let userTokenAccountPublicKey = yield (0, spl_token_1.getAssociatedTokenAddressSync)(mintPublicKey, userPublicKey, false, spl_token_1.TOKEN_2022_PROGRAM_ID);
        const accountInfo = yield connection.getAccountInfo(userTokenAccountPublicKey);
        if (!accountInfo) {
            const createATA = yield (0, exports.createAssociatedTokenAccount)(mintPublicKey, userPublicKey);
            if (!createATA.success) {
                throw new Error('Failed to create associated token account');
            }
            userTokenAccountPublicKey = createATA.associatedTokenAddress;
        }
        const { blockhash } = yield connection.getLatestBlockhash('finalized');
        const transaction = yield program.methods
            .claimRewards()
            .accounts({
            user: userPublicKey,
            stakingPool: stakingPoolPublicKey,
            userStakingAccount: userStakingAccountPublicKey,
            rewardPool: rewardPoolPublicKey,
            userTokenAccount: userTokenAccountPublicKey,
            rewardEscrowAccount: rewardEscrowPublicKey,
            mint: mintPublicKey,
            tokenProgram: spl_token_1.TOKEN_2022_PROGRAM_ID,
        })
            .transaction();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = userPublicKey;
        return {
            success: true,
            message: 'Transaction created successfully!',
            transaction: transaction.serialize({ requireAllSignatures: false }).toString('base64'),
        };
    }
    catch (err) {
        console.error('❌ Error creating claim transaction:', err);
        return { success: false, message: `Error creating claim transaction: ${err.message || err}` };
    }
});
exports.claimRewardsService = claimRewardsService;
const getUserStakingAccount = (userPublicKey, adminPublicKey, tokenType) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { program, connection } = (0, exports.getProgram)();
        const stakingPoolPublicKey = (0, getPDAs_1.getStakingPoolPDA)(adminPublicKey, tokenType);
        console.log("Token Type:", tokenType === getPDAs_1.TokenType.SPL ? "SPL" : "SOL");
        console.log("Staking Pool PublicKey:", stakingPoolPublicKey.toBase58());
        console.log("User PublicKey:", userPublicKey.toBase58());
        console.log("Admin PublicKey:", adminPublicKey.toBase58());
        // Derive the public key for the user staking account
        const userStakingAccountPublicKey = (0, getPDAs_1.getUserStakingPDA)(stakingPoolPublicKey, userPublicKey);
        console.log(userStakingAccountPublicKey);
        // Check if the user staking account exists
        const accountExists = yield connection.getAccountInfo(userStakingAccountPublicKey);
        if (!accountExists) {
            return { success: false, message: "User has not staked any tokens yet." };
        }
        // Fetch staking data
        const userStakingAccount = yield program.account.userStakingAccount.fetch(userStakingAccountPublicKey);
        console.log("Raw userStakingAccount:", userStakingAccount);
        console.log("Raw stakedAmount (base units):", userStakingAccount.stakedAmount.toString());
        console.log("Raw stakedAmount as number:", userStakingAccount.stakedAmount.toNumber());
        // Helper function to convert BN to decimal with proper precision
        // This avoids JavaScript floating point precision issues by using string manipulation
        const convertBaseUnitsToReadable = (amountBN, decimals) => {
            const amountStr = amountBN.toString();
            // Handle zero case
            if (amountStr === '0') {
                return 0;
            }
            // Pad the string with leading zeros if needed to ensure we have enough digits
            const paddedAmount = amountStr.padStart(decimals, '0');
            // Split into integer and decimal parts
            let integerPart;
            let decimalPart;
            if (paddedAmount.length <= decimals) {
                // Amount is smaller than 1 full unit
                integerPart = '0';
                decimalPart = paddedAmount;
            }
            else {
                // Split at the decimal point
                integerPart = paddedAmount.slice(0, -decimals) || '0';
                decimalPart = paddedAmount.slice(-decimals);
            }
            // Remove trailing zeros from decimal part for cleaner output
            const trimmedDecimal = decimalPart.replace(/0+$/, '');
            // Construct the final number string
            let numberString;
            if (trimmedDecimal === '') {
                numberString = integerPart;
            }
            else {
                numberString = integerPart + '.' + trimmedDecimal;
            }
            // Convert to number - this preserves precision better than simple division
            const result = Number(numberString);
            console.log(`Converting ${amountStr} base units: ${numberString} -> ${result}`);
            return result;
        };
        // Convert amounts from base units to human-readable tokens
        const tokenDecimals = 9; // SOL and most tokens use 9 decimals
        const readableStakedAmount = convertBaseUnitsToReadable(userStakingAccount.stakedAmount, tokenDecimals);
        const readableRewardDebt = convertBaseUnitsToReadable(userStakingAccount.rewardDebt, tokenDecimals);
        const readablePendingRewards = convertBaseUnitsToReadable(userStakingAccount.pendingRewards, tokenDecimals);
        // Ensure that the fields are defined and use safe .toString() calls
        const rawData = {
            owner: userStakingAccount.owner.toBase58(),
            stakedAmount: readableStakedAmount,
            stakedAmountRaw: userStakingAccount.stakedAmount.toString(), // Raw base units for debugging
            stakeTimestamp: userStakingAccount.stakeTimestamp.toString(),
            stakeDuration: userStakingAccount.lockDuration.toString(),
            weight: userStakingAccount.weight.toString(),
            rewardDebt: readableRewardDebt,
            pendingRewards: readablePendingRewards,
        };
        console.log("Converted User Staking Account Data:", rawData);
        console.log(`Staked Amount: ${readableStakedAmount} tokens (${userStakingAccount.stakedAmount.toString()} base units)`);
        return { success: true, data: rawData };
    }
    catch (err) {
        console.error("❌ Error fetching user staking account:", err);
        return { success: false, message: "Error fetching user staking account." };
    }
});
exports.getUserStakingAccount = getUserStakingAccount;
// Function to accrue pending rewards for a specific staker
const accrueRewardsService = (userPublicKey, adminPublicKey, tokenType) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { program, connection } = (0, exports.getProgram)();
        console.log("Accruing rewards for user:", userPublicKey.toBase58());
        // Get the staking pool PDA
        const stakingPoolPublicKey = (0, getPDAs_1.getStakingPoolPDA)(adminPublicKey, tokenType);
        // Get the user staking account PDA
        const userStakingPublicKey = (0, getPDAs_1.getUserStakingPDA)(stakingPoolPublicKey, userPublicKey);
        // Build an unsigned transaction for the user to sign
        const { blockhash } = yield connection.getLatestBlockhash('finalized');
        const transaction = yield program.methods
            .accrueRewards()
            .accounts({
            user: userPublicKey,
            stakingPool: stakingPoolPublicKey,
            userStakingAccount: userStakingPublicKey,
            systemProgram: anchor.web3.SystemProgram.programId,
        })
            .transaction();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = userPublicKey;
        return {
            success: true,
            message: 'Transaction created successfully! Please sign to accrue rewards.',
            transaction: transaction.serialize({ requireAllSignatures: false }).toString('base64'),
        };
    }
    catch (error) {
        console.error("❌ Error accruing rewards:", error);
        return {
            success: false,
            message: "Failed to accrue rewards",
            error: error instanceof Error ? error.message : "Unknown error"
        };
    }
});
exports.accrueRewardsService = accrueRewardsService;
// To create an associated token account for a user
const createAssociatedTokenAccount = (mintPublicKey, userPublicKey) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { connection } = (0, exports.getProgram)(); // You may need to adjust how you retrieve these
        // Get or create the associated token account for the user
        const associatedTokenAddress = yield (0, spl_token_1.getAssociatedTokenAddressSync)(mintPublicKey, userPublicKey, false, spl_token_1.TOKEN_2022_PROGRAM_ID);
        // Check if the associated token account already exists
        const accountInfo = yield connection.getAccountInfo(associatedTokenAddress);
        if (!accountInfo) {
            console.log(`🔹 Token account does not exist. Creating ATA: ${associatedTokenAddress.toBase58()}`);
            // Get the recent blockhash
            const { blockhash } = yield connection.getLatestBlockhash("finalized");
            // Create the unsigned transaction to create ATA
            const transaction = new web3_js_1.Transaction().add((0, spl_token_1.createAssociatedTokenAccountInstruction)(userPublicKey, // The wallet to create the ATA for
            associatedTokenAddress, // The ATA to be created
            userPublicKey, // The user's public key (as the owner)
            mintPublicKey, // The token mint
            spl_token_1.TOKEN_2022_PROGRAM_ID // Token program ID (default)
            ));
            // Set the recent blockhash and fee payer (user will pay the transaction fees)
            transaction.recentBlockhash = blockhash;
            transaction.feePayer = userPublicKey;
            // Serialize the transaction to send to frontend (unsigned)
            return {
                success: true,
                message: 'Transaction created successfully! Please sign it with your wallet.',
                transaction: Buffer.from(transaction.serialize({ requireAllSignatures: false })).toString("base64"),
                associatedTokenAddress // Send unsigned transaction as base64
            };
        }
    }
    catch (err) {
        console.error("❌ Error creating the ATA transaction:", err);
        return { success: false, message: "Error creating the associated token account" };
    }
});
exports.createAssociatedTokenAccount = createAssociatedTokenAccount;
//# sourceMappingURL=services.js.map