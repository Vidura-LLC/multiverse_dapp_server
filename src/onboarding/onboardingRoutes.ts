import express, { RequestHandler } from "express";
import {
    getDeveloperOnboardingConfigController,
    updateDeveloperOnboardingFeeController,
    payDeveloperOnboardingFeeController,
    checkDeveloperOnboardingStatusController,
    getAllOnboardedDevelopersController,
    buildFlushDeveloperController,
    confirmFlushDeveloperController,
    getFlushDeveloperInfoController,
} from "./onboardingController";

const router = express.Router();

// ==============================
// PUBLIC ROUTES
// ==============================

/**
 * GET /api/onboarding/config
 * Get current onboarding fee configuration
 */
router.get("/config", getDeveloperOnboardingConfigController as unknown as RequestHandler);

/**
 * GET /api/onboarding/status/:developerPublicKey
 * Check if a developer has completed on-chain onboarding
 */
router.get("/status/:developerPublicKey", checkDeveloperOnboardingStatusController as unknown as RequestHandler);

/**
 * POST /api/onboarding/pay-fee
 * Build transaction for developer to pay onboarding fee
 */
router.post("/pay-fee", payDeveloperOnboardingFeeController as unknown as RequestHandler);

// ==============================
// ADMIN ROUTES
// ==============================

/**
 * POST /api/onboarding/admin/update-fee
 * Build transaction to update onboarding fee configuration
 */
router.post("/admin/update-fee", updateDeveloperOnboardingFeeController as unknown as RequestHandler);

/**
 * GET /api/onboarding/admin/developers
 * Get all onboarded developers (for analytics)
 */
router.get("/admin/developers", getAllOnboardedDevelopersController as unknown as RequestHandler);

// ==============================
// FLUSH DEVELOPER ROUTES (Admin)
// ==============================

/**
 * GET /api/onboarding/admin/flush-developer/info/:developerPublicKey
 * Get info about what will be flushed
 */
router.get(
    "/admin/flush-developer/info/:developerPublicKey",
    getFlushDeveloperInfoController as unknown as RequestHandler
);

/**
 * POST /api/onboarding/admin/flush-developer/build
 * Build the Solana transaction for flushing
 */
router.post("/admin/flush-developer/build", buildFlushDeveloperController as unknown as RequestHandler);

/**
 * POST /api/onboarding/admin/flush-developer/confirm
 * Confirm Solana tx and clean up Firebase + Clerk
 */
router.post("/admin/flush-developer/confirm", confirmFlushDeveloperController as unknown as RequestHandler);

export default router;

