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
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFlushDeveloperInfo = exports.deleteUnpaidDeveloper = exports.confirmFlushDeveloper = exports.buildFlushDeveloperTransaction = exports.getAllOnboardedDevelopers = exports.checkDeveloperOnboardingStatus = exports.buildPayDeveloperOnboardingFeeTransaction = exports.buildUpdateDeveloperOnboardingFeeTransaction = exports.getDeveloperOnboardingConfig = void 0;
const web3_js_1 = require("@solana/web3.js");
const anchor = __importStar(require("@project-serum/anchor"));
const services_1 = require("../staking/services");
const getPDAs_1 = require("../utils/getPDAs");
const backend_1 = require("@clerk/backend");
const firebase_1 = require("../config/firebase");
const database_1 = require("firebase/database");
// ==============================
// GET ONBOARDING CONFIG
// ==============================
/**
 * Fetches the current developer onboarding configuration from PlatformConfig
 * This is a public endpoint - no authentication required
 */
const getDeveloperOnboardingConfig = () => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    try {
        const { program } = (0, services_1.getProgram)();
        // Derive PlatformConfig PDA
        const platformConfigPda = (0, getPDAs_1.getPlatformConfigPDA)();
        console.log("📋 Fetching platform config from:", platformConfigPda.toBase58());
        // Fetch the account
        const platformConfig = yield program.account.platformConfig.fetch(platformConfigPda);
        return {
            success: true,
            config: {
                developerOnboardingFee: Number(platformConfig.developerOnboardingFee),
                onboardingFeeEnabled: platformConfig.onboardingFeeEnabled,
                platformWallet: platformConfig.platformWallet.toString(),
            },
        };
    }
    catch (error) {
        console.error("❌ Error fetching onboarding config:", error);
        // Check if it's an account not found error
        if (((_a = error.message) === null || _a === void 0 ? void 0 : _a.includes("Account does not exist")) ||
            ((_b = error.message) === null || _b === void 0 ? void 0 : _b.includes("not found"))) {
            return {
                success: false,
                message: "Platform config not initialized. Please initialize platform config first.",
            };
        }
        return {
            success: false,
            message: error.message || "Failed to fetch onboarding config",
        };
    }
});
exports.getDeveloperOnboardingConfig = getDeveloperOnboardingConfig;
// ==============================
// UPDATE ONBOARDING FEE (ADMIN)
// ==============================
/**
 * Builds a transaction to update the developer onboarding fee
 * Only callable by super_admin
 *
 * @param adminPublicKey - The super admin's public key
 * @param developerOnboardingFee - Fee amount in lamports
 * @param onboardingFeeEnabled - Whether to enable/disable fees
 */
const buildUpdateDeveloperOnboardingFeeTransaction = (adminPublicKey, developerOnboardingFee, onboardingFeeEnabled) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { program, connection } = (0, services_1.getProgram)();
        // Derive PlatformConfig PDA
        const platformConfigPda = (0, getPDAs_1.getPlatformConfigPDA)();
        console.log("🔧 Building update onboarding fee transaction...");
        console.log("   Admin:", adminPublicKey.toBase58());
        console.log("   Platform Config PDA:", platformConfigPda.toBase58());
        console.log("   Fee:", developerOnboardingFee, "lamports");
        console.log("   Enabled:", onboardingFeeEnabled);
        // Get latest blockhash
        const { blockhash } = yield connection.getLatestBlockhash("finalized");
        // Build the transaction
        const transaction = yield program.methods
            .updateDeveloperOnboardingFee(new anchor.BN(developerOnboardingFee), onboardingFeeEnabled)
            .accounts({
            platformConfig: platformConfigPda,
            superAdmin: adminPublicKey,
        })
            .transaction();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = adminPublicKey;
        // Serialize for frontend signing
        const serializedTx = transaction.serialize({
            requireAllSignatures: false
        }).toString("base64");
        return {
            success: true,
            transaction: serializedTx,
            platformConfigPda: platformConfigPda.toBase58(),
        };
    }
    catch (error) {
        console.error("❌ Error building update onboarding fee transaction:", error);
        return {
            success: false,
            message: error.message || "Failed to build transaction",
        };
    }
});
exports.buildUpdateDeveloperOnboardingFeeTransaction = buildUpdateDeveloperOnboardingFeeTransaction;
// ==============================
// PAY ONBOARDING FEE (DEVELOPER)
// ==============================
/**
 * Builds a transaction for a developer to pay the onboarding fee
 * Creates a DeveloperOnboardingRecord PDA to track payment
 *
 * @param developerPublicKey - The developer's wallet public key
 */
