import { Request, Response } from "express";
import { PublicKey } from "@solana/web3.js";
import {
    getDeveloperOnboardingConfig,
    buildUpdateDeveloperOnboardingFeeTransaction,
    buildPayDeveloperOnboardingFeeTransaction,
    checkDeveloperOnboardingStatus,
    getAllOnboardedDevelopers,
    buildFlushDeveloperTransaction,
    confirmFlushDeveloper,
    getFlushDeveloperInfo,
} from "./onboardingService";

// ==============================
// GET CONFIG (Public)
// ==============================

/**
 * GET /api/onboarding/config
 * 
 * Fetches the current developer onboarding fee configuration.
 * This is a public endpoint - no authentication required.
 * 
 * Response:
 * {
 *   success: boolean,
 *   config: {
 *     developerOnboardingFee: number,  // in lamports
 *     onboardingFeeEnabled: boolean,
 *     platformWallet: string
 *   }
 * }
 */
export const getDeveloperOnboardingConfigController = async (
    req: Request, 
    res: Response
) => {
    try {
        console.log("📋 GET /api/onboarding/config");

        const result = await getDeveloperOnboardingConfig();

        if (result.success) {
            return res.status(200).json({
                success: true,
                config: result.config,
            });
        }

        return res.status(500).json({
            success: false,
            message: result.message,
        });
    } catch (error: any) {
        console.error("❌ Error in getDeveloperOnboardingConfigController:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message,
        });
    }
};

// ==============================
// UPDATE FEE (Admin Only)
// ==============================

/**
 * POST /api/onboarding/admin/update-fee
 * 
 * Builds a transaction to update the developer onboarding fee.
 * Only the super_admin can sign this transaction.
 * 
 * Request Body:
 * {
 *   adminPublicKey: string,
 *   developerOnboardingFee: number,  // in lamports
 *   onboardingFeeEnabled: boolean
 * }
 * 
 * Response:
 * {
 *   success: boolean,
 *   transaction: string  // base64 encoded transaction
 * }
 */
export const updateDeveloperOnboardingFeeController = async (
    req: Request, 
    res: Response
) => {
    try {
        const { 
            adminPublicKey, 
            developerOnboardingFee, 
            onboardingFeeEnabled 
        } = req.body;

        console.log("🔧 POST /api/onboarding/admin/update-fee");
        console.log("   Admin:", adminPublicKey);
        console.log("   Fee:", developerOnboardingFee, "lamports");
        console.log("   Enabled:", onboardingFeeEnabled);

        // Validation
        if (!adminPublicKey) {
            return res.status(400).json({
                success: false,
                message: "Admin public key is required",
            });
        }

        // Validate public key format
        try {
            new PublicKey(adminPublicKey);
        } catch {
            return res.status(400).json({
                success: false,
                message: "Invalid admin public key format",
            });
        }

        // Validate fee amount
        if (developerOnboardingFee !== undefined && developerOnboardingFee < 0) {
            return res.status(400).json({
                success: false,
                message: "Onboarding fee cannot be negative",
            });
        }

        const result = await buildUpdateDeveloperOnboardingFeeTransaction(
            new PublicKey(adminPublicKey),
            developerOnboardingFee ?? 0,
            onboardingFeeEnabled ?? true
        );

        if (result.success) {
            return res.status(200).json({
                success: true,
                transaction: result.transaction,
                platformConfigPda: result.platformConfigPda,
            });
        }

        return res.status(500).json({
            success: false,
            message: result.message,
        });
    } catch (error: any) {
        console.error("❌ Error in updateDeveloperOnboardingFeeController:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message,
        });
    }
};

// ==============================
// PAY FEE (Developer)
// ==============================

/**
 * POST /api/onboarding/pay-fee
 * 
 * Builds a transaction for a developer to pay the onboarding fee.
 * The developer must sign this transaction.
 * 
 * Request Body:
 * {
 *   developerPublicKey: string
 * }
 * 
 * Response:
 * {
 *   success: boolean,
 *   transaction: string,      // base64 encoded transaction
 *   feeAmount: number,        // in lamports
 *   feeEnabled: boolean,
 *   onboardingRecordPda: string
 * }
 */
