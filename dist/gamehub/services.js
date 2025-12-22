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
exports.registerForTournamentService = exports.getTotalTournamentEntryFeesService = exports.getTotalTournamentPoolsFundsService = exports.getTotalPrizePoolsFundsService = exports.getPrizePoolService = exports.getTournamentPool = exports.initializeTournamentPoolService = void 0;
const web3_js_1 = require("@solana/web3.js");
const anchor = __importStar(require("@project-serum/anchor"));
const spl_token_1 = require("@solana/spl-token");
const dotenv_1 = __importDefault(require("dotenv"));
const bn_js_1 = require("bn.js");
const services_1 = require("../staking/services");
const database_1 = require("firebase/database");
const firebase_1 = require("../config/firebase");
const getPDAs_1 = require("../utils/getPDAs");
const getPDAs_2 = require("../utils/getPDAs");
dotenv_1.default.config();
// Function to initialize the tournament pool
const initializeTournamentPoolService = (adminPublicKey, tournamentId, entryFee, maxParticipants, endTime, mintPublicKey, tokenType) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { program, connection } = (0, services_1.getProgram)();
        const tournamentPoolPublicKey = (0, getPDAs_2.getTournamentPoolPDA)(adminPublicKey, tournamentId, tokenType);
        const poolEscrowAccountPublicKey = tokenType === getPDAs_1.TokenType.SOL
            ? web3_js_1.SystemProgram.programId
            : (0, getPDAs_1.getTournamentEscrowPDA)(tournamentPoolPublicKey);
        const { blockhash } = yield connection.getLatestBlockhash("finalized");
        const CRD_DECIMALS = 9;
        const entryFeeInBaseUnits = Math.round(entryFee * Math.pow(10, CRD_DECIMALS));
        const entryFeeBN = new bn_js_1.BN(entryFeeInBaseUnits);
        console.log(`✅ Entry fee conversion: ${entryFee} → ${entryFeeInBaseUnits} base units`);
        console.log(`✅ Token Type: ${tokenType === getPDAs_1.TokenType.SOL ? 'SOL' : 'SPL'}`);
        const maxParticipantsBN = new bn_js_1.BN(maxParticipants);
        const endTimeBN = new bn_js_1.BN(endTime);
        const tokenTypeArg = tokenType === getPDAs_1.TokenType.SPL ? { spl: {} } : { sol: {} };
        // Build instruction
        const instruction = yield program.methods
            .createTournamentPool(tournamentId, entryFeeBN, maxParticipantsBN, endTimeBN, tokenTypeArg)
            .accounts({
            creator: adminPublicKey,
            tournamentPool: tournamentPoolPublicKey,
            poolEscrowAccount: poolEscrowAccountPublicKey,
            mint: mintPublicKey,
            systemProgram: web3_js_1.SystemProgram.programId,
            tokenProgram: spl_token_1.TOKEN_2022_PROGRAM_ID,
        })
            .instruction();
        // ✅ For SPL tokens, mark pool_escrow_account as writable
        if (tokenType === getPDAs_1.TokenType.SPL) {
            const escrowAccountIndex = instruction.keys.findIndex(key => key.pubkey.equals(poolEscrowAccountPublicKey));
            if (escrowAccountIndex !== -1) {
                instruction.keys[escrowAccountIndex].isWritable = true;
                console.log(`✅ Marked pool_escrow_account as writable for SPL: ${poolEscrowAccountPublicKey.toString()}`);
            }
            else {
                console.warn(`⚠️ Could not find pool_escrow_account in instruction keys`);
            }
        }
        else {
            console.log(`✅ SOL tournament - no escrow account write needed`);
        }
        // Create transaction
        const transaction = new web3_js_1.Transaction().add(instruction);
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = adminPublicKey;
        return {
            success: true,
            message: "Tournament pool transaction created successfully",
            transaction: transaction.serialize({ requireAllSignatures: false }).toString('base64'),
        };
    }
    catch (err) {
        console.error("❌ Error creating tournament pool:", err);
        return {
            success: false,
            message: `Error creating tournament pool: ${err.message || err}`
        };
    }
});
exports.initializeTournamentPoolService = initializeTournamentPoolService;
// Get tournament pool data
const getTournamentPool = (tournamentId, adminPublicKey, tokenType) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { program } = (0, services_1.getProgram)();
        const tournamentPoolPublicKey = (0, getPDAs_2.getTournamentPoolPDA)(adminPublicKey, tournamentId, tokenType);
        // Fetch the tournament pool data
        const tournamentPoolData = (yield program.account.tournamentPool.fetch(tournamentPoolPublicKey));
        return {
            success: true,
            data: {
                admin: tournamentPoolData.admin.toString(),
                mint: tournamentPoolData.mint.toString(),
                tournamentId: Buffer.from(tournamentPoolData.tournamentId).toString().replace(/\0+$/, ""),
                entryFee: tournamentPoolData.entryFee.toString(),
                totalFunds: tournamentPoolData.totalFunds.toString(),
                participantCount: tournamentPoolData.participantCount,
                maxParticipants: tournamentPoolData.maxParticipants,
                endTime: new Date(tournamentPoolData.endTime * 1000).toISOString(),
                isActive: tournamentPoolData.isActive,
                tokenType: tokenType,
            }
        };
    }
    catch (err) {
        console.error("❌ Error fetching tournament pool:", err);
        const errorMessage = err.message || err.toString() || "Unknown error";
        return {
            success: false,
            message: `Error fetching tournament data: ${errorMessage}`
        };
    }
});
exports.getTournamentPool = getTournamentPool;
// Get prize pool data for a tournament
const getPrizePoolService = (tournamentId, adminPublicKey, tokenType) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { program, connection } = (0, services_1.getProgram)();
        // Derive Tournament Pool PDA (same derivation as on-chain)
        const tournamentPoolPublicKey = (0, getPDAs_2.getTournamentPoolPDA)(adminPublicKey, tournamentId, tokenType);
        // Ensure tournament pool account exists before proceeding
        const tournamentPoolAccountInfo = yield connection.getAccountInfo(tournamentPoolPublicKey);
        if (!tournamentPoolAccountInfo) {
            return { success: false, message: "Tournament pool has not been initialized yet." };
        }
        // Derive Prize Pool PDA: seeds = [b"prize_pool", tournament_pool.key().as_ref()]
        const prizePoolPublicKey = (0, getPDAs_1.getPrizePoolPDA)(tournamentPoolPublicKey);
        // Check existence
        const prizePoolAccountInfo = yield connection.getAccountInfo(prizePoolPublicKey);
        if (!prizePoolAccountInfo) {
            return { success: false, message: "Prize pool has not been initialized yet." };
        }
        // Fetch prize pool account
        const prizePoolData = (yield program.account.prizePool.fetch(prizePoolPublicKey));
        // Derive Prize Escrow PDA: seeds = [b"prize_escrow", prize_pool.key().as_ref()]
        const prizeEscrowPublicKey = (0, getPDAs_1.getPrizeEscrowPDA)(prizePoolPublicKey);
        return {
            success: true,
            data: {
                address: prizePoolPublicKey.toString(),
                tournamentPool: prizePoolData.tournamentPool.toString(),
                admin: prizePoolData.admin.toString(),
                mint: prizePoolData.mint.toString(),
                prizeEscrowAccount: prizeEscrowPublicKey.toString(),
                tournamentId: Buffer.from(prizePoolData.tournamentId).toString().replace(/\0+$/, ""),
                totalFunds: prizePoolData.totalFunds.toString(),
                distributed: prizePoolData.distributed,
            },
        };
    }
    catch (err) {
        console.error("❌ Error fetching prize pool:", err);
        return { success: false, message: "Error fetching prize pool data" };
    }
});
exports.getPrizePoolService = getPrizePoolService;
// Get total funds across all prize pools (optionally filter by admin)
const getTotalPrizePoolsFundsService = (adminPublicKey) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { program } = (0, services_1.getProgram)();
        // Fetch all PrizePool accounts; optionally filter by admin
        const allPrizePools = yield program.account.prizePool.all();
        const filtered = adminPublicKey
            ? allPrizePools.filter((acc) => acc.account.admin.equals(adminPublicKey))
            : allPrizePools;
        // Sum total_funds as BN to avoid overflow
        const totalFundsBN = filtered.reduce((sum, acc) => {
            return sum.add(new anchor.BN(acc.account.totalFunds));
        }, new anchor.BN(0));
        // Provide both raw base units (string) and human-readable assuming 9 decimals
        const tokenDecimals = 9;
        const totalFundsReadable = Number(totalFundsBN.toString()) / Math.pow(10, tokenDecimals);
        return {
            success: true,
            data: {
                count: filtered.length,
                totalFundsRaw: totalFundsBN.toString(),
                totalFunds: totalFundsReadable,
                tokenDecimals,
            },
        };
    }
    catch (err) {
        console.error("❌ Error aggregating prize pools:", err);
        return { success: false, message: "Error aggregating prize pools" };
    }
});
exports.getTotalPrizePoolsFundsService = getTotalPrizePoolsFundsService;
// Get total funds contributed across all tournament pools for an admin
const getTotalTournamentPoolsFundsService = (adminPublicKey) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { program } = (0, services_1.getProgram)();
        // Fetch all TournamentPool accounts
        const allTournamentPools = yield program.account.tournamentPool.all();
        const filtered = adminPublicKey
            ? allTournamentPools.filter((acc) => acc.account.admin.equals(adminPublicKey))
            : allTournamentPools;
        // Sum total_funds and participants for extra context
        const totals = filtered.reduce((agg, acc) => {
            const funds = new anchor.BN(acc.account.totalFunds);
            const participants = acc.account.participantCount;
            return { funds: agg.funds.add(funds), participants: agg.participants + participants };
        }, { funds: new anchor.BN(0), participants: 0 });
        const tokenDecimals = 9;
        const totalFundsReadable = Number(totals.funds.toString()) / Math.pow(10, tokenDecimals);
        return {
            success: true,
            data: {
                count: filtered.length,
                totalFundsRaw: totals.funds.toString(),
                totalFunds: totalFundsReadable,
                totalParticipants: totals.participants,
                tokenDecimals,
            },
        };
    }
    catch (err) {
        console.error("❌ Error aggregating tournament pools:", err);
        return { success: false, message: "Error aggregating tournament pools" };
    }
});
exports.getTotalTournamentPoolsFundsService = getTotalTournamentPoolsFundsService;
// Get total entry fees collected from Firebase tournaments by admin
const getTotalTournamentEntryFeesService = (adminPublicKey) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const tournamentsRef = (0, database_1.ref)(firebase_1.db, "tournaments");
        const tournamentsSnapshot = yield (0, database_1.get)(tournamentsRef);
        if (!tournamentsSnapshot.exists()) {
            return { success: false, message: "No tournaments found" };
        }
        const tournaments = tournamentsSnapshot.val();
        const adminTournaments = Object.values(tournaments).filter((tournament) => tournament.createdBy === adminPublicKey);
        // Sum entry fees from all admin tournaments
        const totalEntryFees = adminTournaments.reduce((sum, tournament) => {
            const entryFee = parseFloat(tournament.entryFee) || 0;
            return sum + entryFee;
        }, 0);
        // Count total participants across all tournaments
        const totalParticipants = adminTournaments.reduce((sum, tournament) => {
            return sum + (tournament.participantsCount || 0);
        }, 0);
        return {
            success: true,
            data: {
                totalEntryFees,
                totalParticipants,
                tournamentCount: adminTournaments.length,
                adminPublicKey,
            },
        };
    }
    catch (err) {
        console.error("❌ Error calculating tournament entry fees:", err);
        return { success: false, message: "Error calculating tournament entry fees" };
    }
});
exports.getTotalTournamentEntryFeesService = getTotalTournamentEntryFeesService;
const registerForTournamentService = (tournamentId, userPublicKey, adminPublicKey, tokenType) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { program, connection } = (0, services_1.getProgram)();
        const tournamentPoolPublicKey = (0, getPDAs_2.getTournamentPoolPDA)(adminPublicKey, tournamentId, tokenType);
        // Check if tournament pool account exists before trying to fetch
        const accountInfo = yield connection.getAccountInfo(tournamentPoolPublicKey);
        if (!accountInfo) {
            return {
                success: false,
                message: `Tournament pool has not been initialized on-chain. The tournament administrator needs to initialize the tournament pool before participants can register.`,
                error: "TOURNAMENT_POOL_NOT_INITIALIZED",
                tournamentPoolPDA: tournamentPoolPublicKey.toString()
            };
        }
        // Account exists, fetch the data
        const tournamentPoolData = (yield program.account.tournamentPool.fetch(tournamentPoolPublicKey));
        const mintPublicKey = tournamentPoolData.mint;
        // Log the keys for debugging
        console.log(`🔍 Registration Debug - User: ${userPublicKey.toString()}, Mint: ${mintPublicKey.toString()}, TokenType: ${tokenType}`);
        let userTokenAccountPublicKey;
        let poolEscrowAccountPublicKey;
        if (tokenType === getPDAs_1.TokenType.SOL) {
            userTokenAccountPublicKey = web3_js_1.SystemProgram.programId;
            poolEscrowAccountPublicKey = web3_js_1.SystemProgram.programId;
        }
        else {
            // For SPL tokens, validate that mint is not SystemProgram (which would be invalid)
            if (mintPublicKey.equals(web3_js_1.SystemProgram.programId)) {
                return {
                    success: false,
                    message: `Invalid mint for SPL tournament. The tournament pool has SystemProgram.programId as mint, which is only valid for SOL tournaments. Tournament pool may need to be reinitialized with a valid SPL token mint.`,
                    error: "INVALID_SPL_MINT"
                };
            }
            poolEscrowAccountPublicKey = (0, getPDAs_1.getTournamentEscrowPDA)(tournamentPoolPublicKey);
            try {
                userTokenAccountPublicKey = (0, spl_token_1.getAssociatedTokenAddressSync)(mintPublicKey, userPublicKey, false, spl_token_1.TOKEN_2022_PROGRAM_ID);
                console.log(`✅ Derived ATA: ${userTokenAccountPublicKey.toString()}`);
            }
            catch (ataError) {
                console.error(`❌ ATA Derivation Error - User: ${userPublicKey.toString()}, Mint: ${mintPublicKey.toString()}, Error: ${ataError.message}`);
                return {
                    success: false,
                    message: `Failed to derive Associated Token Account address: ${ataError.message}. This usually means one of the public keys (user or mint) is not a valid ed25519 point on the curve. User: ${userPublicKey.toString()}, Mint: ${mintPublicKey.toString()}`,
                    error: "ATA_DERIVATION_ERROR",
                    details: {
                        userPublicKey: userPublicKey.toString(),
                        mintPublicKey: mintPublicKey.toString(),
                        errorMessage: ataError.message
                    }
                };
            }
            const userTokenAccountInfo = yield connection.getAccountInfo(userTokenAccountPublicKey);
            if (!userTokenAccountInfo) {
                console.log("User Token Account does not exist. Creating ATA...");
                const createATAResponse = yield (0, services_1.createAssociatedTokenAccount)(mintPublicKey, userPublicKey);
                console.log("Create ATA Response:", createATAResponse);
                userTokenAccountPublicKey = createATAResponse.associatedTokenAddress;
            }
        }
        const registrationAccountPublicKey = (0, getPDAs_1.getRegistrationPDA)(tournamentPoolPublicKey, userPublicKey);
        // ✅ Build instruction with explicit account metas for proper mutability
        const instruction = yield program.methods
            .registerForTournament(tournamentId)
            .accounts({
            user: userPublicKey,
            tournamentPool: tournamentPoolPublicKey,
            registrationAccount: registrationAccountPublicKey,
            userTokenAccount: userTokenAccountPublicKey,
            poolEscrowAccount: poolEscrowAccountPublicKey,
            mint: mintPublicKey,
            tokenProgram: tokenType === getPDAs_1.TokenType.SPL ? spl_token_1.TOKEN_2022_PROGRAM_ID : web3_js_1.SystemProgram.programId,
            systemProgram: web3_js_1.SystemProgram.programId,
        })
            .instruction();
        // ✅ For SPL tournaments, ensure pool_escrow_account is writable
        if (tokenType === getPDAs_1.TokenType.SPL) {
            // Find the pool_escrow_account in the instruction and ensure it's writable
            const escrowAccountIndex = instruction.keys.findIndex(key => key.pubkey.equals(poolEscrowAccountPublicKey));
            if (escrowAccountIndex !== -1) {
                instruction.keys[escrowAccountIndex].isWritable = true;
            }
            // Also ensure user_token_account is writable for SPL
            const userTokenAccountIndex = instruction.keys.findIndex(key => key.pubkey.equals(userTokenAccountPublicKey));
            if (userTokenAccountIndex !== -1) {
                instruction.keys[userTokenAccountIndex].isWritable = true;
            }
        }
        const transaction = new web3_js_1.Transaction().add(instruction);
        const { blockhash } = yield connection.getLatestBlockhash("finalized");
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = userPublicKey;
        return {
            success: true,
            message: "Successfully created transaction for registering for tournament",
            transaction: transaction.serialize({ requireAllSignatures: false }).toString('base64'),
        };
    }
    catch (err) {
        console.error("❌ Error registering for tournament:", err);
        return {
            success: false,
            message: `Error registering for tournament: ${err.message || err}`
        };
    }
});
exports.registerForTournamentService = registerForTournamentService;
//# sourceMappingURL=services.js.map