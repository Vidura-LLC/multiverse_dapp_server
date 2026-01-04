"use strict";
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
exports.getFlushDeveloperInfoController = exports.deleteUnpaidDeveloperController = exports.confirmFlushDeveloperController = exports.buildFlushDeveloperController = exports.getAllOnboardedDevelopersController = exports.checkDeveloperOnboardingStatusController = exports.payDeveloperOnboardingFeeController = exports.updateDeveloperOnboardingFeeController = exports.getDeveloperOnboardingConfigController = void 0;
const web3_js_1 = require("@solana/web3.js");
const onboardingService_1 = require("./onboardingService");
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
const getDeveloperOnboardingConfigController = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        console.log("📋 GET /api/onboarding/config");
        const result = yield (0, onboardingService_1.getDeveloperOnboardingConfig)();
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
    }
    catch (error) {
        console.error("❌ Error in getDeveloperOnboardingConfigController:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message,
        });
    }
});
exports.getDeveloperOnboardingConfigController = getDeveloperOnboardingConfigController;
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
const updateDeveloperOnboardingFeeController = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { adminPublicKey, developerOnboardingFee, onboardingFeeEnabled } = req.body;
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
            new web3_js_1.PublicKey(adminPublicKey);
        }
        catch (_a) {
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
        const result = yield (0, onboardingService_1.buildUpdateDeveloperOnboardingFeeTransaction)(new web3_js_1.PublicKey(adminPublicKey), developerOnboardingFee !== null && developerOnboardingFee !== void 0 ? developerOnboardingFee : 0, onboardingFeeEnabled !== null && onboardingFeeEnabled !== void 0 ? onboardingFeeEnabled : true);
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
    }
    catch (error) {
        console.error("❌ Error in updateDeveloperOnboardingFeeController:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message,
        });
    }
});
exports.updateDeveloperOnboardingFeeController = updateDeveloperOnboardingFeeController;
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
const payDeveloperOnboardingFeeController = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
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
            new web3_js_1.PublicKey(developerPublicKey);
        }
        catch (_b) {
            return res.status(400).json({
                success: false,
                message: "Invalid developer public key format",
            });
        }
        const result = yield (0, onboardingService_1.buildPayDeveloperOnboardingFeeTransaction)(new web3_js_1.PublicKey(developerPublicKey));
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
        if ((_a = result.message) === null || _a === void 0 ? void 0 : _a.includes("already")) {
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
    }
    catch (error) {
        console.error("❌ Error in payDeveloperOnboardingFeeController:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message,
        });
    }
});
exports.payDeveloperOnboardingFeeController = payDeveloperOnboardingFeeController;
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
const checkDeveloperOnboardingStatusController = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
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
            new web3_js_1.PublicKey(developerPublicKey);
        }
        catch (_a) {
            return res.status(400).json({
                success: false,
                message: "Invalid developer public key format",
            });
        }
        const result = yield (0, onboardingService_1.checkDeveloperOnboardingStatus)(new web3_js_1.PublicKey(developerPublicKey));
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
    }
    catch (error) {
        console.error("❌ Error in checkDeveloperOnboardingStatusController:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message,
        });
    }
});
exports.checkDeveloperOnboardingStatusController = checkDeveloperOnboardingStatusController;
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
const getAllOnboardedDevelopersController = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        console.log("📊 GET /api/onboarding/admin/developers");
        const result = yield (0, onboardingService_1.getAllOnboardedDevelopers)();
        if (result.success && result.developers) {
            // Calculate statistics
            const totalFeesCollected = result.developers.reduce((sum, dev) => sum + dev.feePaid, 0);
            const paidDevelopers = result.developers.filter(dev => dev.hasPaid);
            const unpaidDevelopers = result.developers.filter(dev => !dev.hasPaid);
            return res.status(200).json({
                success: true,
                developers: result.developers,
                totalCount: result.developers.length,
                paidCount: paidDevelopers.length,
                unpaidCount: unpaidDevelopers.length,
                totalFeesCollected,
            });
        }
        return res.status(500).json({
            success: false,
            message: result.message,
        });
    }
    catch (error) {
        console.error("❌ Error in getAllOnboardedDevelopersController:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message,
        });
    }
});
exports.getAllOnboardedDevelopersController = getAllOnboardedDevelopersController;
// ==============================
// FLUSH DEVELOPER - BUILD TRANSACTION
// ==============================
/**
 * POST /api/onboarding/admin/flush-developer/build
 *
 * Step 1: Builds the Solana transaction and returns developer info
 * for the complete flush operation
 */