const buildPayDeveloperOnboardingFeeTransaction = (developerPublicKey) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c;
    try {
        const { program, connection } = (0, services_1.getProgram)();
        // Derive PlatformConfig PDA
        const platformConfigPda = (0, getPDAs_1.getPlatformConfigPDA)();
        // Fetch platform config to get fee details
        const platformConfig = yield program.account.platformConfig.fetch(platformConfigPda);
        const feeAmount = platformConfig.developerOnboardingFee;
        const feeEnabled = platformConfig.onboardingFeeEnabled;
        const platformWallet = platformConfig.platformWallet;
        console.log("💰 Building pay onboarding fee transaction...");
        console.log("   Developer:", developerPublicKey.toBase58());
        console.log("   Fee Amount:", feeAmount, "lamports");
        console.log("   Fee Enabled:", feeEnabled);
        console.log("   Platform Wallet:", platformWallet);
        // Derive DeveloperOnboardingRecord PDA
        const onboardingRecordPda = (0, getPDAs_1.getDeveloperOnboardingRecordPDA)(developerPublicKey);
        console.log("   Onboarding Record PDA:", onboardingRecordPda.toBase58());
        // Get latest blockhash
        const { blockhash } = yield connection.getLatestBlockhash("finalized");
        // Build the transaction
        const transaction = yield program.methods
            .payDeveloperOnboardingFee()
            .accounts({
            developer: developerPublicKey,
            platformConfig: platformConfigPda,
            platformWallet: platformWallet,
            onboardingRecord: onboardingRecordPda,
            systemProgram: web3_js_1.SystemProgram.programId,
        })
            .transaction();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = developerPublicKey;
        // Serialize for frontend signing
        const serializedTx = transaction.serialize({
            requireAllSignatures: false
        }).toString("base64");
        return {
            success: true,
            transaction: serializedTx,
            feeAmount,
            feeEnabled,
            onboardingRecordPda: onboardingRecordPda.toBase58(),
        };
    }
    catch (error) {
        console.error("❌ Error building pay onboarding fee transaction:", error);
        // Check for specific errors
        if (((_a = error.message) === null || _a === void 0 ? void 0 : _a.includes("already in use")) ||
            ((_b = error.message) === null || _b === void 0 ? void 0 : _b.includes("0x0")) ||
            ((_c = error.message) === null || _c === void 0 ? void 0 : _c.includes("already exists"))) {
            return {
                success: false,
                message: "Developer has already completed onboarding",
            };
        }
        return {
            success: false,
            message: error.message || "Failed to build transaction",
        };
    }
});
exports.buildPayDeveloperOnboardingFeeTransaction = buildPayDeveloperOnboardingFeeTransaction;
// ==============================
// CHECK ONBOARDING STATUS
// ==============================
/**
 * Checks if a developer has already completed on-chain onboarding
 * by checking if their DeveloperOnboardingRecord PDA exists
 *
 * @param developerPublicKey - The developer's wallet public key
 */
const checkDeveloperOnboardingStatus = (developerPublicKey) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    try {
        const { program } = (0, services_1.getProgram)();
        // Derive DeveloperOnboardingRecord PDA
        const onboardingRecordPda = (0, getPDAs_1.getDeveloperOnboardingRecordPDA)(developerPublicKey);
        console.log("🔍 Checking onboarding status...");
        console.log("   Developer:", developerPublicKey.toBase58());
        console.log("   Record PDA:", onboardingRecordPda.toBase58());
        try {
            // Try to fetch the record
            const record = yield program.account.developerOnboardingRecord.fetch(onboardingRecordPda);
            // Record exists - developer has onboarded
            return {
                success: true,
                status: {
                    isOnboarded: true,
                    feePaid: Number(record.feePaid),
                    timestamp: Number(record.timestamp),
                },
                onboardingRecordPda: onboardingRecordPda.toBase58(),
            };
        }
        catch (fetchError) {
            // Account doesn't exist - developer hasn't onboarded on-chain
            if (((_a = fetchError.message) === null || _a === void 0 ? void 0 : _a.includes("Account does not exist")) ||
                ((_b = fetchError.message) === null || _b === void 0 ? void 0 : _b.includes("not found"))) {
                return {
                    success: true,
                    status: {
                        isOnboarded: false,
                    },
                    onboardingRecordPda: onboardingRecordPda.toBase58(),
                };
            }
            // Some other error
            throw fetchError;
        }
    }
    catch (error) {
        console.error("❌ Error checking onboarding status:", error);
        return {
            success: false,
            message: error.message || "Failed to check onboarding status",
        };
    }
});
exports.checkDeveloperOnboardingStatus = checkDeveloperOnboardingStatus;
// ==============================
// HELPER: GET ALL ONBOARDED DEVELOPERS (Optional)
// ==============================
/**
 * Gets all developer onboarding records from both Firebase and Solana
 * Merges data to show both paid and unpaid developers
 * Useful for admin dashboard analytics
 */
