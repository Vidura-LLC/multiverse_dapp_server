"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const onboardingController_1 = require("./onboardingController");
const router = express_1.default.Router();
// ==============================
// PUBLIC ROUTES
// ==============================
/**
 * GET /api/onboarding/config
 * Get current onboarding fee configuration
 */
router.get("/config", onboardingController_1.getDeveloperOnboardingConfigController);
/**
 * GET /api/onboarding/status/:developerPublicKey
 * Check if a developer has completed on-chain onboarding
 */
router.get("/status/:developerPublicKey", onboardingController_1.checkDeveloperOnboardingStatusController);
/**
 * POST /api/onboarding/pay-fee
 * Build transaction for developer to pay onboarding fee
 */
router.post("/pay-fee", onboardingController_1.payDeveloperOnboardingFeeController);
// ==============================
// ADMIN ROUTES
// ==============================
/**
 * POST /api/onboarding/admin/update-fee
 * Build transaction to update onboarding fee configuration
 */
router.post("/admin/update-fee", onboardingController_1.updateDeveloperOnboardingFeeController);
/**
 * GET /api/onboarding/admin/developers
 * Get all onboarded developers (for analytics)
 */
router.get("/admin/developers", onboardingController_1.getAllOnboardedDevelopersController);
// ==============================
// FLUSH DEVELOPER ROUTES (Admin)
// ==============================
/**
 * GET /api/onboarding/admin/flush-developer/info/:developerPublicKey
 * Get info about what will be flushed
 */
router.get("/admin/flush-developer/info/:developerPublicKey", onboardingController_1.getFlushDeveloperInfoController);
/**
 * POST /api/onboarding/admin/flush-developer/build
 * Build the Solana transaction for flushing
 */
router.post("/admin/flush-developer/build", onboardingController_1.buildFlushDeveloperController);
/**
 * POST /api/onboarding/admin/flush-developer/confirm
 * Confirm Solana tx and clean up Firebase + Clerk
 */
router.post("/admin/flush-developer/confirm", onboardingController_1.confirmFlushDeveloperController);
/**
 * DELETE /api/onboarding/admin/delete-unpaid-developer
 * Delete unpaid developer (Firebase/Clerk only, no Solana transaction)
 */
router.delete("/admin/delete-unpaid-developer", onboardingController_1.deleteUnpaidDeveloperController);
exports.default = router;
//# sourceMappingURL=onboardingRoutes.js.map