export const payDeveloperOnboardingFeeController = async (
    req: Request, 
    res: Response
) => {
    try {
        const { developerPublicKey } = req.body;

        console.log("💰 POST /api/onboarding/pay-fee");
        console.log("   Developer:", developerPublicKey);

        // Validation
        if (!developerPublicKey) {
            return res.status(400).json({
                success: false,
                message: "Developer public key is required",
            });
        }

        // Validate public key format
        try {
            new PublicKey(developerPublicKey);
        } catch {
            return res.status(400).json({
                success: false,
                message: "Invalid developer public key format",
            });
        }

        const result = await buildPayDeveloperOnboardingFeeTransaction(
            new PublicKey(developerPublicKey)
        );

        if (result.success) {
            return res.status(200).json({
                success: true,
                transaction: result.transaction,
                feeAmount: result.feeAmount,
                feeEnabled: result.feeEnabled,
                onboardingRecordPda: result.onboardingRecordPda,
            });
        }

        // Check for "already onboarded" error
        if (result.message?.includes("already")) {
            return res.status(409).json({
                success: false,
                message: result.message,
                code: "ALREADY_ONBOARDED",
            });
        }

        return res.status(500).json({
            success: false,
            message: result.message,
        });
    } catch (error: any) {
        console.error("❌ Error in payDeveloperOnboardingFeeController:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message,
        });
    }
};

// ==============================
// CHECK STATUS
// ==============================

/**
 * GET /api/onboarding/status/:developerPublicKey
 * 
 * Checks if a developer has completed on-chain onboarding.
 * 
 * Response:
 * {
 *   success: boolean,
 *   isOnboarded: boolean,
 *   feePaid?: number,       // in lamports (if onboarded)
 *   timestamp?: number,     // unix timestamp (if onboarded)
 *   onboardingRecordPda: string
 * }
 */
export const checkDeveloperOnboardingStatusController = async (
    req: Request, 
    res: Response
) => {
    try {
        const { developerPublicKey } = req.params;

        console.log("🔍 GET /api/onboarding/status/:developerPublicKey");
        console.log("   Developer:", developerPublicKey);

        // Validation
        if (!developerPublicKey) {
            return res.status(400).json({
                success: false,
                message: "Developer public key is required",
            });
        }

        // Validate public key format
        try {
            new PublicKey(developerPublicKey);
        } catch {
            return res.status(400).json({
                success: false,
                message: "Invalid developer public key format",
            });
        }

        const result = await checkDeveloperOnboardingStatus(
            new PublicKey(developerPublicKey)
        );

        if (result.success && result.status) {
            return res.status(200).json({
                success: true,
                isOnboarded: result.status.isOnboarded,
                feePaid: result.status.feePaid,
                timestamp: result.status.timestamp,
                onboardingRecordPda: result.onboardingRecordPda,
            });
        }

        return res.status(500).json({
            success: false,
            message: result.message,
        });
    } catch (error: any) {
        console.error("❌ Error in checkDeveloperOnboardingStatusController:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message,
        });
    }
};

// ==============================
// GET ALL ONBOARDED DEVELOPERS (Admin)
// ==============================

/**
 * GET /api/onboarding/admin/developers
 * 
 * Fetches all developers who have completed on-chain onboarding.
 * Useful for admin dashboard analytics.
 * 
 * Response:
 * {
 *   success: boolean,
 *   developers: Array<{
 *     developer: string,
 *     feePaid: number,
 *     timestamp: number
 *   }>,
 *   totalCount: number,
 *   totalFeesCollected: number
 * }
 */
export const getAllOnboardedDevelopersController = async (
    req: Request, 
    res: Response
) => {
    try {
        console.log("📊 GET /api/onboarding/admin/developers");

        const result = await getAllOnboardedDevelopers();

        if (result.success && result.developers) {
            // Calculate total fees collected
            const totalFeesCollected = result.developers.reduce(
                (sum, dev) => sum + dev.feePaid, 
                0
            );

            return res.status(200).json({
                success: true,
                developers: result.developers,
                totalCount: result.developers.length,
                totalFeesCollected,
            });
        }

        return res.status(500).json({
            success: false,
            message: result.message,
        });
    } catch (error: any) {
        console.error("❌ Error in getAllOnboardedDevelopersController:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message,
        });
    }
};