const getAllOnboardedDevelopers = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { program } = (0, services_1.getProgram)();
        // 1. Fetch all on-chain DeveloperOnboardingRecord accounts (developers who paid)
        const records = yield program.account.developerOnboardingRecord.all();
        const onChainDevelopers = new Map();
        records.forEach((record) => {
            const account = record.account;
            const publicKey = account.developer.toString();
            onChainDevelopers.set(publicKey, {
                developer: publicKey,
                feePaid: account.feePaid.toNumber(),
                timestamp: account.timestamp.toNumber(),
                hasPaid: true,
            });
        });
        console.log(`📊 Found ${onChainDevelopers.size} on-chain developers`);
        // 2. Fetch all developers from Firebase (includes both paid and unpaid)
        const usersRef = (0, database_1.ref)(firebase_1.db, "users");
        const snapshot = yield (0, database_1.get)(usersRef);
        const allDevelopers = new Map();
        if (snapshot.exists()) {
            const users = snapshot.val();
            // Filter for developers only and merge with on-chain data
            for (const key in users) {
                const user = users[key];
                // Only include users with developer role and who are marked as onboarded
                if (user.role === "developer" && user.onboarded && user.publicKey) {
                    const publicKey = user.publicKey;
                    // Check if this developer has on-chain record
                    const onChainData = onChainDevelopers.get(publicKey);
                    if (onChainData) {
                        // Merge on-chain data with Firebase data
                        allDevelopers.set(publicKey, Object.assign(Object.assign({}, onChainData), { email: user.email, fullName: user.fullName, clerkUserId: user.id, professionalDetails: user.professionalDetails }));
                    }
                    else {
                        // Developer in Firebase but not on-chain (hasn't paid)
                        allDevelopers.set(publicKey, {
                            developer: publicKey,
                            feePaid: 0,
                            timestamp: new Date(user.createdAt).getTime() / 1000, // Convert to Unix timestamp
                            hasPaid: false,
                            email: user.email,
                            fullName: user.fullName,
                            clerkUserId: user.id,
                            professionalDetails: user.professionalDetails,
                        });
                    }
                }
            }
            console.log(`📊 Found ${allDevelopers.size} total developers (Firebase + On-chain)`);
        }
        // Convert map to array
        const developers = Array.from(allDevelopers.values());
        return {
            success: true,
            developers,
        };
    }
    catch (error) {
        console.error("❌ Error fetching onboarded developers:", error);
        return {
            success: false,
            message: error.message || "Failed to fetch developers",
        };
    }
});
exports.getAllOnboardedDevelopers = getAllOnboardedDevelopers;
// ==============================
// COMPLETE FLUSH DEVELOPER RECORD
// ==============================
/**
 * Step 1: Build the Solana transaction and gather developer info
 * from Firebase and Clerk
 */
