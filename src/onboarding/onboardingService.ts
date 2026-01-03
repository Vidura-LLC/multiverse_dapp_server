import { PublicKey, SystemProgram } from "@solana/web3.js";
import * as anchor from "@project-serum/anchor";
import { getProgram } from "../staking/services";
import { getPlatformConfigPDA, getDeveloperOnboardingRecordPDA, SEEDS } from "../utils/getPDAs";
import { DeveloperOnboardingRecordAccount, PlatformConfigAccount } from "../adminDashboard/services";
import { createClerkClient } from "@clerk/backend";
import { db } from "../config/firebase";
import { ref, get, remove } from "firebase/database";

// ==============================
// TYPES
// ==============================

export interface DeveloperOnboardingConfig {
    developerOnboardingFee: number;      // In lamports
    onboardingFeeEnabled: boolean;
    platformWallet: string;
}

export interface DeveloperOnboardingStatus {
    isOnboarded: boolean;
    feePaid?: number;
    timestamp?: number;
}

// ==============================
// GET ONBOARDING CONFIG
// ==============================

/**
 * Fetches the current developer onboarding configuration from PlatformConfig
 * This is a public endpoint - no authentication required
 */
export const getDeveloperOnboardingConfig = async (): Promise<{
    success: boolean;
    config?: DeveloperOnboardingConfig;
    message?: string;
}> => {
    try {
        const { program } = getProgram();

        // Derive PlatformConfig PDA
        const platformConfigPda = getPlatformConfigPDA();

        console.log("📋 Fetching platform config from:", platformConfigPda.toBase58());

        // Fetch the account
        const platformConfig = await program.account.platformConfig.fetch(platformConfigPda) as PlatformConfigAccount;

        return {
            success: true,
            config: {
                developerOnboardingFee: Number(platformConfig.developerOnboardingFee),
                onboardingFeeEnabled: platformConfig.onboardingFeeEnabled,
                platformWallet: platformConfig.platformWallet.toString(),
            },
        };
    } catch (error: any) {
        console.error("❌ Error fetching onboarding config:", error);
        
        // Check if it's an account not found error
        if (error.message?.includes("Account does not exist") || 
            error.message?.includes("not found")) {
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
};

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
export const buildUpdateDeveloperOnboardingFeeTransaction = async (
    adminPublicKey: PublicKey,
    developerOnboardingFee: number,
    onboardingFeeEnabled: boolean
): Promise<{
    success: boolean;
    transaction?: string;
    platformConfigPda?: string;
    message?: string;
}> => {
    try {
        const { program, connection } = getProgram();

        // Derive PlatformConfig PDA
        const platformConfigPda = getPlatformConfigPDA();

        console.log("🔧 Building update onboarding fee transaction...");
        console.log("   Admin:", adminPublicKey.toBase58());
        console.log("   Platform Config PDA:", platformConfigPda.toBase58());
        console.log("   Fee:", developerOnboardingFee, "lamports");
        console.log("   Enabled:", onboardingFeeEnabled);

        // Get latest blockhash
        const { blockhash } = await connection.getLatestBlockhash("finalized");

        // Build the transaction
        const transaction = await program.methods
            .updateDeveloperOnboardingFee(
                new anchor.BN(developerOnboardingFee),
                onboardingFeeEnabled
            )
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
    } catch (error: any) {
        console.error("❌ Error building update onboarding fee transaction:", error);
        return {
            success: false,
            message: error.message || "Failed to build transaction",
        };
    }
};

// ==============================
// PAY ONBOARDING FEE (DEVELOPER)
// ==============================

/**
 * Builds a transaction for a developer to pay the onboarding fee
 * Creates a DeveloperOnboardingRecord PDA to track payment
 * 
 * @param developerPublicKey - The developer's wallet public key
 */
export const buildPayDeveloperOnboardingFeeTransaction = async (
    developerPublicKey: PublicKey
): Promise<{
    success: boolean;
    transaction?: string;
    feeAmount?: number;
    feeEnabled?: boolean;
    onboardingRecordPda?: string;
    message?: string;
}> => {
    try {
        const { program, connection } = getProgram();

        // Derive PlatformConfig PDA
        const platformConfigPda = getPlatformConfigPDA();

        // Fetch platform config to get fee details
        const platformConfig = await program.account.platformConfig.fetch(platformConfigPda) as DeveloperOnboardingConfig;

        const feeAmount = platformConfig.developerOnboardingFee;
        const feeEnabled = platformConfig.onboardingFeeEnabled;
        const platformWallet = platformConfig.platformWallet;

        console.log("💰 Building pay onboarding fee transaction...");
        console.log("   Developer:", developerPublicKey.toBase58());
        console.log("   Fee Amount:", feeAmount, "lamports");
        console.log("   Fee Enabled:", feeEnabled);
        console.log("   Platform Wallet:", platformWallet);

        // Derive DeveloperOnboardingRecord PDA
        const onboardingRecordPda = getDeveloperOnboardingRecordPDA(developerPublicKey);

        console.log("   Onboarding Record PDA:", onboardingRecordPda.toBase58());

        // Get latest blockhash
        const { blockhash } = await connection.getLatestBlockhash("finalized");

        // Build the transaction
        const transaction = await program.methods
            .payDeveloperOnboardingFee()
            .accounts({
                developer: developerPublicKey,
                platformConfig: platformConfigPda,
                platformWallet: platformWallet,
                onboardingRecord: onboardingRecordPda,
                systemProgram: SystemProgram.programId,
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
    } catch (error: any) {
        console.error("❌ Error building pay onboarding fee transaction:", error);
        
        // Check for specific errors
        if (error.message?.includes("already in use") || 
            error.message?.includes("0x0") ||
            error.message?.includes("already exists")) {
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
};

// ==============================
// CHECK ONBOARDING STATUS
// ==============================

/**
 * Checks if a developer has already completed on-chain onboarding
 * by checking if their DeveloperOnboardingRecord PDA exists
 * 
 * @param developerPublicKey - The developer's wallet public key
 */
export const checkDeveloperOnboardingStatus = async (
    developerPublicKey: PublicKey
): Promise<{
    success: boolean;
    status?: DeveloperOnboardingStatus;
    onboardingRecordPda?: string;
    message?: string;
}> => {
    try {
        const { program } = getProgram();

        // Derive DeveloperOnboardingRecord PDA
        const onboardingRecordPda = getDeveloperOnboardingRecordPDA(developerPublicKey);

        console.log("🔍 Checking onboarding status...");
        console.log("   Developer:", developerPublicKey.toBase58());
        console.log("   Record PDA:", onboardingRecordPda.toBase58());

        try {
            // Try to fetch the record
            const record = await program.account.developerOnboardingRecord.fetch(
                onboardingRecordPda
            ) as DeveloperOnboardingStatus;

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
        } catch (fetchError: any) {
            // Account doesn't exist - developer hasn't onboarded on-chain
            if (fetchError.message?.includes("Account does not exist") ||
                fetchError.message?.includes("not found")) {
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
    } catch (error: any) {
        console.error("❌ Error checking onboarding status:", error);
        return {
            success: false,
            message: error.message || "Failed to check onboarding status",
        };
    }
};

// ==============================
// HELPER: GET ALL ONBOARDED DEVELOPERS (Optional)
// ==============================

/**
 * Gets all developer onboarding records
 * Useful for admin dashboard analytics
 */
export const getAllOnboardedDevelopers = async (): Promise<{
    success: boolean;
    developers?: Array<{
        developer: string;
        feePaid: number;
        timestamp: number;
    }>;
    message?: string;
}> => {
    try {
        const { program } = getProgram();

        // Fetch all DeveloperOnboardingRecord accounts
        const records = await program.account.developerOnboardingRecord.all();

        const developers = records.map((record) => {
            const account = record.account as DeveloperOnboardingRecordAccount;
            return {
                developer: account.developer.toString(),
                feePaid: account.feePaid.toNumber(),
                timestamp: account.timestamp.toNumber(),
            };
        });

        console.log(`📊 Found ${developers.length} onboarded developers`);

        return {
            success: true,
            developers,
        };
    } catch (error: any) {
        console.error("❌ Error fetching onboarded developers:", error);
        return {
            success: false,
            message: error.message || "Failed to fetch developers",
        };
    }
};

// ==============================
// TYPES FOR FLUSH OPERATION
// ==============================

export interface FlushDeveloperResult {
    success: boolean;
    message?: string;
    details?: {
        solana: { success: boolean; signature?: string; error?: string };
        firebase: { success: boolean; error?: string };
        clerk: { success: boolean; error?: string };
    };
}

export interface DeveloperFlushInfo {
    clerkUserId?: string;
    firebaseKey?: string;
    email?: string;
}

// ==============================
// COMPLETE FLUSH DEVELOPER RECORD
// ==============================

/**
 * Step 1: Build the Solana transaction and gather developer info
 * from Firebase and Clerk
 */
export const buildFlushDeveloperTransaction = async (
    adminPublicKey: PublicKey,
    developerPublicKey: PublicKey
): Promise<{
    success: boolean;
    transaction?: string;
    onboardingRecordPda?: string;
    developerInfo?: DeveloperFlushInfo;
    message?: string;
}> => {
    try {
        const { program, connection } = getProgram();

        // Derive PDAs
        const platformConfigPda = getPlatformConfigPDA();
        const onboardingRecordPda = getDeveloperOnboardingRecordPDA(developerPublicKey);

        // 1. Check if on-chain record exists
        let onChainRecord;
        try {
            onChainRecord = await program.account.developerOnboardingRecord.fetch(onboardingRecordPda);
        } catch {
            return {
                success: false,
                message: "Developer onboarding record not found on-chain",
            };
        }

        // 2. Find developer in Firebase by publicKey
        let firebaseKey: string | undefined;
        let clerkUserId: string | undefined;
        let developerEmail: string | undefined;

        try {
            const usersRef = ref(db, "users");
            const snapshot = await get(usersRef);

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
        } catch (error) {
            console.warn("Could not find developer in Firebase:", error);
            // Continue anyway - Firebase record might not exist
        }

        // 3. If we have email but no clerkUserId, try to find by email using Clerk
        if (!clerkUserId && developerEmail) {
            try {
                if (!process.env.CLERK_SECRET_KEY) {
                    console.warn("CLERK_SECRET_KEY not found in environment variables");
                } else {
                    const clerkClient = createClerkClient({
                        secretKey: process.env.CLERK_SECRET_KEY,
                    });
                    const users = await clerkClient.users.getUserList({
                        emailAddress: [developerEmail],
                    });
                    if (users.data.length > 0) {
                        clerkUserId = users.data[0].id;
                    }
                }
            } catch (error) {
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

        const { blockhash } = await connection.getLatestBlockhash("finalized");

        const transaction = await program.methods
            .closeDeveloperOnboardingRecord()
            .accounts({
                superAdmin: adminPublicKey,
                platformConfig: platformConfigPda,
                developer: developerPublicKey,
                onboardingRecord: onboardingRecordPda,
                rentRecipient: adminPublicKey,
                systemProgram: SystemProgram.programId,
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
    } catch (error: any) {
        console.error("❌ Error building flush transaction:", error);
        return {
            success: false,
            message: error.message || "Failed to build transaction",
        };
    }
};

/**
 * Step 2: After Solana transaction is confirmed, clean up Firebase and Clerk
 */
export const confirmFlushDeveloper = async (
    developerPublicKey: string,
    clerkUserId?: string,
    firebaseKey?: string
): Promise<FlushDeveloperResult> => {
    const details = {
        solana: { success: true }, // Already confirmed by frontend
        firebase: { success: false, error: undefined as string | undefined },
        clerk: { success: false, error: undefined as string | undefined },
    };

    // 1. Clean up Firebase
    if (firebaseKey) {
        try {
            const developerRef = ref(db, `users/${firebaseKey}`);
            await remove(developerRef);
            details.firebase.success = true;
            console.log("✅ Firebase record removed:", firebaseKey);
        } catch (error: any) {
            details.firebase.error = error.message;
            console.error("❌ Failed to remove Firebase record:", error);
        }
    } else {
        // Try to find and remove by publicKey
        try {
            const usersRef = ref(db, "users");
            const snapshot = await get(usersRef);

            if (snapshot.exists()) {
                const data = snapshot.val();
                let foundKey: string | null = null;
                
                // Search through all users to find matching publicKey
                for (const key in data) {
                    if (data[key].publicKey === developerPublicKey) {
                        foundKey = key;
                        break;
                    }
                }

                if (foundKey) {
                    await remove(ref(db, `users/${foundKey}`));
                    details.firebase.success = true;
                    console.log("✅ Firebase record found and removed:", foundKey);
                } else {
                    details.firebase.success = true; // No record to remove
                    console.log("ℹ️ No Firebase record found for developer");
                }
            } else {
                details.firebase.success = true; // No record to remove
                console.log("ℹ️ No Firebase record found for developer");
            }
        } catch (error: any) {
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
            } else {
                const clerkClient = createClerkClient({
                    secretKey: process.env.CLERK_SECRET_KEY,
                });
                await clerkClient.users.updateUserMetadata(clerkUserId, {
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
        } catch (error: any) {
            details.clerk.error = error.message || "Failed to reset Clerk metadata";
            console.error("❌ Failed to reset Clerk metadata:", error);
        }
    } else {
        // Try to find user by searching Firebase for email, then lookup in Clerk
        try {
            const usersRef = ref(db, "users");
            const snapshot = await get(usersRef);

            if (snapshot.exists()) {
                const data = snapshot.val();
                let userData: any = null;
                
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
                        } else {
                            const clerkClient = createClerkClient({
                                secretKey: process.env.CLERK_SECRET_KEY,
                            });
                            await clerkClient.users.updateUserMetadata(foundClerkUserId, {
                                publicMetadata: {
                                    onboarded: false,
                                    publicKey: null,
                                    professionalDetails: null,
                                },
                            });
                            details.clerk.success = true;
                            console.log("✅ Clerk metadata reset for user:", foundClerkUserId);
                        }
                    } else {
                        details.clerk.success = true; // Can't update without ID
                        console.log("ℹ️ No Clerk user ID found, skipping Clerk cleanup");
                    }
                } else {
                    details.clerk.success = true; // No record to update
                    console.log("ℹ️ No Firebase record found, skipping Clerk cleanup");
                }
            } else {
                details.clerk.success = true; // No record to update
                console.log("ℹ️ No Firebase record found, skipping Clerk cleanup");
            }
        } catch (error: any) {
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
};

/**
 * Optional: Get information about what will be flushed for a developer
 */
export const getFlushDeveloperInfo = async (
    developerPublicKey: string
): Promise<{
    success: boolean;
    clerkUserId?: string;
    firebaseKey?: string;
    email?: string;
    hasOnChainRecord: boolean;
    message?: string;
}> => {
    try {
        const { program } = getProgram();
        const devPubkey = new PublicKey(developerPublicKey);

        // Check on-chain record
        const onboardingRecordPda = getDeveloperOnboardingRecordPDA(devPubkey);

        let hasOnChainRecord = false;
        try {
            await program.account.developerOnboardingRecord.fetch(onboardingRecordPda);
            hasOnChainRecord = true;
        } catch {
            hasOnChainRecord = false;
        }

        // Find in Firebase
        let firebaseKey: string | undefined;
        let clerkUserId: string | undefined;
        let email: string | undefined;

        try {
            const usersRef = ref(db, "users");
            const snapshot = await get(usersRef);

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
        } catch (error) {
            console.warn("Firebase lookup failed:", error);
        }

        return {
            success: true,
            clerkUserId,
            firebaseKey,
            email,
            hasOnChainRecord,
        };
    } catch (error: any) {
        return {
            success: false,
            hasOnChainRecord: false,
            message: error.message,
        };
    }
};

