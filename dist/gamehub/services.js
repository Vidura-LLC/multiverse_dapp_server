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
dotenv_1.default.config();
// Function to initialize the tournament pool
const initializeTournamentPoolService = (adminPublicKey, tournamentId, entryFee, maxParticipants, endTime, mintPublicKey) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { program, connection } = (0, services_1.getProgram)();
        // Convert tournamentId correctly
        const tournamentIdBytes = Buffer.from(tournamentId, "utf8"); // Ensure UTF-8 encoding
        // Derive the correct PDA for the tournament pool
        const [tournamentPoolPublicKey] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("tournament_pool"), adminPublicKey.toBuffer(), tournamentIdBytes], program.programId);
        // Derive the escrow PDA correctly
        const [poolEscrowAccountPublicKey] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("escrow"), tournamentPoolPublicKey.toBuffer()], program.programId);
        console.log("✅ Tournament Pool PDA:", tournamentPoolPublicKey.toString());
        console.log("✅ Pool Escrow PDA:", poolEscrowAccountPublicKey.toString());
        const { blockhash } = yield connection.getLatestBlockhash("finalized");
        // Convert entry fee from CRD (user input) to base units (smart contract format)
        // CRD token has 9 decimals, so multiply by 10^9
        const CRD_DECIMALS = 9;
        const entryFeeInBaseUnits = Math.round(entryFee * Math.pow(10, CRD_DECIMALS));
        const entryFeeBN = new bn_js_1.BN(entryFeeInBaseUnits);
        console.log(`✅ Entry fee conversion: ${entryFee} CRD → ${entryFeeInBaseUnits} base units`);
        const maxParticipantsBN = new bn_js_1.BN(maxParticipants);
        const endTimeBN = new bn_js_1.BN(endTime);
        // Create the transaction without signing it
        const transaction = yield program.methods
            .createTournamentPool(tournamentId, entryFeeBN, maxParticipantsBN, endTimeBN)
            .accounts({
            admin: adminPublicKey,
            tournamentPool: tournamentPoolPublicKey,
            poolEscrowAccount: poolEscrowAccountPublicKey,
            mint: mintPublicKey,
            systemProgram: web3_js_1.SystemProgram.programId,
            tokenProgram: spl_token_1.TOKEN_2022_PROGRAM_ID,
        })
            .transaction();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = adminPublicKey;
        // Return the unsigned transaction for frontend to sign
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
const getTournamentPool = (tournamentId, adminPublicKey) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { program } = (0, services_1.getProgram)();
        const tournamentIdBytes = Buffer.from(tournamentId, "utf8");
        const [tournamentPoolPublicKey] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("tournament_pool"), adminPublicKey.toBuffer(), tournamentIdBytes], program.programId);
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
            }
        };
    }
    catch (err) {
        console.error("❌ Error fetching tournament pool:", err);
        return { success: false, message: "Error fetching tournament data" };
    }
});
exports.getTournamentPool = getTournamentPool;
// Get prize pool data for a tournament
const getPrizePoolService = (tournamentId, adminPublicKey) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { program, connection } = (0, services_1.getProgram)();
        // Derive Tournament Pool PDA (same derivation as on-chain)
        const tournamentIdBytes = Buffer.from(tournamentId, "utf8");
        const [tournamentPoolPublicKey] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("tournament_pool"), adminPublicKey.toBuffer(), tournamentIdBytes], program.programId);
        // Ensure tournament pool account exists before proceeding
        const tournamentPoolAccountInfo = yield connection.getAccountInfo(tournamentPoolPublicKey);
        if (!tournamentPoolAccountInfo) {
            return { success: false, message: "Tournament pool has not been initialized yet." };
        }
        // Derive Prize Pool PDA: seeds = [b"prize_pool", tournament_pool.key().as_ref()]
        const [prizePoolPublicKey] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("prize_pool"), tournamentPoolPublicKey.toBuffer()], program.programId);
        // Check existence
        const prizePoolAccountInfo = yield connection.getAccountInfo(prizePoolPublicKey);
        if (!prizePoolAccountInfo) {
            return { success: false, message: "Prize pool has not been initialized yet." };
        }
        // Fetch prize pool account
        const prizePoolData = (yield program.account.prizePool.fetch(prizePoolPublicKey));
        // Derive Prize Escrow PDA: seeds = [b"prize_escrow", prize_pool.key().as_ref()]
        const [prizeEscrowPublicKey] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("prize_escrow"), prizePoolPublicKey.toBuffer()], program.programId);
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
// Register for tournament
const registerForTournamentService = (tournamentId, userPublicKey, adminPublicKey) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { program, connection } = (0, services_1.getProgram)();
        const tournamentIdBytes = Buffer.from(tournamentId, "utf8");
        // Get tournament pool PDA
        const [tournamentPoolPublicKey] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("tournament_pool"), adminPublicKey.toBuffer(), tournamentIdBytes], program.programId);
        // Fetch the tournament pool data
        const tournamentPoolData = (yield program.account.tournamentPool.fetch(tournamentPoolPublicKey));
        const mintPublicKey = tournamentPoolData.mint;
        // Get escrow PDA
        const [poolEscrowAccountPublicKey] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("escrow"), tournamentPoolPublicKey.toBuffer()], program.programId);
        // Get registration PDA
        const [registrationAccountPublicKey] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("registration"), tournamentPoolPublicKey.toBuffer(), userPublicKey.toBuffer()], program.programId);
        let userTokenAccountPublicKey = yield (0, spl_token_1.getAssociatedTokenAddressSync)(mintPublicKey, userPublicKey, false, spl_token_1.TOKEN_2022_PROGRAM_ID);
        console.log("User Token Account PublicKey:", userTokenAccountPublicKey.toBase58());
        if (!userTokenAccountPublicKey) {
            console.log("User Token Account PublicKey does not exist. Creating ATA...");
            const createATAResponse = yield (0, services_1.createAssociatedTokenAccount)(mintPublicKey, userPublicKey);
            console.log("Create ATA Response:", createATAResponse);
            userTokenAccountPublicKey = createATAResponse.associatedTokenAddress;
        }
        const transaction = yield program.methods
            .registerForTournament(tournamentId)
            .accounts({
            user: userPublicKey,
            tournamentPool: tournamentPoolPublicKey,
            registrationAccount: registrationAccountPublicKey,
            userTokenAccount: userTokenAccountPublicKey,
            poolEscrowAccount: poolEscrowAccountPublicKey,
            mint: mintPublicKey,
            tokenProgram: spl_token_1.TOKEN_2022_PROGRAM_ID,
            systemProgram: web3_js_1.SystemProgram.programId,
        })
            .transaction();
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