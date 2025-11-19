"use strict";
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
exports.distributeTournamentPrizesService = exports.distributeTournamentRevenueService = exports.DEFAULT_SPLITS = void 0;
const web3_js_1 = require("@solana/web3.js");
const spl_token_1 = require("@solana/spl-token");
const dotenv_1 = __importDefault(require("dotenv"));
const database_1 = require("firebase/database");
const firebase_1 = require("../config/firebase");
const services_1 = require("../gamehub/services");
const services_2 = require("../staking/services");
const getPDAs_1 = require("../utils/getPDAs");
dotenv_1.default.config();
// Default percentage splits based on updated requirements
exports.DEFAULT_SPLITS = {
    PRIZE_POOL: 40, // 40% to tournament's prize pool
    REVENUE_POOL: 50, // 50% to global revenue pool
    STAKING_REWARD_POOL: 5, // 5% to reward pool
    BURN: 5 // 5% to burn (2.5% Kaya and 2.5% CRD)
};
/**
 * Distribute tournament revenue according to the specified percentages
 */
const distributeTournamentRevenueService = (tournamentId_1, ...args_1) => __awaiter(void 0, [tournamentId_1, ...args_1], void 0, function* (tournamentId, prizePercentage = exports.DEFAULT_SPLITS.PRIZE_POOL, revenuePercentage = exports.DEFAULT_SPLITS.REVENUE_POOL, stakingPercentage = exports.DEFAULT_SPLITS.STAKING_REWARD_POOL, burnPercentage = exports.DEFAULT_SPLITS.BURN, adminPublicKey, tokenType) {
    try {
        const { program, connection } = (0, services_2.getProgram)();
        // 1. Verify tournament in Firebase
        console.log("Verifying tournament in Firebase...");
        const tournamentRef = (0, database_1.ref)(firebase_1.db, `tournaments/${tokenType}/${tournamentId}`);
        const tournamentSnapshot = yield (0, database_1.get)(tournamentRef);
        if (!tournamentSnapshot.exists()) {
            return {
                success: false,
                message: `Tournament with ID ${tournamentId} not found in database`
            };
        }
        const tournament = tournamentSnapshot.val();
        if (tournament.status !== "Active" && tournament.status !== "Ended") {
            return {
                success: false,
                message: `Tournament cannot be distributed because it is in '${tournament.status}' status`
            };
        }
        if (tournament.distributionCompleted) {
            return {
                success: false,
                message: "Tournament revenue has already been distributed"
            };
        }
        // 2. Derive all necessary PDAs
        console.log("Deriving program addresses...");
        const tournamentPoolPublicKey = (0, getPDAs_1.getTournamentPoolPDA)(adminPublicKey, tournamentId, tokenType);
        console.log("🔹 Tournament Pool PDA:", tournamentPoolPublicKey.toString());
        const prizePoolPublicKey = (0, getPDAs_1.getPrizePoolPDA)(tournamentPoolPublicKey);
        console.log("🔹 Prize Pool PDA:", prizePoolPublicKey.toString());
        const revenuePoolPublicKey = (0, getPDAs_1.getRevenuePoolPDA)(adminPublicKey, tokenType);
        console.log("🔹 Revenue Pool PDA:", revenuePoolPublicKey.toString());
        const stakingPoolPublicKey = (0, getPDAs_1.getStakingPoolPDA)(adminPublicKey, tokenType);
        console.log("🔹 Staking Pool PDA:", stakingPoolPublicKey.toString());
        const rewardPoolPublicKey = (0, getPDAs_1.getRewardPoolPDA)(adminPublicKey, tokenType);
        console.log("🔹 Reward Pool PDA:", rewardPoolPublicKey.toString());
        // 3. Fetch tournament data from blockchain
        console.log("Fetching tournament data from blockchain...");
        const tournamentPoolResult = yield (0, services_1.getTournamentPool)(tournamentId, adminPublicKey, tokenType);
        if (!tournamentPoolResult.success) {
            return {
                success: false,
                message: `Failed to fetch tournament data: ${tournamentPoolResult.message || "Unknown error"}`
            };
        }
        const tournamentPoolData = tournamentPoolResult.data;
        const totalFunds = Number(tournamentPoolData.totalFunds);
        console.log("🔹 Total Tournament Funds:", totalFunds);
        if (totalFunds <= 0) {
            return {
                success: false,
                message: "Tournament has no funds to distribute"
            };
        }
        // 4. Determine accounts based on token type
        let mintPublicKey;
        let tournamentEscrowPublicKey;
        let prizeEscrowPublicKey;
        let revenueEscrowPublicKey;
        let rewardEscrowPublicKey;
        let tokenProgramId;
        if (tokenType === getPDAs_1.TokenType.SOL) {
            mintPublicKey = web3_js_1.SystemProgram.programId;
            tournamentEscrowPublicKey = web3_js_1.SystemProgram.programId;
            prizeEscrowPublicKey = web3_js_1.SystemProgram.programId;
            revenueEscrowPublicKey = web3_js_1.SystemProgram.programId;
            rewardEscrowPublicKey = web3_js_1.SystemProgram.programId;
            tokenProgramId = web3_js_1.SystemProgram.programId;
            console.log("🔹 Token Type: SOL (no escrow accounts needed)");
            console.log("   Distribution via System Program transfers");
        }
        else {
            mintPublicKey = new web3_js_1.PublicKey(tournamentPoolData.mint);
            tournamentEscrowPublicKey = (0, getPDAs_1.getTournamentEscrowPDA)(tournamentPoolPublicKey);
            prizeEscrowPublicKey = (0, getPDAs_1.getPrizeEscrowPDA)(prizePoolPublicKey);
            revenueEscrowPublicKey = (0, getPDAs_1.getRevenueEscrowPDA)(revenuePoolPublicKey);
            rewardEscrowPublicKey = (0, getPDAs_1.getRewardEscrowPDA)(rewardPoolPublicKey);
            tokenProgramId = spl_token_1.TOKEN_2022_PROGRAM_ID;
            console.log("🔹 Token Type: SPL");
            console.log("🔹 Token Mint:", mintPublicKey.toString());
            console.log("🔹 Tournament Escrow:", tournamentEscrowPublicKey.toString());
            console.log("🔹 Prize Escrow:", prizeEscrowPublicKey.toString());
            console.log("🔹 Revenue Escrow:", revenueEscrowPublicKey.toString());
            console.log("🔹 Reward Escrow:", rewardEscrowPublicKey.toString());
        }
        // 5. Validate percentages
        const totalPercentage = prizePercentage + revenuePercentage + stakingPercentage + burnPercentage;
        if (totalPercentage !== 100) {
            return {
                success: false,
                message: `Percentages must add up to 100. Current total: ${totalPercentage}%`
            };
        }
        console.log("📊 Distribution Percentages:");
        console.log(`   Prize Pool: ${prizePercentage}%`);
        console.log(`   Revenue Pool: ${revenuePercentage}%`);
        console.log(`   Staking Rewards: ${stakingPercentage}%`);
        console.log(`   Burn: ${burnPercentage}%`);
        // 6. Create transaction with compute budget
        console.log("Creating distribution transaction...");
        const computeBudgetInstruction = web3_js_1.ComputeBudgetProgram.setComputeUnitLimit({
            units: 400000,
        });
        const distributionInstruction = yield program.methods
            .distributeTournamentRevenue(tournamentId, prizePercentage, revenuePercentage, stakingPercentage, burnPercentage)
            .accounts({
            creator: adminPublicKey,
            tournamentPool: tournamentPoolPublicKey,
            prizePool: prizePoolPublicKey,
            revenuePool: revenuePoolPublicKey,
            rewardPool: rewardPoolPublicKey,
            stakingPool: stakingPoolPublicKey,
            tournamentEscrowAccount: tournamentEscrowPublicKey,
            prizeEscrowAccount: prizeEscrowPublicKey,
            revenueEscrowAccount: revenueEscrowPublicKey,
            rewardEscrowAccount: rewardEscrowPublicKey,
            mint: mintPublicKey,
            tokenProgram: tokenProgramId,
            systemProgram: web3_js_1.SystemProgram.programId,
        })
            .instruction();
        // ✅ CRITICAL: Ensure recipient pools are NOT signers (they receive funds, don't sign)
        console.log("🔧 Adjusting account properties for distribution...");
        const nonSignerAccounts = [
            { pubkey: prizePoolPublicKey, name: 'prize_pool' },
            { pubkey: revenuePoolPublicKey, name: 'revenue_pool' },
            { pubkey: rewardPoolPublicKey, name: 'reward_pool' }
        ];
        nonSignerAccounts.forEach(({ pubkey, name }) => {
            const accountIndex = distributionInstruction.keys.findIndex(key => key.pubkey.equals(pubkey));
            if (accountIndex !== -1) {
                distributionInstruction.keys[accountIndex].isSigner = false;
                distributionInstruction.keys[accountIndex].isWritable = true;
                console.log(`   ✅ Marked ${name} as non-signer and writable`);
            }
        });
        // Additional writable accounts
        const writableAccountsBase = [
            { pubkey: tournamentPoolPublicKey, name: 'tournament_pool' },
            { pubkey: stakingPoolPublicKey, name: 'staking_pool' }
        ];
        let writableAccounts = [...writableAccountsBase];
        if (tokenType === getPDAs_1.TokenType.SPL) {
            writableAccounts = [
                ...writableAccounts,
                { pubkey: tournamentEscrowPublicKey, name: 'tournament_escrow' },
                { pubkey: prizeEscrowPublicKey, name: 'prize_escrow' },
                { pubkey: revenueEscrowPublicKey, name: 'revenue_escrow' },
                { pubkey: rewardEscrowPublicKey, name: 'reward_escrow' },
                { pubkey: mintPublicKey, name: 'mint' }
            ];
        }
        writableAccounts.forEach(({ pubkey, name }) => {
            const accountIndex = distributionInstruction.keys.findIndex(key => key.pubkey.equals(pubkey));
            if (accountIndex !== -1) {
                distributionInstruction.keys[accountIndex].isWritable = true;
                console.log(`   ✅ Marked ${name} as writable`);
            }
            else {
                console.log(`   ⚠️ Warning: ${name} account not found in instruction`);
            }
        });
        // Create transaction with both instructions
        const transaction = new web3_js_1.Transaction()
            .add(computeBudgetInstruction)
            .add(distributionInstruction);
        // Set transaction metadata
        const { blockhash } = yield connection.getLatestBlockhash("finalized");
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = adminPublicKey;
        // Calculate distribution amounts for response
        const prizeAmount = Math.floor((totalFunds * prizePercentage) / 100);
        const revenueAmount = Math.floor((totalFunds * revenuePercentage) / 100);
        const stakingAmount = Math.floor((totalFunds * stakingPercentage) / 100);
        const burnAmount = Math.floor((totalFunds * burnPercentage) / 100);
        console.log("💰 Distribution Breakdown:");
        console.log(`   Prize Pool: ${prizeAmount}`);
        console.log(`   Revenue Pool: ${revenueAmount}`);
        console.log(`   Staking Rewards: ${stakingAmount}`);
        console.log(`   Burn: ${burnAmount}`);
        console.log(`   Total: ${prizeAmount + revenueAmount + stakingAmount + burnAmount}`);
        return {
            success: true,
            message: "Tournament revenue distribution transaction created successfully!",
            tournamentId,
            transaction: transaction.serialize({ requireAllSignatures: false }).toString('base64'),
            distribution: {
                totalFunds,
                prizeAmount,
                revenueAmount,
                stakingAmount,
                burnAmount
            },
            tournamentRef: tournamentRef.toString(),
            status: "Pending Signature",
            tokenType: tokenType === getPDAs_1.TokenType.SOL ? "SOL" : "SPL"
        };
    }
    catch (err) {
        console.error("❌ Error distributing tournament revenue:", err);
        return {
            success: false,
            message: `Error distributing tournament revenue: ${err.message || err}`
        };
    }
});
exports.distributeTournamentRevenueService = distributeTournamentRevenueService;
/**
 * Prepares an unsigned transaction to distribute prizes to tournament winners
 * @param tournamentId - The ID of the tournament
 * @param firstPlacePublicKey - Public key of the first place winner
 * @param secondPlacePublicKey - Public key of the second place winner
 * @param thirdPlacePublicKey - Public key of the third place winner
 * @param adminPublicKey - The admin's public key who will sign the transaction
 * @returns Result object with unsigned transaction for frontend signing
 */