const buildFlushDeveloperTransaction = (adminPublicKey, developerPublicKey) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { program, connection } = (0, services_1.getProgram)();
        // Derive PDAs
        const platformConfigPda = (0, getPDAs_1.getPlatformConfigPDA)();
        const onboardingRecordPda = (0, getPDAs_1.getDeveloperOnboardingRecordPDA)(developerPublicKey);
        // 1. Check if on-chain record exists
        let onChainRecord;
        try {
            onChainRecord = yield program.account.developerOnboardingRecord.fetch(onboardingRecordPda);
        }
        catch (_a) {
            return {
                success: false,
                message: "Developer onboarding record not found on-chain",
            };
        }
        // 2. Find developer in Firebase by publicKey
        let firebaseKey;
        let clerkUserId;
        let developerEmail;
        try {
            const usersRef = (0, database_1.ref)(firebase_1.db, "users");
            const snapshot = yield (0, database_1.get)(usersRef);
            if (snapshot.exists()) {
                const data = snapshot.val();
                const targetPublicKey = developerPublicKey.toBase58();
                // Search through all users to find matching publicKey
                for (const key in data) {
                    if (data[key].publicKey === targetPublicKey) {
                        firebaseKey = key;
                        const developerData = data[key];
                        clerkUserId = developerData.id; // Clerk user ID stored in Firebase
                        developerEmail = developerData.email;
                        break;
                    }
                }
            }
        }
        catch (error) {
            console.warn("Could not find developer in Firebase:", error);
            // Continue anyway - Firebase record might not exist
        }
        // 3. If we have email but no clerkUserId, try to find by email using Clerk
        if (!clerkUserId && developerEmail) {
            try {
                if (!process.env.CLERK_SECRET_KEY) {
                    console.warn("CLERK_SECRET_KEY not found in environment variables");
                }
                else {
                    const clerkClient = (0, backend_1.createClerkClient)({
                        secretKey: process.env.CLERK_SECRET_KEY,
                    });
                    const users = yield clerkClient.users.getUserList({
                        emailAddress: [developerEmail],
                    });
                    if (users.data.length > 0) {
                        clerkUserId = users.data[0].id;
                    }
                }
            }
            catch (error) {
                console.warn("Could not find Clerk user:", error);
            }
        }
        // 4. Build Solana transaction
        console.log("🗑️ Building flush developer transaction...");
        console.log("   Admin:", adminPublicKey.toBase58());
        console.log("   Developer:", developerPublicKey.toBase58());
        console.log("   Record PDA:", onboardingRecordPda.toBase58());
        console.log("   Firebase Key:", firebaseKey || "not found");
        console.log("   Clerk User ID:", clerkUserId || "not found");
        const { blockhash } = yield connection.getLatestBlockhash("finalized");
        const transaction = yield program.methods
            .closeDeveloperOnboardingRecord()
            .accounts({
            superAdmin: adminPublicKey,
            platformConfig: platformConfigPda,
            developer: developerPublicKey,
            onboardingRecord: onboardingRecordPda,
            rentRecipient: adminPublicKey,
            systemProgram: web3_js_1.SystemProgram.programId,
        })
            .transaction();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = adminPublicKey;
        const serializedTx = transaction.serialize({
            requireAllSignatures: false,
        }).toString("base64");
        return {
            success: true,
            transaction: serializedTx,
            onboardingRecordPda: onboardingRecordPda.toBase58(),
            developerInfo: {
                clerkUserId,
                firebaseKey,
                email: developerEmail,
            },
        };
    }
    catch (error) {
        console.error("❌ Error building flush transaction:", error);
        return {
            success: false,
            message: error.message || "Failed to build transaction",
        };
    }
});
exports.buildFlushDeveloperTransaction = buildFlushDeveloperTransaction;
/**
 * Step 2: After Solana transaction is confirmed, clean up Firebase and Clerk
 */
