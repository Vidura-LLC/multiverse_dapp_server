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
exports.registerForTournamentService = exports.createTournamentPoolService = void 0;
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
// ✅ Function to register for a tournament
const registerForTournamentService = (mintPublicKey, entryFee // Assuming this is in the smallest token unit
) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { program, adminPublicKey, adminKeypair, connection } = getProgram();
        // Find the tournament pool and escrow account
        const [tournamentPoolPublicKey] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("tournament_pool"), adminPublicKey.toBuffer()], program.programId);
        const [escrowAccountPublicKey] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("escrow"), tournamentPoolPublicKey.toBuffer()], program.programId);
        // Get the user's token account (create if it doesn't exist)
        const userTokenAccountPublicKey = yield getOrCreateAssociatedTokenAccount(connection, mintPublicKey, adminPublicKey);
        console.log("User PublicKey:", adminPublicKey.toBase58());
        console.log("Tournament Pool PublicKey:", tournamentPoolPublicKey.toBase58());
        console.log("Escrow Account PublicKey:", escrowAccountPublicKey.toBase58());
        // Get the latest blockhash
        const { blockhash } = yield connection.getLatestBlockhash("finalized");
        // Create the unsigned transaction for registering the user
        const transaction = yield program.methods
            .registerForTournament(new anchor.BN(entryFee)) // Assuming entryFee is the amount to send
            .accounts({
            user: adminPublicKey,
            tournamentPool: tournamentPoolPublicKey,
            userTokenAccount: userTokenAccountPublicKey,
            escrowAccount: escrowAccountPublicKey,
            mint: mintPublicKey,
            tokenProgram: spl_token_1.TOKEN_2022_PROGRAM_ID,
            systemProgram: web3_js_1.SystemProgram.programId,
        })
            .transaction(); // Create the transaction, don't sign it
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = adminPublicKey;
        // Sign the transaction with the user's keypair
        console.log("Signing the transaction with the user's keypair...");
        yield transaction.sign(adminKeypair); // Sign the transaction with the user keypair
        // Serialize the transaction and send it to the frontend for submission
        const serializedTransaction = transaction.serialize();
        const transactionBase64 = Buffer.from(serializedTransaction).toString("base64");
        console.log("Serialized Transaction (Base64):", transactionBase64);
        // Send the transaction to the Solana network and get the signature
        const transactionSignature = yield connection.sendTransaction(transaction, [adminKeypair], {
            skipPreflight: false,
            preflightCommitment: "processed",
        });
        console.log("Transaction sent successfully, Transaction ID (Signature):", transactionSignature);
        // Confirm the transaction (optional)
        const confirmation = yield connection.confirmTransaction(transactionSignature, "confirmed");
        console.log("Transaction confirmation:", confirmation);
        return {
            success: true,
            message: "Transaction created, signed, and sent successfully!",
            transaction: transactionBase64,
            transactionSignature: transactionSignature // Return the transaction ID for reference
        };
    }
    catch (err) {
        console.error("❌ Error registering for tournament:", err);
        return { success: false, message: "Error registering for tournament" };
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
            const { adminKeypair } = getProgram();
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