const distributeTournamentPrizesService = (tournamentId, firstPlacePublicKey, secondPlacePublicKey, thirdPlacePublicKey, adminPublicKey, tokenType) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { program, connection } = (0, services_2.getProgram)();
        console.log("Preparing prize distribution for tournament:", tournamentId);
        console.log("Token Type:", tokenType === getPDAs_1.TokenType.SOL ? "SOL" : "SPL");
        console.log("Winners:");
        console.log("1st Place:", firstPlacePublicKey.toString());
        console.log("2nd Place:", secondPlacePublicKey.toString());
        console.log("3rd Place:", thirdPlacePublicKey.toString());
        // 1. Verify tournament in Firebase (use correct path with tokenType)
        console.log("Verifying tournament in Firebase...");
        const tournamentRef = (0, database_1.ref)(firebase_1.db, `tournaments/${tokenType}/${tournamentId}`);
        const tournamentSnapshot = yield (0, database_1.get)(tournamentRef);
        if (!tournamentSnapshot.exists()) {
            return {
                success: false,
                message: `Tournament with ID ${tournamentId} not found in database`
            };
        }
        const tournament = tournamentSnapshot.val();
        // Check if prizes have already been distributed
        if (tournament.prizesDistributed) {
            return {
                success: false,
                message: "Tournament prizes have already been distributed"
            };
        }
        // Check if the tournament revenue has been distributed (required before prize distribution)
        if (!tournament.distributionCompleted) {
            return {
                success: false,
                message: "Tournament revenue must be distributed before prizes can be distributed"
            };
        }
        // 2. Derive all the necessary PDAs
        console.log("Deriving program addresses...");
        const tournamentPoolPublicKey = (0, getPDAs_1.getTournamentPoolPDA)(adminPublicKey, tournamentId, tokenType);
        console.log("🔹 Tournament Pool PDA:", tournamentPoolPublicKey.toString());
        const prizePoolPublicKey = (0, getPDAs_1.getPrizePoolPDA)(tournamentPoolPublicKey);
        console.log("🔹 Prize Pool PDA:", prizePoolPublicKey.toString());
        // 3. Get tournament data from blockchain
        const tournamentPoolResult = yield (0, services_1.getTournamentPool)(tournamentId, adminPublicKey, tokenType);
        if (!tournamentPoolResult.success) {
            return {
                success: false,
                message: `Failed to fetch tournament data: ${tournamentPoolResult.message || "Unknown error"}`
            };
        }
        // 4. Prepare accounts based on token type
        let mintPublicKey;
        let prizeEscrowPublicKey;
        let firstPlaceTokenAccount;
        let secondPlaceTokenAccount;
        let thirdPlaceTokenAccount;
        let tokenProgramId;
        if (tokenType === getPDAs_1.TokenType.SOL) {
            // For SOL, use SystemProgram as dummy values
            mintPublicKey = web3_js_1.SystemProgram.programId;
            prizeEscrowPublicKey = web3_js_1.SystemProgram.programId;
            firstPlaceTokenAccount = web3_js_1.SystemProgram.programId;
            secondPlaceTokenAccount = web3_js_1.SystemProgram.programId;
            thirdPlaceTokenAccount = web3_js_1.SystemProgram.programId;
            tokenProgramId = web3_js_1.SystemProgram.programId;
            console.log("🔹 Token Type: SOL (winners receive lamports directly)");
        }
        else {
            // For SPL, derive actual escrow and get token accounts
            mintPublicKey = new web3_js_1.PublicKey(tournamentPoolResult.data.mint);
            prizeEscrowPublicKey = (0, getPDAs_1.getPrizeEscrowPDA)(prizePoolPublicKey);
            tokenProgramId = spl_token_1.TOKEN_2022_PROGRAM_ID;
            console.log("🔹 Token Type: SPL");
            console.log("🔹 Token Mint:", mintPublicKey.toString());
            console.log("🔹 Prize Escrow:", prizeEscrowPublicKey.toString());
            // Get associated token accounts for winners
            console.log("Getting associated token accounts for winners...");
            firstPlaceTokenAccount = yield getOrCreateAssociatedTokenAccount(connection, mintPublicKey, firstPlacePublicKey);
            console.log("1st Place Token Account:", firstPlaceTokenAccount.toString());
            secondPlaceTokenAccount = yield getOrCreateAssociatedTokenAccount(connection, mintPublicKey, secondPlacePublicKey);
            console.log("2nd Place Token Account:", secondPlaceTokenAccount.toString());
            thirdPlaceTokenAccount = yield getOrCreateAssociatedTokenAccount(connection, mintPublicKey, thirdPlacePublicKey);
            console.log("3rd Place Token Account:", thirdPlaceTokenAccount.toString());
        }
        // 5. Create the instruction
        console.log("Creating prize distribution transaction...");
        const computeBudgetInstruction = web3_js_1.ComputeBudgetProgram.setComputeUnitLimit({
            units: 400000,
        });
        const prizeDistributionInstruction = yield program.methods
            .distributeTournamentPrizes(tournamentId)
            .accounts({
            creator: adminPublicKey,
            tournamentPool: tournamentPoolPublicKey,
            prizePool: prizePoolPublicKey,
            prizeEscrowAccount: prizeEscrowPublicKey,
            firstPlaceWinner: firstPlacePublicKey,
            secondPlaceWinner: secondPlacePublicKey,
            thirdPlaceWinner: thirdPlacePublicKey,
            firstPlaceTokenAccount: firstPlaceTokenAccount,
            secondPlaceTokenAccount: secondPlaceTokenAccount,
            thirdPlaceTokenAccount: thirdPlaceTokenAccount,
            mint: mintPublicKey,
            tokenProgram: tokenProgramId,
            systemProgram: web3_js_1.SystemProgram.programId,
        })
            .instruction();
        // ✅ Mark accounts as writable based on token type
        console.log("🔧 Adjusting account mutability...");
        if (tokenType === getPDAs_1.TokenType.SOL) {
            // For SOL, mark winner accounts as writable (they receive lamports)
            const writableAccounts = [
                { pubkey: firstPlacePublicKey, name: 'first_place_winner' },
                { pubkey: secondPlacePublicKey, name: 'second_place_winner' },
                { pubkey: thirdPlacePublicKey, name: 'third_place_winner' }
            ];
            writableAccounts.forEach(({ pubkey, name }) => {
                const accountIndex = prizeDistributionInstruction.keys.findIndex(key => key.pubkey.equals(pubkey));
                if (accountIndex !== -1) {
                    prizeDistributionInstruction.keys[accountIndex].isWritable = true;
                    console.log(`   ✅ Marked ${name} as writable`);
                }
            });
        }
        else {
            // For SPL, mark escrow and token accounts as writable
            const writableAccounts = [
                { pubkey: prizeEscrowPublicKey, name: 'prize_escrow' },
                { pubkey: firstPlaceTokenAccount, name: 'first_place_token' },
                { pubkey: secondPlaceTokenAccount, name: 'second_place_token' },
                { pubkey: thirdPlaceTokenAccount, name: 'third_place_token' },
                { pubkey: mintPublicKey, name: 'mint' }
            ];
            writableAccounts.forEach(({ pubkey, name }) => {
                const accountIndex = prizeDistributionInstruction.keys.findIndex(key => key.pubkey.equals(pubkey));
                if (accountIndex !== -1) {
                    prizeDistributionInstruction.keys[accountIndex].isWritable = true;
                    console.log(`   ✅ Marked ${name} as writable`);
                }
            });
        }
        // Create transaction
        const transaction = new web3_js_1.Transaction()
            .add(computeBudgetInstruction)
            .add(prizeDistributionInstruction);
        // Set transaction metadata
        const { blockhash } = yield connection.getLatestBlockhash("finalized");
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = adminPublicKey;
        // Calculate prize amounts
        const distributionDetails = tournament.distributionDetails || {};
        const totalPrizeAmount = distributionDetails.prizeAmount || 0;
        const firstPlaceAmount = Math.floor(totalPrizeAmount * 0.5);
        const secondPlaceAmount = Math.floor(totalPrizeAmount * 0.3);
        const thirdPlaceAmount = Math.floor(totalPrizeAmount * 0.2);
        console.log("💰 Prize Distribution:");
        console.log(`   1st Place: ${firstPlaceAmount}`);
        console.log(`   2nd Place: ${secondPlaceAmount}`);
        console.log(`   3rd Place: ${thirdPlaceAmount}`);
        return {
            success: true,
            message: "Prize distribution transaction created successfully!",
            tournamentId,
            transaction: transaction.serialize({ requireAllSignatures: false }).toString('base64'),
            winnerData: {
                firstPlace: {
                    publicKey: firstPlacePublicKey.toString(),
                    tokenAccount: tokenType === getPDAs_1.TokenType.SPL ? firstPlaceTokenAccount.toString() : "N/A (SOL)",
                    amount: firstPlaceAmount
                },
                secondPlace: {
                    publicKey: secondPlacePublicKey.toString(),
                    tokenAccount: tokenType === getPDAs_1.TokenType.SPL ? secondPlaceTokenAccount.toString() : "N/A (SOL)",
                    amount: secondPlaceAmount
                },
                thirdPlace: {
                    publicKey: thirdPlacePublicKey.toString(),
                    tokenAccount: tokenType === getPDAs_1.TokenType.SPL ? thirdPlaceTokenAccount.toString() : "N/A (SOL)",
                    amount: thirdPlaceAmount
                }
            },
            tokenType: tokenType === getPDAs_1.TokenType.SOL ? "SOL" : "SPL",
            status: "Pending Signature"
        };
    }
    catch (err) {
        console.error("❌ Error preparing tournament prize distribution:", err);
        return {
            success: false,
            message: `Error preparing tournament prize distribution: ${err.message || err}`
        };
    }
});
exports.distributeTournamentPrizesService = distributeTournamentPrizesService;
// Helper function to get or create an associated token account
function getOrCreateAssociatedTokenAccount(connection, mint, owner) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // Use getAssociatedTokenAddressSync from @solana/spl-token
            const associatedTokenAddress = (0, spl_token_1.getAssociatedTokenAddressSync)(mint, owner, false, spl_token_1.TOKEN_2022_PROGRAM_ID // Use TOKEN_2022_PROGRAM_ID as we're working with token-2022
            );
            console.log(`Token address for ${owner.toString()}: ${associatedTokenAddress.toString()}`);
            // Check if the account exists
            const accountInfo = yield connection.getAccountInfo(associatedTokenAddress);
            if (!accountInfo) {
                console.log(`Token account for ${owner.toString()} does not exist. It will be created during the transaction.`);
            }
            else {
                console.log(`Token account for ${owner.toString()} exists with ${accountInfo.lamports} lamports`);
            }
            return associatedTokenAddress;
        }
        catch (err) {
            console.error("Error in getOrCreateAssociatedTokenAccount:", err);
            throw err;
        }
    });
}
//# sourceMappingURL=services.js.map