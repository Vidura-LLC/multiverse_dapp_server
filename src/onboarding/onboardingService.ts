import { PublicKey, SystemProgram } from "@solana/web3.js";
import * as anchor from "@project-serum/anchor";
import { getProgram } from "../staking/services";
import { getPlatformConfigPDA, getDeveloperOnboardingRecordPDA, SEEDS } from "../utils/getPDAs";
import { DeveloperOnboardingRecordAccount, PlatformConfigAccount } from "../adminDashboard/services";

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

