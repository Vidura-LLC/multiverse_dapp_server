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
exports.registerForTournamentService = exports.getTournamentPool = exports.initializeTournamentPoolService = void 0;
const web3_js_1 = require("@solana/web3.js");
const anchor = __importStar(require("@project-serum/anchor"));
const spl_token_1 = require("@solana/spl-token");
const dotenv_1 = __importDefault(require("dotenv"));
const bn_js_1 = require("bn.js");
const services_1 = require("../staking/services");
dotenv_1.default.config();
// ✅ Function to initialize the tournament pool
const initializeTournamentPoolService = (adminPublicKey, tournamentId, entryFee, maxParticipants, endTime, mintPublicKey) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { program, connection } = (0, services_1.getProgram)();
        // 🔹 Convert tournamentId correctly
        const tournamentIdBytes = Buffer.from(tournamentId, "utf8"); // Ensure UTF-8 encoding
        // 🔹 Derive the correct PDA for the tournament pool
        const [tournamentPoolPublicKey] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("tournament_pool"), adminPublicKey.toBuffer(), tournamentIdBytes], program.programId);
        // 🔹 Derive the escrow PDA correctly
        const [poolEscrowAccountPublicKey] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("escrow"), tournamentPoolPublicKey.toBuffer()], program.programId);
        console.log("✅ Tournament Pool PDA:", tournamentPoolPublicKey.toString());
        console.log("✅ Pool Escrow PDA:", poolEscrowAccountPublicKey.toString());
        const { blockhash } = yield connection.getLatestBlockhash("finalized");
        const entryFeeBN = new bn_js_1.BN(entryFee);
        const maxParticipantsBN = new bn_js_1.BN(maxParticipants);
        const endTimeBN = new bn_js_1.BN(endTime);
        // 🔹 Create the transaction without signing it
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
        // 🔹 Fetch the tournament pool data
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
// Register for tournament
const registerForTournamentService = (tournamentId, userPublicKey, adminPublicKey) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { program, connection } = (0, services_1.getProgram)();
        const tournamentIdBytes = Buffer.from(tournamentId, "utf8");
        // Get tournament pool PDA
        const [tournamentPoolPublicKey] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("tournament_pool"), adminPublicKey.toBuffer(), tournamentIdBytes], program.programId);
        // 🔹 Fetch the tournament pool data
        const tournamentPoolData = (yield program.account.tournamentPool.fetch(tournamentPoolPublicKey));
        const mintPublicKey = tournamentPoolData.mint;
        // Get escrow PDA
        const [poolEscrowAccountPublicKey] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("escrow"), tournamentPoolPublicKey.toBuffer()], program.programId);
        // Get registration PDA
        const [registrationAccountPublicKey] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("registration"), tournamentPoolPublicKey.toBuffer(), userPublicKey.toBuffer()], program.programId);
        const userTokenAccount = yield getOrCreateAssociatedTokenAccount(connection, mintPublicKey, userPublicKey);
        console.log('User Token Account Public:', userTokenAccount);
        const transaction = yield program.methods
            .registerForTournament(tournamentId)
            .accounts({
            user: userPublicKey,
            tournamentPool: tournamentPoolPublicKey,
            registrationAccount: registrationAccountPublicKey,
            userTokenAccount: userTokenAccount,
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
// ✅ Helper function to get or create an associated token account
function getOrCreateAssociatedTokenAccount(connection, mint, owner) {
    return __awaiter(this, void 0, void 0, function* () {
        const associatedTokenAddress = (0, spl_token_1.getAssociatedTokenAddressSync)(mint, owner, false, // ✅ Not a PDA
        spl_token_1.TOKEN_2022_PROGRAM_ID);
        const accountInfo = yield connection.getAccountInfo(associatedTokenAddress);
        if (!accountInfo) {
            console.log(`🔹 Token account does not exist. Creating ATA: ${associatedTokenAddress.toBase58()}`);
            const transaction = new anchor.web3.Transaction().add((0, spl_token_1.createAssociatedTokenAccountInstruction)(owner, associatedTokenAddress, owner, mint, spl_token_1.TOKEN_2022_PROGRAM_ID));
            const { adminKeypair } = (0, services_1.getProgram)();
            yield anchor.web3.sendAndConfirmTransaction(connection, transaction, [
                adminKeypair
            ]);
            console.log(`✅ Successfully created ATA: ${associatedTokenAddress.toBase58()}`);
        }
        else {
            console.log(`🔹 Token account exists: ${associatedTokenAddress.toBase58()}`);
        }
        return associatedTokenAddress;
    });
}
//# sourceMappingURL=services.js.map