// ==============================
// FLUSH DEVELOPER - BUILD TRANSACTION
// ==============================

/**
 * POST /api/onboarding/admin/flush-developer/build
 * 
 * Step 1: Builds the Solana transaction and returns developer info
 * for the complete flush operation
 */
export const buildFlushDeveloperController = async (
    req: Request,
    res: Response
) => {
    try {
        const { adminPublicKey, developerPublicKey } = req.body;

        console.log("🗑️ POST /api/onboarding/admin/flush-developer/build");
        console.log("   Admin:", adminPublicKey);
        console.log("   Developer:", developerPublicKey);

        // Validation
        if (!adminPublicKey || !developerPublicKey) {
            return res.status(400).json({
                success: false,
                message: "Admin and developer public keys are required",
            });
        }

        // Validate public key formats
        try {
            new PublicKey(adminPublicKey);
            new PublicKey(developerPublicKey);
        } catch {
            return res.status(400).json({
                success: false,
                message: "Invalid public key format",
            });
        }

        const result = await buildFlushDeveloperTransaction(
            new PublicKey(adminPublicKey),
            new PublicKey(developerPublicKey)
        );

        if (result.success) {
            return res.status(200).json({
                success: true,
                transaction: result.transaction,
                onboardingRecordPda: result.onboardingRecordPda,
                developerInfo: result.developerInfo,
            });
        }

        if (result.message?.includes("not found")) {
            return res.status(404).json({
                success: false,
                message: result.message,
                code: "RECORD_NOT_FOUND",
            });
        }

        return res.status(500).json({
            success: false,
            message: result.message,
        });
    } catch (error: any) {
        console.error("❌ Error in buildFlushDeveloperController:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message,
        });
    }
};

// ==============================
// FLUSH DEVELOPER - CONFIRM & CLEANUP
// ==============================

/**
 * POST /api/onboarding/admin/flush-developer/confirm
 * 
 * Step 2: After Solana tx is confirmed, clean up Firebase and Clerk
 */
export const confirmFlushDeveloperController = async (
    req: Request,
    res: Response
) => {
    try {
        const { 
            developerPublicKey, 
            clerkUserId, 
            firebaseKey,
            solanaSignature  // For logging/verification
        } = req.body;

        console.log("✅ POST /api/onboarding/admin/flush-developer/confirm");
        console.log("   Developer:", developerPublicKey);
        console.log("   Solana Signature:", solanaSignature);
        console.log("   Clerk User ID:", clerkUserId);
        console.log("   Firebase Key:", firebaseKey);

        // Validation
        if (!developerPublicKey) {
            return res.status(400).json({
                success: false,
                message: "Developer public key is required",
            });
        }

        const result = await confirmFlushDeveloper(
            developerPublicKey,
            clerkUserId,
            firebaseKey
        );

        return res.status(result.success ? 200 : 207).json(result);
    } catch (error: any) {
        console.error("❌ Error in confirmFlushDeveloperController:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message,
        });
    }
};

// ==============================
// GET FLUSH INFO (Optional helper)
// ==============================

/**
 * GET /api/onboarding/admin/flush-developer/info/:developerPublicKey
 * 
 * Gets information about what will be flushed for a developer
 */
export const getFlushDeveloperInfoController = async (
    req: Request,
    res: Response
) => {
    try {
        const { developerPublicKey } = req.params;

        console.log("ℹ️ GET /api/onboarding/admin/flush-developer/info");
        console.log("   Developer:", developerPublicKey);

        if (!developerPublicKey) {
            return res.status(400).json({
                success: false,
                message: "Developer public key is required",
            });
        }

        const result = await getFlushDeveloperInfo(developerPublicKey);

        return res.status(200).json(result);
    } catch (error: any) {
        console.error("❌ Error in getFlushDeveloperInfoController:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message,
        });
    }
};

