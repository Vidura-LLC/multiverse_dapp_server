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
dotenv_1.default.config();
// Helper function to get the program
const getProgram = () => {
    const idl = require("../staking/epoch-staking-reward_idl.json");
    const walletKeypair = require("../staking/multiverse_dapp-keypair.json");
    const adminKeypair = web3_js_1.Keypair.fromSecretKey(new Uint8Array(walletKeypair));
    const adminPublicKey = adminKeypair.publicKey;
    const connection = new web3_js_1.Connection("https://api.devnet.solana.com", "confirmed");
    const programId = new web3_js_1.PublicKey("Dz4rTCCmWrK9Ky6kzVqNK1GPeqjAecrZzKoyXvtue4Pr");
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
const stakeTokenService = (mintPublicKey, userPublicKey, amount, lockDuration, // Lock duration in seconds
adminPublicKey // Admin public key from client
) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { program, connection } = (0, exports.getProgram)();
        // Log initial parameters for clarity
        console.log("Staking Details:");
        console.log("User PublicKey:", userPublicKey.toBase58());
        console.log("Admin PublicKey:", adminPublicKey.toBase58());
        console.log("Mint PublicKey:", mintPublicKey.toBase58());
        console.log("Amount to stake:", amount);
        console.log("Lock Duration (in seconds):", lockDuration);
        // Validate lockDuration
        if (!lockDuration || typeof lockDuration !== 'number') {
            throw new Error('Invalid lock duration provided');
        }
        const [stakingPoolPublicKey] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("staking_pool"), adminPublicKey.toBuffer()], program.programId);
        const [userStakingAccountPublicKey] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("user_stake"), userPublicKey.toBuffer()], program.programId);
        const [poolEscrowAccountPublicKey] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("escrow"), stakingPoolPublicKey.toBuffer()], program.programId);
        // Check if the user already has a staking account
        const userStakingAccountResponse = yield (0, exports.getUserStakingAccount)(userPublicKey);
        console.log("User Staking Account Response:", userStakingAccountResponse);
        let userTokenAccountPublicKey = yield (0, spl_token_1.getAssociatedTokenAddressSync)(mintPublicKey, userPublicKey, false, spl_token_1.TOKEN_2022_PROGRAM_ID);
        console.log("User Token Account PublicKey:", userTokenAccountPublicKey.toBase58());
        if (!userTokenAccountPublicKey) {
            console.log("User Token Account PublicKey does not exist. Creating ATA...");
            const createATAResponse = yield (0, exports.createAssociatedTokenAccount)(mintPublicKey, userPublicKey);
            console.log("Create ATA Response:", createATAResponse);
            userTokenAccountPublicKey = createATAResponse.associatedTokenAddress;
        }
        const { blockhash } = yield connection.getLatestBlockhash("finalized");
        console.log("Latest Blockhash:", blockhash);
        // Create an unsigned transaction for staking
        const transaction = yield program.methods
            .stake(new anchor.BN(amount), new anchor.BN(lockDuration))
            .accounts({
            user: userPublicKey,
            stakingPool: stakingPoolPublicKey,
            userStakingAccount: userStakingAccountPublicKey,
            userTokenAccount: userTokenAccountPublicKey,
            poolEscrowAccount: poolEscrowAccountPublicKey,
            mint: mintPublicKey,
            tokenProgram: spl_token_1.TOKEN_2022_PROGRAM_ID,
            systemProgram: web3_js_1.SystemProgram.programId,
        })
            .transaction();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = userPublicKey;
        // Serialize transaction and send it to the frontend
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
const unstakeTokenService = (mintPublicKey, userPublicKey, adminPublicKey) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { program, connection } = (0, exports.getProgram)(); // Assuming getProgram() initializes necessary context
        // Find the staking pool, user staking account, and escrow account
        const [stakingPoolPublicKey] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from('staking_pool'), adminPublicKey.toBuffer()], program.programId);
        const [userStakingAccountPublicKey] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from('user_stake'), userPublicKey.toBuffer()], program.programId);
        const [poolEscrowAccountPublicKey] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from('escrow'), stakingPoolPublicKey.toBuffer()], program.programId);
        // Check if the user already has a staking account
        const userStakingAccountResponse = yield (0, exports.getUserStakingAccount)(userPublicKey);
        console.log("User Staking Account Response:", userStakingAccountResponse);
        let userTokenAccountPublicKey = yield (0, spl_token_1.getAssociatedTokenAddressSync)(mintPublicKey, userPublicKey, false, spl_token_1.TOKEN_2022_PROGRAM_ID);
        console.log("User Token Account PublicKey:", userTokenAccountPublicKey.toBase58());
        if (!userTokenAccountPublicKey) {
            console.log("User Token Account PublicKey does not exist. Creating ATA...");
            const createATAResponse = yield (0, exports.createAssociatedTokenAccount)(mintPublicKey, userPublicKey);
            console.log("Create ATA Response:", createATAResponse);
            userTokenAccountPublicKey = createATAResponse.associatedTokenAddress;
        }
        // Get the latest blockhash
        const { blockhash } = yield connection.getLatestBlockhash('finalized');
        // Create an unsigned transaction to unstake all tokens
        const transaction = yield program.methods
            .unstake() // No need to pass amount, as unstake now operates on the full staked amount
            .accounts({
            user: userPublicKey,
            stakingPool: stakingPoolPublicKey,
            userStakingAccount: userStakingAccountPublicKey,
            userTokenAccount: userTokenAccountPublicKey,
            poolEscrowAccount: poolEscrowAccountPublicKey,
            mint: mintPublicKey,
            tokenProgram: spl_token_1.TOKEN_2022_PROGRAM_ID,
            systemProgram: web3_js_1.SystemProgram.programId,
        })
            .transaction(); // Create transaction, don't sign
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = userPublicKey;
        // Serialize transaction and send it to the frontend
        return {
            success: true,
            message: "Transaction created successfully!",
            transaction: transaction.serialize({ requireAllSignatures: false }).toString('base64'),
        };
    }
    catch (err) {
        console.error("❌ Error creating unstake transaction:", err);
        return { success: false, message: "Error creating unstake transaction" };
    }
});
exports.unstakeTokenService = unstakeTokenService;
// Function to claim staking rewards
const claimRewardsService = (userPublicKey, adminPublicKey) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { program, connection } = (0, exports.getProgram)();
        const [stakingPoolPublicKey] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from('staking_pool'), adminPublicKey.toBuffer()], program.programId);
        const [userStakingAccountPublicKey] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from('user_stake'), userPublicKey.toBuffer()], program.programId);
        const [rewardPoolPublicKey] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from('reward_pool'), adminPublicKey.toBuffer()], program.programId);
        const [rewardEscrowPublicKey] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from('reward_escrow'), rewardPoolPublicKey.toBuffer()], program.programId);
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
const getUserStakingAccount = (userPublicKey) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { program, connection } = (0, exports.getProgram)();
        // Derive the public key for the user staking account
        const [userStakingAccountPublicKey] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("user_stake"), userPublicKey.toBuffer()], program.programId);
        console.log(userStakingAccountPublicKey);
        // Check if the user staking account exists
        const accountExists = yield connection.getAccountInfo(userStakingAccountPublicKey);
        if (!accountExists) {
            return { success: false, message: "User has not staked any tokens yet." };
        }
        // Fetch staking data
        const userStakingAccount = yield program.account.userStakingAccount.fetch(userStakingAccountPublicKey);
        console.log(userStakingAccount);
        // Convert stakedAmount from base units
        const tokenDecimals = 9; // Adjust token decimals as needed
        const readableStakedAmount = userStakingAccount.stakedAmount.toNumber() / (Math.pow(10, tokenDecimals));
        // Ensure that the fields are defined and use safe .toString() calls
        const rawData = {
            owner: userStakingAccount.owner.toBase58(),
            stakedAmount: readableStakedAmount,
            stakeTimestamp: userStakingAccount.stakeTimestamp.toString(),
            stakeDuration: userStakingAccount.lockDuration.toString(),
            weight: userStakingAccount.weight.toString(),
            rewardDebt: userStakingAccount.rewardDebt.toNumber() / (Math.pow(10, tokenDecimals)),
            pendingRewards: userStakingAccount.pendingRewards.toNumber() / (Math.pow(10, tokenDecimals)),
        };
        console.log("Raw User Staking Account Data:", rawData);
        return { success: true, data: rawData };
    }
    catch (err) {
        console.error("❌ Error fetching user staking account:", err);
        return { success: false, message: "Error fetching user staking account." };
    }
});
exports.getUserStakingAccount = getUserStakingAccount;
// Function to accrue pending rewards for a specific staker
const accrueRewardsService = (userPublicKey, adminPublicKey) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { program, connection } = (0, exports.getProgram)();
        console.log("Accruing rewards for user:", userPublicKey.toBase58());
        // Get the staking pool PDA
        const [stakingPoolPublicKey] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("staking_pool"), adminPublicKey.toBuffer()], program.programId);
        // Get the user staking account PDA
        const [userStakingPublicKey] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("user_stake"), userPublicKey.toBuffer()], program.programId);
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