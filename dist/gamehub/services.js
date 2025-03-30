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
exports.createTokenAccountIfNeeded = exports.cancelTournament = exports.endTournament = exports.registerForTournament = exports.getTournamentPool = exports.initializeTournamentPool = void 0;
const web3_js_1 = require("@solana/web3.js");
const anchor = __importStar(require("@project-serum/anchor"));
const spl_token_1 = require("@solana/spl-token");
const dotenv_1 = __importDefault(require("dotenv"));
const bn_js_1 = require("bn.js");
dotenv_1.default.config();
// 🔹 Helper function to get the program
const getProgram = () => {
    const idl = require("../gamehub/gamehub_idl.json");
    const walletKeypair = require("../staking/cosRayAdmin.json");
    const adminKeypair = web3_js_1.Keypair.fromSecretKey(new Uint8Array(walletKeypair));
    const adminPublicKey = adminKeypair.publicKey;
    const connection = new web3_js_1.Connection((0, web3_js_1.clusterApiUrl)("devnet"), "confirmed");
    const programId = new web3_js_1.PublicKey("BmBAppuJQGGHmVizxKLBpJbFtq8yGe9v7NeVgHPEM4Vs" // Updated to match the program ID from contract
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
// ✅ Function to initialize the tournament pool
const initializeTournamentPool = (adminPublicKey, tournamentId, entryFee, maxParticipants, endTime, mintPublicKey) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { program, connection } = getProgram();
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
        // 🔹 Create and sign the transaction
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
        return {
            success: true,
            message: "Tournament pool transaction created successfully",
            transaction: transaction.serialize({ requireAllSignatures: false }),
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
exports.initializeTournamentPool = initializeTournamentPool;
// Get tournament pool data
const getTournamentPool = (tournamentId, adminPublicKey) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { program } = getProgram();
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
const registerForTournament = (tournamentId, userPublicKey, adminPublicKey) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { program, connection } = getProgram();
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
            transaction: transaction.serialize({ requireAllSignatures: false }),
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
exports.registerForTournament = registerForTournament;
// End tournament
const endTournament = (tournamentId, winnerPercentages, winnerAddresses) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { program, connection, adminKeypair, adminPublicKey } = getProgram();
        const tournamentIdBytes = Buffer.from(tournamentId, "utf8");
        // Get tournament pool PDA
        const [tournamentPoolPublicKey] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("tournament_pool"), adminPublicKey.toBuffer(), tournamentIdBytes], program.programId);
        // Get tournament data to access mint
        // 🔹 Fetch the tournament pool data
        const tournamentPoolData = (yield program.account.tournamentPool.fetch(tournamentPoolPublicKey));
        const mintPublicKey = tournamentPoolData.mint;
        // Get escrow PDA
        const [poolEscrowAccountPublicKey] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("escrow"), tournamentPoolPublicKey.toBuffer()], program.programId);
        // Convert winner addresses to PublicKey objects
        const winnerPublicKeys = winnerAddresses.map(address => new web3_js_1.PublicKey(address));
        // Convert percentages to u8 array
        const winnerPercentagesU8 = Uint8Array.from(winnerPercentages);
        const tx = yield program.methods
            .endTournament(tournamentId, winnerPercentagesU8, winnerPublicKeys)
            .accounts({
            admin: adminPublicKey,
            tournamentPool: tournamentPoolPublicKey,
            poolEscrowAccount: poolEscrowAccountPublicKey,
            mint: mintPublicKey,
            tokenProgram: spl_token_1.TOKEN_2022_PROGRAM_ID,
            systemProgram: web3_js_1.SystemProgram.programId,
        })
            .transaction();
        const { blockhash } = yield connection.getLatestBlockhash("finalized");
        tx.recentBlockhash = blockhash;
        tx.feePayer = adminPublicKey;
        tx.sign(adminKeypair);
        const signature = yield connection.sendRawTransaction(tx.serialize());
        yield connection.confirmTransaction(signature);
        return {
            success: true,
            message: "Tournament ended successfully",
            signature
        };
    }
    catch (err) {
        console.error("❌ Error ending tournament:", err);
        return {
            success: false,
            message: `Error ending tournament: ${err.message || err}`
        };
    }
});
exports.endTournament = endTournament;
// Cancel tournament
const cancelTournament = (tournamentId) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { program, connection, adminKeypair, adminPublicKey } = getProgram();
        const tournamentIdBytes = Buffer.from(tournamentId, "utf8");
        // Get tournament pool PDA
        const [tournamentPoolPublicKey] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("tournament_pool"), adminPublicKey.toBuffer(), tournamentIdBytes], program.programId);
        // Get tournament data to access mint
        // 🔹 Fetch the tournament pool data
        const tournamentPoolData = (yield program.account.tournamentPool.fetch(tournamentPoolPublicKey));
        const mintPublicKey = tournamentPoolData.mint;
        // Get escrow PDA
        const [poolEscrowAccountPublicKey] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("escrow"), tournamentPoolPublicKey.toBuffer()], program.programId);
        const tx = yield program.methods
            .cancelTournament(tournamentId)
            .accounts({
            admin: adminPublicKey,
            tournamentPool: tournamentPoolPublicKey,
            poolEscrowAccount: poolEscrowAccountPublicKey,
            mint: mintPublicKey,
            tokenProgram: spl_token_1.TOKEN_2022_PROGRAM_ID,
            systemProgram: web3_js_1.SystemProgram.programId,
        })
            .transaction();
        const { blockhash } = yield connection.getLatestBlockhash("finalized");
        tx.recentBlockhash = blockhash;
        tx.feePayer = adminPublicKey;
        tx.sign(adminKeypair);
        const signature = yield connection.sendRawTransaction(tx.serialize());
        yield connection.confirmTransaction(signature);
        return {
            success: true,
            message: "Tournament cancelled successfully",
            signature
        };
    }
    catch (err) {
        console.error("❌ Error cancelling tournament:", err);
        return {
            success: false,
            message: `Error cancelling tournament: ${err.message || err}`
        };
    }
});
exports.cancelTournament = cancelTournament;
// Helper function to create a token account if it doesn't exist
const createTokenAccountIfNeeded = (owner, mint) => __awaiter(void 0, void 0, void 0, function* () {
    const { connection, adminKeypair } = getProgram();
    try {
        // Get the associated token address
        const tokenAddress = (0, spl_token_1.getAssociatedTokenAddressSync)(mint, owner, false, spl_token_1.TOKEN_2022_PROGRAM_ID);
        // Check if the account exists
        const accountInfo = yield connection.getAccountInfo(tokenAddress);
        if (!accountInfo) {
            // Create the account if it doesn't exist
            const instruction = (0, spl_token_1.createAssociatedTokenAccountInstruction)(adminKeypair.publicKey, tokenAddress, owner, mint, spl_token_1.TOKEN_2022_PROGRAM_ID);
            const transaction = new anchor.web3.Transaction().add(instruction);
            transaction.feePayer = adminKeypair.publicKey;
            const { blockhash } = yield connection.getLatestBlockhash();
            transaction.recentBlockhash = blockhash;
            transaction.sign(adminKeypair);
            const signature = yield connection.sendRawTransaction(transaction.serialize());
            yield connection.confirmTransaction(signature);
            console.log("✅ Token account created:", tokenAddress.toString());
        }
        else {
            console.log("✅ Token account already exists:", tokenAddress.toString());
        }
        return { success: true, tokenAddress };
    }
    catch (err) {
        console.error("❌ Error creating token account:", err);
        return { success: false, message: "Error creating token account" };
    }
});
exports.createTokenAccountIfNeeded = createTokenAccountIfNeeded;
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
// // Fetch the Tournament Pool Account
// export const getTournamentPool = async (
//   adminPublicKey: PublicKey,
//   tournamentId: string
// ) => {
//   try {
//     const { program, connection } = getProgram();
//     // 🔹 Convert `tournamentId` to a fixed 10-byte buffer
//     const toFixedSizeBytes = (str: string, size: number): Buffer => {
//       const buffer = Buffer.alloc(size);
//       Buffer.from(str).copy(buffer);
//       return buffer;
//     };
//     const tournamentIdBytes = toFixedSizeBytes(tournamentId, 10);
//     // 🔹 Derive the PDA for the tournament pool using `tournamentId`
//     const [tournamentPoolPublicKey] = PublicKey.findProgramAddressSync(
//       [Buffer.from("tournament_pool"), adminPublicKey.toBuffer(), tournamentIdBytes],
//       program.programId
//     );
//     console.log("🔹 Tournament Pool PublicKey:", tournamentPoolPublicKey.toBase58());
//     // 🔹 Check if the tournament pool account exists
//     const accountExists = await connection.getAccountInfo(tournamentPoolPublicKey);
//     if (!accountExists) {
//       return { success: false, message: "Tournament pool does not exist." };
//     }
//     // 🔹 Fetch the tournament pool data
//     const tournamentPool = (await program.account.tournamentPool.fetch(
//       tournamentPoolPublicKey
//     )) as TournamentPoolAccount;
//     console.log("📜 Tournament Pool:", tournamentPool);
//     // 🔹 Convert entryFee to a readable format (assuming 9 decimal places)
//     const tokenDecimals = 9;
//     const readableEntryFee = tournamentPool.entryFee.toNumber() / 10 ** tokenDecimals;
//     // 🔹 Ensure all fields are defined and safely converted to strings
//     const rawData = {
//       tournamentId: tournamentId, // Convert bytes back to string
//       entryFee: readableEntryFee, // Convert entryFee to human-readable format
//       totalFunds: tournamentPool.totalFunds.toString(),
//       admin: tournamentPool.admin.toBase58(),
//     };
//     console.log("✅ Tournament Pool Data:", rawData);
//     return { success: true, data: rawData };
//   } catch (err) {
//     console.error("❌ Error fetching tournament pool:", err);
//     return { success: false, message: "Error fetching tournament pool." };
//   }
// };
// export const registerForTournamentService = async (
//   mintPublicKey: PublicKey,
//   userPublicKey: PublicKey,
//   adminPublicKey: PublicKey
// ) => {
//   try {
//     const { program, connection  } = getProgram();
//     // Fetch the tournament pool details (including entryFee)
//     const tournamentPoolData = await getTournamentPool(adminPublicKey);
//     if (!tournamentPoolData.success) {
//       return { success: false, message: tournamentPoolData.message };
//     }
//     const entryFee = tournamentPoolData.data.entryFee;
//     // Derive the program addresses (PDAs) for the tournament pool and escrow account
//     const [tournamentPoolPublicKey] = PublicKey.findProgramAddressSync(
//       [Buffer.from("tournament_pool"), adminPublicKey.toBuffer()],
//       program.programId
//     );
//     const [poolEscrowAccountPublicKey] = PublicKey.findProgramAddressSync(
//       [Buffer.from("escrow"), tournamentPoolPublicKey.toBuffer()],
//       program.programId
//     );
//     console.log("🔹 tournamentPool PDA Address:", tournamentPoolPublicKey.toString());
//     console.log("🔹 Pool Escrow Account Address:", poolEscrowAccountPublicKey.toString());
//     // Get the user's token account (create if it doesn't exist)
//     const userTokenAccountPublicKey = await getOrCreateAssociatedTokenAccount(
//       connection,
//       mintPublicKey,
//       userPublicKey
//     );
//     console.log('User PublicKey:', userPublicKey.toBase58());
//     console.log('Tournament Pool PublicKey:', tournamentPoolPublicKey.toBase58());
//     console.log('Escrow Account PublicKey:', poolEscrowAccountPublicKey.toBase58());
//     // Ensure the user has enough balance for the entry fee
//     const userTokenAccountInfo = await connection.getAccountInfo(userTokenAccountPublicKey);
//     const userBalance = userTokenAccountInfo?.lamports || 0; // Fetch user's balance in token units
//     const entryFeeLamports = new BN(entryFee * 10 ** 9); // Convert entry fee to lamports (considering decimals)
//     if (userBalance < entryFeeLamports.toNumber()) {
//       return { success: false, message: 'Insufficient funds for registration' };
//     }
//     // Get the latest blockhash
//     const { blockhash } = await connection.getLatestBlockhash('finalized');
//     // Create the unsigned transaction for registering the user
//     const transaction = await program.methods
//       .registerForTournament() // No need to pass entryFee since it's fetched from the pool
//       .accounts({
//         user: userPublicKey,
//         tournamentPool: tournamentPoolPublicKey,
//         userTokenAccount: userTokenAccountPublicKey,
//         poolEscrowAccount: poolEscrowAccountPublicKey, // Ensure escrow account is passed here
//         mint: mintPublicKey,
//         tokenProgram: TOKEN_2022_PROGRAM_ID,
//         systemProgram: SystemProgram.programId,
//       })
//       .transaction(); // Create the transaction, don't sign it
//     transaction.recentBlockhash = blockhash;
//     transaction.feePayer = userPublicKey;
//     // Serialize transaction and send it to the frontend
//     return {
//       success: true,
//       message: "Transaction created successfully!",
//       transaction: transaction.serialize({ requireAllSignatures: false })
//     };
//   } catch (err) {
//     console.error("❌ Error creating staking transaction:", err);
//     return { success: false, message: "Error creating staking transaction" };
//   }
// };
// export const registerForTournamentServiceWithKeypair = async (
//   mintPublicKey: PublicKey
// ) => {
//   try {
//     const { program, adminKeypair, connection, adminPublicKey } = getProgram();
//     // Fetch the tournament pool details (including entryFee)
//     const tournamentPoolData = await getTournamentPool(adminPublicKey);
//     if (!tournamentPoolData.success) {
//       return { success: false, message: tournamentPoolData.message };
//     }
//     const entryFee = tournamentPoolData.data.entryFee;
//     // Derive the program addresses (PDAs) for the tournament pool and escrow account
//     const [tournamentPoolPublicKey] = PublicKey.findProgramAddressSync(
//       [Buffer.from("tournament_pool"), adminPublicKey.toBuffer()],
//       program.programId
//     );
//     const [poolEscrowAccountPublicKey] = PublicKey.findProgramAddressSync(
//       [Buffer.from("escrow"), tournamentPoolPublicKey.toBuffer()],
//       program.programId
//     );
//     console.log("🔹 tournamentPool PDA Address:", tournamentPoolPublicKey.toString());
//     console.log("🔹 Pool Escrow Account Address:", poolEscrowAccountPublicKey.toString());
//     // Get the user's token account (create if it doesn't exist)
//     const userTokenAccountPublicKey = await getOrCreateAssociatedTokenAccount(
//       connection,
//       mintPublicKey,
//       adminPublicKey
//     );
//     console.log('User PublicKey:', adminPublicKey.toBase58());
//     console.log('Tournament Pool PublicKey:', tournamentPoolPublicKey.toBase58());
//     console.log('Escrow Account PublicKey:', poolEscrowAccountPublicKey.toBase58());
//     // Ensure the user has enough balance for the entry fee
//     const userTokenAccountInfo = await connection.getAccountInfo(userTokenAccountPublicKey);
//     const userBalance = userTokenAccountInfo?.lamports || 0; // Fetch user's balance in token units
//     const entryFeeLamports = new BN(entryFee * 10 ** 9); // Convert entry fee to lamports (considering decimals)
//     if (userBalance < entryFeeLamports.toNumber()) {
//       return { success: false, message: 'Insufficient funds for registration' };
//     }
//     // Get the latest blockhash
//     const { blockhash } = await connection.getLatestBlockhash('finalized');
//     // Create the unsigned transaction for registering the user
//     const transaction = await program.methods
//       .registerForTournament() // No need to pass entryFee since it's fetched from the pool
//       .accounts({
//         user: adminPublicKey,
//         tournamentPool: tournamentPoolPublicKey,
//         userTokenAccount: userTokenAccountPublicKey,
//         poolEscrowAccount: poolEscrowAccountPublicKey, // Ensure escrow account is passed here
//         mint: mintPublicKey,
//         tokenProgram: TOKEN_2022_PROGRAM_ID,
//         systemProgram: SystemProgram.programId,
//       })
//       .transaction(); // Create the transaction, don't sign it
//     transaction.recentBlockhash = blockhash;
//     transaction.feePayer = adminPublicKey;
//     // Sign the transaction with the user's keypair
//     await transaction.sign(adminKeypair); // Sign the transaction with the user keypair
//     // Send the transaction to the Solana network and get the signature
//     const transactionSignature = await connection.sendTransaction(transaction, [adminKeypair], {
//       skipPreflight: false,
//       preflightCommitment: 'processed',
//     });
//     // Confirm the transaction
//     const confirmation = await connection.confirmTransaction(transactionSignature, 'confirmed');
//     return {
//       success: true,
//       message: 'Transaction created, signed, and sent successfully!',
//       transactionSignature,
//     };
//   } catch (err) {
//     console.error('❌ Error registering for tournament:', err);
//     return { success: false, message: 'Error registering for tournament' };
//   }
// };
//# sourceMappingURL=services.js.map