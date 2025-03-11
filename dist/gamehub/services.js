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
exports.createTournamentPoolService = void 0;
const web3_js_1 = require("@solana/web3.js");
const anchor = __importStar(require("@project-serum/anchor"));
const spl_token_1 = require("@solana/spl-token");
const dotenv_1 = __importDefault(require("dotenv"));
const bn_js_1 = require("bn.js");
dotenv_1.default.config();
// Helper function to get the program
const getProgram = () => {
    const idl = require("../staking/idl.json"); // The IDL of your smart contract
    const walletKeypair = require("../staking/cosRayAdmin.json"); // Admin wallet keypair
    const adminKeypair = web3_js_1.Keypair.fromSecretKey(new Uint8Array(walletKeypair));
    const adminPublicKey = adminKeypair.publicKey;
    const connection = new web3_js_1.Connection((0, web3_js_1.clusterApiUrl)("devnet"), "confirmed");
    const programId = new web3_js_1.PublicKey("BmBAppuJQGGHmVizxKLBpJbFtq8yGe9v7NeVgHPEM4Vs" // Replace with your actual program ID
    );
    const provider = new anchor.AnchorProvider(connection, new anchor.Wallet(adminKeypair), anchor.AnchorProvider.defaultOptions());
    anchor.setProvider(provider);
    return {
        program: new anchor.Program(idl, programId, provider),
        adminPublicKey,
        adminKeypair,
        connection,
    };
};
// ✅ Function to create the tournament pool and escrow account
const createTournamentPoolService = (tournamentId, entryFee, mintPublicKey) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { program, adminPublicKey } = getProgram();
        // Find the program addresses (PDAs) for the tournament pool and escrow account
        const [tournamentPoolPublicKey] = yield web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("tournament_pool"), adminPublicKey.toBuffer()], program.programId);
        const [escrowAccountPublicKey] = yield web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("escrow"), tournamentPoolPublicKey.toBuffer()], program.programId);
        console.log("🔹 Tournament Pool PDA Address:", tournamentPoolPublicKey.toString());
        console.log("🔹 Escrow Account PDA Address:", escrowAccountPublicKey.toString());
        const entryFeeBN = new bn_js_1.BN(entryFee);
        // Call the create_tournament_pool method from the program
        yield program.methods
            .createTournamentPool(tournamentId, entryFeeBN, mintPublicKey)
            .accounts({
            admin: adminPublicKey,
            tournamentPool: tournamentPoolPublicKey,
            escrowAccount: escrowAccountPublicKey,
            mint: mintPublicKey,
            systemProgram: web3_js_1.SystemProgram.programId,
            tokenProgram: spl_token_1.TOKEN_2022_PROGRAM_ID,
        })
            .rpc();
        return { success: true, message: "Tournament pool created successfully!" };
    }
    catch (err) {
        console.error("❌ Error creating tournament pool:", err);
        return { success: false, message: "Error creating tournament pool" };
    }
});
exports.createTournamentPoolService = createTournamentPoolService;
//# sourceMappingURL=services.js.map