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
exports.stakeTokenService = exports.initializeAccountsService = void 0;
const web3_js_1 = require("@solana/web3.js");
const anchor = __importStar(require("@project-serum/anchor"));
const spl_token_1 = require("@solana/spl-token");
const bytes_1 = require("@project-serum/anchor/dist/cjs/utils/bytes");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
// Load the user's secret key from `.env`
const userSecretBase58 = process.env.SECRET_KEY;
if (!userSecretBase58) {
    throw new Error("USER_SECRET_KEY is missing in .env");
}
const userSecretKey = bytes_1.bs58.decode(userSecretBase58);
const userKeypair = web3_js_1.Keypair.fromSecretKey(userSecretKey);
console.log("User Public Key:", userKeypair.publicKey.toBase58()); // Debugging
// Helper function to get the program
const getProgram = () => {
    const idl = require("./idl.json");
    const walletKeypair = require("./wallet-keypair.json");
    const adminKeypair = web3_js_1.Keypair.fromSecretKey(new Uint8Array(walletKeypair));
    const adminPublicKey = adminKeypair.publicKey;
    const connection = new web3_js_1.Connection((0, web3_js_1.clusterApiUrl)("devnet"), "confirmed");
    const programId = new web3_js_1.PublicKey("9zYBuWmk35JryeiwzuZK8fen2koGuxTKh3qDDWtnWBFq");
    const provider = new anchor.AnchorProvider(connection, new anchor.Wallet(adminKeypair), anchor.AnchorProvider.defaultOptions());
    anchor.setProvider(provider);
    return {
        program: new anchor.Program(idl, programId, provider),
        adminPublicKey,
        adminKeypair,
        connection,
    };
};
// ✅ Function to initialize the staking pool and escrow account
const initializeAccountsService = (mintPublicKey) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { program, adminPublicKey } = getProgram();
        const [stakingPoolPublicKey] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("staking_pool"), adminPublicKey.toBuffer()], program.programId);
        const [poolEscrowAccountPublicKey] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("escrow"), stakingPoolPublicKey.toBuffer()], program.programId);
        console.log("🔹 Staking Pool PDA Address:", stakingPoolPublicKey.toString());
        console.log("🔹 Pool Escrow Account Address:", poolEscrowAccountPublicKey.toString());
        yield program.methods
            .initializeAccounts()
            .accounts({
            admin: adminPublicKey,
            stakingPool: stakingPoolPublicKey,
            mint: mintPublicKey,
            poolEscrowAccount: poolEscrowAccountPublicKey,
            systemProgram: web3_js_1.SystemProgram.programId,
            tokenProgram: spl_token_1.TOKEN_2022_PROGRAM_ID,
        })
            .rpc();
        return { success: true, message: "Staking pool initialized successfully!" };
    }
    catch (err) {
        console.error("❌ Error initializing staking pool:", err);
        return { success: false, message: "Error initializing staking pool" };
    }
});
exports.initializeAccountsService = initializeAccountsService;
const stakeTokenService = (mintPublicKey, userPublicKey, amount) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { program, adminPublicKey, connection } = getProgram();
        const [stakingPoolPublicKey] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("staking_pool"), adminPublicKey.toBuffer()], program.programId);
        const [userStakingAccountPublicKey] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("user_stake"), userPublicKey.toBuffer()], program.programId);
        const [poolEscrowAccountPublicKey] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("escrow"), stakingPoolPublicKey.toBuffer()], program.programId);
        const userTokenAccountPublicKey = yield getOrCreateAssociatedTokenAccount(connection, mintPublicKey, userPublicKey);
        const { blockhash } = yield connection.getLatestBlockhash("finalized");
        // ✅ Create an unsigned transaction
        const transaction = yield program.methods
            .stake(new anchor.BN(amount))
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
            .transaction(); // ⬅️ Create transaction, don't sign
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = userPublicKey;
        // Serialize transaction and send it to the frontend
        return {
            success: true,
            message: "Transaction created successfully!",
            transaction: transaction.serialize({ requireAllSignatures: false }),
        };
    }
    catch (err) {
        console.error("❌ Error creating staking transaction:", err);
        return { success: false, message: "Error creating staking transaction" };
    }
});
exports.stakeTokenService = stakeTokenService;
// ✅ Helper function to get or create an associated token account
function getOrCreateAssociatedTokenAccount(connection, mint, owner) {
    return __awaiter(this, void 0, void 0, function* () {
        const associatedTokenAddress = (0, spl_token_1.getAssociatedTokenAddressSync)(mint, owner, false, // ✅ Not a PDA
        spl_token_1.TOKEN_2022_PROGRAM_ID);
        const accountInfo = yield connection.getAccountInfo(associatedTokenAddress);
        if (!accountInfo) {
            console.log(`🔹 Token account does not exist. Creating ATA: ${associatedTokenAddress.toBase58()}`);
            const transaction = new anchor.web3.Transaction().add((0, spl_token_1.createAssociatedTokenAccountInstruction)(owner, associatedTokenAddress, owner, mint, spl_token_1.TOKEN_2022_PROGRAM_ID));
            yield anchor.web3.sendAndConfirmTransaction(connection, transaction, [
                userKeypair,
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