const buildFlushDeveloperController = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
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
            new web3_js_1.PublicKey(adminPublicKey);
            new web3_js_1.PublicKey(developerPublicKey);
        }
        catch (_b) {
            return res.status(400).json({
                success: false,
                message: "Invalid public key format",
            });
        }
        const result = yield (0, onboardingService_1.buildFlushDeveloperTransaction)(new web3_js_1.PublicKey(adminPublicKey), new web3_js_1.PublicKey(developerPublicKey));
        if (result.success) {
            return res.status(200).json({
                success: true,
                transaction: result.transaction,
                onboardingRecordPda: result.onboardingRecordPda,
                developerInfo: result.developerInfo,
            });
        }
        if ((_a = result.message) === null || _a === void 0 ? void 0 : _a.includes("not found")) {
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
    }
    catch (error) {
        console.error("❌ Error in buildFlushDeveloperController:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message,
        });
    }
});
exports.buildFlushDeveloperController = buildFlushDeveloperController;
// ==============================
// FLUSH DEVELOPER - CONFIRM & CLEANUP
// ==============================
/**
 * POST /api/onboarding/admin/flush-developer/confirm
 *
 * Step 2: After Solana tx is confirmed, clean up Firebase and Clerk
 */
const confirmFlushDeveloperController = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { developerPublicKey, clerkUserId, firebaseKey, solanaSignature // For logging/verification
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
        const result = yield (0, onboardingService_1.confirmFlushDeveloper)(developerPublicKey, clerkUserId, firebaseKey);
        return res.status(result.success ? 200 : 207).json(result);
    }
    catch (error) {
        console.error("❌ Error in confirmFlushDeveloperController:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message,
        });
    }
});
exports.confirmFlushDeveloperController = confirmFlushDeveloperController;
// ==============================
// DELETE UNPAID DEVELOPER
// ==============================
/**
 * DELETE /api/onboarding/admin/delete-unpaid-developer
 *
 * Deletes an unpaid developer (Firebase/Clerk only, no Solana transaction)
 * Used for developers who onboarded when fees were disabled
 */
const deleteUnpaidDeveloperController = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { developerPublicKey } = req.body;
        console.log("🗑️ DELETE /api/onboarding/admin/delete-unpaid-developer");
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
            new web3_js_1.PublicKey(developerPublicKey);
        }
        catch (_a) {
            return res.status(400).json({
                success: false,
                message: "Invalid public key format",
            });
        }
        const result = yield (0, onboardingService_1.deleteUnpaidDeveloper)(developerPublicKey);
        return res.status(result.success ? 200 : 207).json(result);
    }
    catch (error) {
        console.error("❌ Error in deleteUnpaidDeveloperController:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message,
        });
    }
});
exports.deleteUnpaidDeveloperController = deleteUnpaidDeveloperController;
// ==============================
// GET FLUSH INFO (Optional helper)
// ==============================
/**
 * GET /api/onboarding/admin/flush-developer/info/:developerPublicKey
 *
 * Gets information about what will be flushed for a developer
 */
const getFlushDeveloperInfoController = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
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
        const result = yield (0, onboardingService_1.getFlushDeveloperInfo)(developerPublicKey);
        return res.status(200).json(result);
    }
    catch (error) {
        console.error("❌ Error in getFlushDeveloperInfoController:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message,
        });
    }
});
exports.getFlushDeveloperInfoController = getFlushDeveloperInfoController;
//# sourceMappingURL=onboardingController.js.map