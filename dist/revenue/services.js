"use strict";
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
exports.distributeTournamentPrizesService = exports.distributeTournamentRevenueService = exports.initializePrizePoolService = void 0;
const web3_js_1 = require("@solana/web3.js");
const anchor = __importStar(require("@project-serum/anchor"));
const spl_token_1 = require("@solana/spl-token");
const dotenv_1 = __importDefault(require("dotenv"));
const database_1 = require("firebase/database");
const firebase_1 = require("../config/firebase");
const services_1 = require("../gamehub/services");
const services_2 = require("../staking/services");
dotenv_1.default.config();
// Default percentage splits based on updated requirements
const DEFAULT_SPLITS = {
    PRIZE_POOL: 40, // 40% to tournament's prize pool
    REVENUE_POOL: 50, // 50% to global revenue pool
    STAKING_POOL: 5, // 5% to staking pool
    BURN: 5 // 5% to burn (2.5% Kaya and 2.5% CRD)
};
/**
 * Initialize a prize pool for a specific tournament
 * @param tournamentId - The tournament ID
 * @param mintPublicKey - The token mint address
 * @returns Result object with transaction details and addresses
 */
const initializePrizePoolService = (tournamentId, mintPublicKey, adminPublicKey) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { program, connection } = (0, services_2.getProgram)();
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
/**
* Distribute tournament revenue according to the specified percentages
* @param tournamentId - The tournament ID
* @param prizePercentage - Percentage for prize pool (default 40%)
* @param revenuePercentage - Percentage for revenue pool (default 50%)
* @param stakingPercentage - Percentage for staking pool (default 5%)
* @param burnPercentage - Percentage for burn (default 5%)
* @param adminPublicKey - The admin's public key
* @returns Result object with the unsigned transaction for frontend signing
*/
const distributeTournamentRevenueService = (tournamentId_1, ...args_1) => __awaiter(void 0, [tournamentId_1, ...args_1], void 0, function* (tournamentId, prizePercentage = DEFAULT_SPLITS.PRIZE_POOL, revenuePercentage = DEFAULT_SPLITS.REVENUE_POOL, stakingPercentage = DEFAULT_SPLITS.STAKING_POOL, burnPercentage = DEFAULT_SPLITS.BURN, adminPublicKey) {
    try {
        const { program, connection } = (0, services_2.getProgram)();
        // 1. Verify tournament in Firebase
        console.log("Verifying tournament in Firebase...");
        const tournamentRef = (0, database_1.ref)(firebase_1.db, `tournaments/${tournamentId}`);
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
        const tournamentIdBytes = Buffer.from(tournamentId, "utf8");
        // Tournament Pool PDA
        const [tournamentPoolPublicKey] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("tournament_pool"), adminPublicKey.toBuffer(), tournamentIdBytes], program.programId);
        console.log("🔹 Tournament Pool PDA:", tournamentPoolPublicKey.toString());
        // Prize Pool PDA (derived from tournament pool)
        const [prizePoolPublicKey] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("prize_pool"), tournamentPoolPublicKey.toBuffer()], program.programId);
        console.log("🔹 Prize Pool PDA:", prizePoolPublicKey.toString());
        // Revenue Pool PDA
        const [revenuePoolPublicKey] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("revenue_pool"), adminPublicKey.toBuffer()], program.programId);
        console.log("🔹 Revenue Pool PDA:", revenuePoolPublicKey.toString());
        // Staking Pool PDA
        const [stakingPoolPublicKey] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("staking_pool"), adminPublicKey.toBuffer()], program.programId);
        console.log("🔹 Staking Pool PDA:", stakingPoolPublicKey.toString());
        // 3. Derive escrow accounts
        const [tournamentEscrowPublicKey] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("escrow"), tournamentPoolPublicKey.toBuffer()], program.programId);
        console.log("🔹 Tournament Escrow PDA:", tournamentEscrowPublicKey.toString());
        const [prizeEscrowPublicKey] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("prize_escrow"), prizePoolPublicKey.toBuffer()], program.programId);
        console.log("🔹 Prize Escrow PDA:", prizeEscrowPublicKey.toString());
        const [revenueEscrowPublicKey] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("revenue_escrow"), revenuePoolPublicKey.toBuffer()], program.programId);
        console.log("🔹 Revenue Escrow PDA:", revenueEscrowPublicKey.toString());
        const [stakingEscrowAccountPublicKey] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("escrow"), stakingPoolPublicKey.toBuffer()], program.programId);
        console.log("🔹 Staking Escrow PDA:", stakingEscrowAccountPublicKey.toString());
        // 4. Fetch tournament data
        console.log("Fetching tournament data from blockchain...");
        try {
            const tournamentPoolResult = yield (0, services_1.getTournamentPool)(tournamentId, adminPublicKey);
            if (!tournamentPoolResult.success) {
                return {
                    success: false,
                    message: `Failed to fetch tournament data: ${tournamentPoolResult.message || "Unknown error"}`
                };
            }
            const tournamentPoolData = tournamentPoolResult.data;
            const mintPublicKey = new web3_js_1.PublicKey(tournamentPoolData.mint);
            const totalFunds = Number(tournamentPoolData.totalFunds);
            console.log("🔹 Token Mint:", mintPublicKey.toString());
            console.log("🔹 Total Tournament Funds:", totalFunds);
            if (totalFunds <= 0) {
                return {
                    success: false,
                    message: "Tournament has no funds to distribute"
                };
            }
            // 5. Create transaction with compute budget optimization
            console.log("Creating optimized distribution transaction...");
            // Add compute budget instruction to handle complex operations
            const computeBudgetInstruction = web3_js_1.ComputeBudgetProgram.setComputeUnitLimit({
                units: 400000, // Increased compute units
            });
            const distributionInstruction = yield program.methods
                .distributeTournamentRevenue(tournamentId, prizePercentage, revenuePercentage, stakingPercentage, burnPercentage)
                .accounts({
                admin: adminPublicKey,
                tournamentPool: tournamentPoolPublicKey,
                prizePool: prizePoolPublicKey,
                revenuePool: revenuePoolPublicKey,
                stakingPool: stakingPoolPublicKey,
                tournamentEscrowAccount: tournamentEscrowPublicKey,
                prizeEscrowAccount: prizeEscrowPublicKey,
                revenueEscrowAccount: revenueEscrowPublicKey,
                stakingEscrowAccount: stakingEscrowAccountPublicKey,
                mint: mintPublicKey,
                tokenProgram: spl_token_1.TOKEN_2022_PROGRAM_ID,
            })
                .instruction();
            // Create transaction with both instructions
            const transaction = new web3_js_1.Transaction()
                .add(computeBudgetInstruction)
                .add(distributionInstruction);
            // Set transaction metadata
            const { blockhash } = yield connection.getLatestBlockhash("finalized");
            transaction.recentBlockhash = blockhash;
            transaction.feePayer = adminPublicKey;
            // Calculate distribution amounts
            const prizeAmount = Math.floor((totalFunds * prizePercentage) / 100);
            const revenueAmount = Math.floor((totalFunds * revenuePercentage) / 100);
            const stakingAmount = Math.floor((totalFunds * stakingPercentage) / 100);
            const burnAmount = Math.floor((totalFunds * burnPercentage) / 100);
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
                status: "Pending Signature"
            };
        }
        catch (err) {
            console.error("❌ Error preparing distribution transaction:", err);
            return {
                success: false,
                message: `Error preparing distribution transaction: ${err.message || err}`
            };
        }
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
const distributeTournamentPrizesService = (tournamentId, firstPlacePublicKey, secondPlacePublicKey, thirdPlacePublicKey, adminPublicKey) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { program, connection } = (0, services_2.getProgram)();
        console.log("Preparing prize distribution for tournament:", tournamentId);
        console.log("Winners:");
        console.log("1st Place:", firstPlacePublicKey.toString());
        console.log("2nd Place:", secondPlacePublicKey.toString());
        console.log("3rd Place:", thirdPlacePublicKey.toString());
        // Get tournament data
        const tournamentPoolResult = yield (0, services_1.getTournamentPool)(tournamentId, adminPublicKey);
        if (!tournamentPoolResult.success) {
            return {
                success: false,
                message: `Failed to fetch tournament data: ${tournamentPoolResult.message || "Unknown error"}`
            };
        }
        // 1. First, check if tournament exists and has been distributed in Firebase
        console.log("Verifying tournament in Firebase...");
        const tournamentRef = (0, database_1.ref)(firebase_1.db, `tournaments/${tournamentId}`);
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
        const tournamentIdBytes = Buffer.from(tournamentId, "utf8");
        // Tournament Pool PDA
        const [tournamentPoolPublicKey] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("tournament_pool"), adminPublicKey.toBuffer(), tournamentIdBytes], program.programId);
        console.log("🔹 Tournament Pool PDA:", tournamentPoolPublicKey.toString());
        // Prize Pool PDA (derived from tournament pool)
        const [prizePoolPublicKey] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("prize_pool"), tournamentPoolPublicKey.toBuffer()], program.programId);
        console.log("🔹 Prize Pool PDA:", prizePoolPublicKey.toString());
        // Prize Escrow PDA
        const [prizeEscrowPublicKey] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("prize_escrow"), prizePoolPublicKey.toBuffer()], program.programId);
        console.log("🔹 Prize Escrow PDA:", prizeEscrowPublicKey.toString());
        // 3. Get the mint address from the tournament data
        const mintPublicKey = new web3_js_1.PublicKey(tournamentPoolResult.data.mint);
        console.log("🔹 Token Mint:", mintPublicKey.toString());
        // 4. Get token accounts for the winners
        console.log("Getting associated token accounts for winners...");
        // First place token account
        const firstPlaceTokenAccount = yield getOrCreateAssociatedTokenAccount(connection, mintPublicKey, firstPlacePublicKey);
        console.log("1st Place Token Account:", firstPlaceTokenAccount.toString());
        // Second place token account
        const secondPlaceTokenAccount = yield getOrCreateAssociatedTokenAccount(connection, mintPublicKey, secondPlacePublicKey);
        console.log("2nd Place Token Account:", secondPlaceTokenAccount.toString());
        // Third place token account
        const thirdPlaceTokenAccount = yield getOrCreateAssociatedTokenAccount(connection, mintPublicKey, thirdPlacePublicKey);
        console.log("3rd Place Token Account:", thirdPlaceTokenAccount.toString());
        // 5. Create the transaction (but don't sign it)
        console.log("Creating unsigned prize distribution transaction...");
        const transaction = yield program.methods
            .distributeTournamentPrizes(tournamentId)
            .accounts({
            admin: adminPublicKey,
            tournamentPool: tournamentPoolPublicKey,
            prizePool: prizePoolPublicKey,
            prizeEscrowAccount: prizeEscrowPublicKey,
            firstPlaceTokenAccount: firstPlaceTokenAccount,
            secondPlaceTokenAccount: secondPlaceTokenAccount,
            thirdPlaceTokenAccount: thirdPlaceTokenAccount,
            mint: mintPublicKey,
            tokenProgram: spl_token_1.TOKEN_2022_PROGRAM_ID,
            systemProgram: anchor.web3.SystemProgram.programId,
        })
            .transaction();
        // 6. Set recent blockhash and fee payer
        const { blockhash } = yield connection.getLatestBlockhash("finalized");
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = adminPublicKey;
        // 8. Calculate prize amounts (if needed for frontend display)
        // You can calculate these based on your distribution logic
        const distributionDetails = tournament.distributionDetails || {};
        const totalPrizeAmount = distributionDetails.prizeAmount || 0;
        // Example split: 50% for 1st, 30% for 2nd, 20% for 3rd
        const firstPlaceAmount = Math.floor(totalPrizeAmount * 0.5);
        const secondPlaceAmount = Math.floor(totalPrizeAmount * 0.3);
        const thirdPlaceAmount = Math.floor(totalPrizeAmount * 0.2);
        // 9. Return the unsigned transaction and metadata for frontend
        return {
            success: true,
            message: "Prize distribution transaction created successfully!",
            transaction: transaction.serialize({ requireAllSignatures: false }).toString('base64'),
            winnerData: {
                firstPlace: {
                    publicKey: firstPlacePublicKey.toString(),
                    tokenAccount: firstPlaceTokenAccount.toString(),
                    amount: firstPlaceAmount
                },
                secondPlace: {
                    publicKey: secondPlacePublicKey.toString(),
                    tokenAccount: secondPlaceTokenAccount.toString(),
                    amount: secondPlaceAmount
                },
                thirdPlace: {
                    publicKey: thirdPlacePublicKey.toString(),
                    tokenAccount: thirdPlaceTokenAccount.toString(),
                    amount: thirdPlaceAmount
                }
            },
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