const confirmFlushDeveloper = (developerPublicKey, clerkUserId, firebaseKey) => __awaiter(void 0, void 0, void 0, function* () {
    const details = {
        solana: { success: true }, // Already confirmed by frontend
        firebase: { success: false, error: undefined },
        clerk: { success: false, error: undefined },
    };
    // 1. Clean up Firebase
    if (firebaseKey) {
        try {
            const developerRef = (0, database_1.ref)(firebase_1.db, `users/${firebaseKey}`);
            yield (0, database_1.remove)(developerRef);
            details.firebase.success = true;
            console.log("✅ Firebase record removed:", firebaseKey);
        }
        catch (error) {
            details.firebase.error = error.message;
            console.error("❌ Failed to remove Firebase record:", error);
        }
    }
    else {
        // Try to find and remove by publicKey
        try {
            const usersRef = (0, database_1.ref)(firebase_1.db, "users");
            const snapshot = yield (0, database_1.get)(usersRef);
            if (snapshot.exists()) {
                const data = snapshot.val();
                let foundKey = null;
                // Search through all users to find matching publicKey
                for (const key in data) {
                    if (data[key].publicKey === developerPublicKey) {
                        foundKey = key;
                        break;
                    }
                }
                if (foundKey) {
                    yield (0, database_1.remove)((0, database_1.ref)(firebase_1.db, `users/${foundKey}`));
                    details.firebase.success = true;
                    console.log("✅ Firebase record found and removed:", foundKey);
                }
                else {
                    details.firebase.success = true; // No record to remove
                    console.log("ℹ️ No Firebase record found for developer");
                }
            }
            else {
                details.firebase.success = true; // No record to remove
                console.log("ℹ️ No Firebase record found for developer");
            }
        }
        catch (error) {
            details.firebase.error = error.message;
            console.error("❌ Failed to search/remove Firebase record:", error);
        }
    }
    // 2. Reset Clerk user metadata
    if (clerkUserId) {
        try {
            if (!process.env.CLERK_SECRET_KEY) {
                details.clerk.error = "CLERK_SECRET_KEY not found in environment variables. Please add it to your .env file and restart the server.";
                console.error("❌ CLERK_SECRET_KEY not found in environment variables");
            }
            else {
                const clerkClient = (0, backend_1.createClerkClient)({
                    secretKey: process.env.CLERK_SECRET_KEY,
                });
                yield clerkClient.users.updateUserMetadata(clerkUserId, {
                    publicMetadata: {
                        onboarded: false,
                        publicKey: null,
                        professionalDetails: null,
                        // Keep role as "developer" so they can re-onboard as developer
                    },
                });
                details.clerk.success = true;
                console.log("✅ Clerk metadata reset for user:", clerkUserId);
            }
        }
        catch (error) {
            details.clerk.error = error.message || "Failed to reset Clerk metadata";
            console.error("❌ Failed to reset Clerk metadata:", error);
        }
    }
    else {
        // Try to find user by searching Firebase for email, then lookup in Clerk
        try {
            const usersRef = (0, database_1.ref)(firebase_1.db, "users");
            const snapshot = yield (0, database_1.get)(usersRef);
            if (snapshot.exists()) {
                const data = snapshot.val();
                let userData = null;
                // Search through all users to find matching publicKey
                for (const key in data) {
                    if (data[key].publicKey === developerPublicKey) {
                        userData = data[key];
                        break;
                    }
                }
                if (userData) {
                    const foundClerkUserId = userData.id;
                    if (foundClerkUserId) {
                        if (!process.env.CLERK_SECRET_KEY) {
                            details.clerk.error = "CLERK_SECRET_KEY not found in environment variables. Please add it to your .env file and restart the server.";
                            console.error("❌ CLERK_SECRET_KEY not found in environment variables");
                        }
                        else {
                            const clerkClient = (0, backend_1.createClerkClient)({
                                secretKey: process.env.CLERK_SECRET_KEY,
                            });
                            yield clerkClient.users.updateUserMetadata(foundClerkUserId, {
                                publicMetadata: {
                                    onboarded: false,
                                    publicKey: null,
                                    professionalDetails: null,
                                },
                            });
                            details.clerk.success = true;
                            console.log("✅ Clerk metadata reset for user:", foundClerkUserId);
                        }
                    }
                    else {
                        details.clerk.success = true; // Can't update without ID
                        console.log("ℹ️ No Clerk user ID found, skipping Clerk cleanup");
                    }
                }
                else {
                    details.clerk.success = true; // No record to update
                    console.log("ℹ️ No Firebase record found, skipping Clerk cleanup");
                }
            }
            else {
                details.clerk.success = true; // No record to update
                console.log("ℹ️ No Firebase record found, skipping Clerk cleanup");
            }
        }
        catch (error) {
            details.clerk.error = error.message;
            console.error("❌ Failed to reset Clerk metadata:", error);
        }
    }
    // Determine overall success
    const allSuccess = details.firebase.success && details.clerk.success;
    return {
        success: allSuccess,
        message: allSuccess
            ? "Developer record flushed from all systems"
            : "Partial success - some systems may need manual cleanup",
        details,
    };
});
exports.confirmFlushDeveloper = confirmFlushDeveloper;
// ==============================
// DELETE UNPAID DEVELOPER (Firebase/Clerk only)
// ==============================
/**
 * Delete an unpaid developer who has no on-chain record
 * Only removes from Firebase and resets Clerk metadata
 * Used for developers who onboarded when fees were disabled
 */
