import { Request, Response } from "express";
import { PublicKey } from "@solana/web3.js";
import {
    getDeveloperOnboardingConfig,
    buildUpdateDeveloperOnboardingFeeTransaction,
    buildPayDeveloperOnboardingFeeTransaction,
    checkDeveloperOnboardingStatus,
    getAllOnboardedDevelopers,
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