const deleteUnpaidDeveloper = (developerPublicKey) => __awaiter(void 0, void 0, void 0, function* () {
    const details = {
        solana: { success: true }, // No Solana record to delete
        firebase: { success: false, error: undefined },
        clerk: { success: false, error: undefined },
    };
    try {
        // 1. Find developer in Firebase by publicKey
        let firebaseKey;
        let clerkUserId;
        const usersRef = (0, database_1.ref)(firebase_1.db, "users");
        const snapshot = yield (0, database_1.get)(usersRef);
        if (snapshot.exists()) {
            const data = snapshot.val();
            // Search for developer with matching publicKey
            for (const key in data) {
                if (data[key].publicKey === developerPublicKey) {
                    firebaseKey = key;
                    clerkUserId = data[key].id; // Clerk user ID
                    break;
                }
            }
        }
        if (!firebaseKey) {
            return {
                success: false,
                message: "Developer not found in Firebase",
                details,
            };
        }
        console.log("🗑️ Deleting unpaid developer...");
        console.log("   Developer:", developerPublicKey);
        console.log("   Firebase Key:", firebaseKey);
        console.log("   Clerk User ID:", clerkUserId || "not found");
        // 2. Delete from Firebase
        try {
            const developerRef = (0, database_1.ref)(firebase_1.db, `users/${firebaseKey}`);
            yield (0, database_1.remove)(developerRef);
            details.firebase.success = true;
            console.log("✅ Firebase record removed:", firebaseKey);
        }
        catch (error) {
            details.firebase.error = error.message;
            console.error("❌ Failed to remove Firebase record:", error);
        }
        // 3. Reset Clerk metadata
        if (clerkUserId) {
            try {
                if (!process.env.CLERK_SECRET_KEY) {
                    details.clerk.error = "CLERK_SECRET_KEY not found in environment variables";
                    console.error("❌ CLERK_SECRET_KEY not found");
                }
                else {
                    const clerkClient = (0, backend_1.createClerkClient)({
                        secretKey: process.env.CLERK_SECRET_KEY,
                    });
                    yield clerkClient.users.updateUserMetadata(clerkUserId, {
                        publicMetadata: {
                            onboarded: false,
                            publicKey: null,
                            professionalDetails: null,
                            // Keep role as "developer" so they can re-onboard
                        },
                    });
                    details.clerk.success = true;
                    console.log("✅ Clerk metadata reset for user:", clerkUserId);
                }
            }
            catch (error) {
                details.clerk.error = error.message || "Failed to reset Clerk metadata";
                console.error("❌ Failed to reset Clerk metadata:", error);
            }
        }
        else {
            details.clerk.success = true; // No Clerk ID found
            console.log("ℹ️ No Clerk user ID found, skipping Clerk cleanup");
        }
        const allSuccess = details.firebase.success && details.clerk.success;
        return {
            success: allSuccess,
            message: allSuccess
                ? "Unpaid developer removed from Firebase and Clerk"
                : "Partial success - some systems may need manual cleanup",
            details,
        };
    }
    catch (error) {
        console.error("❌ Error deleting unpaid developer:", error);
        return {
            success: false,
            message: error.message || "Failed to delete unpaid developer",
            details,
        };
    }
});
exports.deleteUnpaidDeveloper = deleteUnpaidDeveloper;
/**
 * Optional: Get information about what will be flushed for a developer
 */
const getFlushDeveloperInfo = (developerPublicKey) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { program } = (0, services_1.getProgram)();
        const devPubkey = new web3_js_1.PublicKey(developerPublicKey);
        // Check on-chain record
        const onboardingRecordPda = (0, getPDAs_1.getDeveloperOnboardingRecordPDA)(devPubkey);
        let hasOnChainRecord = false;
        try {
            yield program.account.developerOnboardingRecord.fetch(onboardingRecordPda);
            hasOnChainRecord = true;
        }
        catch (_a) {
            hasOnChainRecord = false;
        }
        // Find in Firebase
        let firebaseKey;
        let clerkUserId;
        let email;
        try {
            const usersRef = (0, database_1.ref)(firebase_1.db, "users");
            const snapshot = yield (0, database_1.get)(usersRef);
            if (snapshot.exists()) {
                const data = snapshot.val();
                // Search through all users to find matching publicKey
                for (const key in data) {
                    if (data[key].publicKey === developerPublicKey) {
                        firebaseKey = key;
                        const developerData = data[key];
                        clerkUserId = developerData.id;
                        email = developerData.email;
                        break;
                    }
                }
            }
        }
        catch (error) {
            console.warn("Firebase lookup failed:", error);
        }
        return {
            success: true,
            clerkUserId,
            firebaseKey,
            email,
            hasOnChainRecord,
        };
    }
    catch (error) {
        return {
            success: false,
            hasOnChainRecord: false,
            message: error.message,
        };
    }
});
exports.getFlushDeveloperInfo = getFlushDeveloperInfo;
//# sourceMappingURL=onboardingService.js.map