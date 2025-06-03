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
exports.initializationTest = exports.initializeRevenuePoolController = exports.initializeStakingPoolController = exports.checkPoolStatusController = void 0;
const web3_js_1 = require("@solana/web3.js");
const services_1 = require("./services");
// In adminDashboard/adminDashboardController.ts - Add this controller
const checkPoolStatusController = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { adminPublicKey } = req.params;
        // Validate the admin public key
        if (!adminPublicKey) {
            return res.status(400).json({
                success: false,
                error: 'Admin public key is required'
            });
        }
        // Validate public key format
        try {
            new web3_js_1.PublicKey(adminPublicKey);
        }
        catch (error) {
            return res.status(400).json({
                success: false,
                error: 'Invalid admin public key format'
            });
        }
        // Check staking pool status
        const result = yield (0, services_1.checkPoolStatus)(new web3_js_1.PublicKey(adminPublicKey));
        if (result.success) {
            return res.status(200).json({
                data: result
            });
        }
    }
    catch (err) {
        console.error('Error in check staking pool status controller:', err);
        return res.status(500).json({
            success: false,
            error: 'Failed to check staking pool status',
            details: err.message
        });
    }
});
exports.checkPoolStatusController = checkPoolStatusController;
// Controller function for initializing the staking pool
const initializeStakingPoolController = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { mintPublicKey, adminPublicKey } = req.body; // Get mint address from request body
        // Validate the mint address
        if (!mintPublicKey || !adminPublicKey) {
            return res.status(400).json({ error: 'Mint public key is required' });
        }
        // Call the staking pool initialization service
        const result = yield (0, services_1.initializeStakingPoolService)(new web3_js_1.PublicKey(mintPublicKey), new web3_js_1.PublicKey(adminPublicKey));
        // Return the result
        if (result.success) {
            return res.status(200).json({ data: result });
        }
        else {
            return res.status(500).json({ error: result.message });
        }
    }
    catch (err) {
        console.error('Error in initialize staking pool controller:', err);
        return res.status(500).json({ error: 'Failed to initialize staking pool' });
    }
});
exports.initializeStakingPoolController = initializeStakingPoolController;
/**
 * Controller function for initializing the global revenue pool
 */
const initializeRevenuePoolController = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { mintPublicKey, adminPublicKey } = req.body;
        // Validate the mint address
        if (!mintPublicKey || !adminPublicKey) {
            return res.status(400).json({
                success: false,
                message: 'Mint and Admin public key is required'
            });
        }
        // Call the service function to initialize revenue pool
        const result = yield (0, services_1.initializeRevenuePoolService)(new web3_js_1.PublicKey(mintPublicKey), new web3_js_1.PublicKey(adminPublicKey));
        // Return the result
        if (result.success) {
            return res.status(200).json({ data: result });
        }
        else {
            return res.status(500).json({ error: result.message });
        }
    }
    catch (err) {
        console.error('Error in initialize revenue pool controller:', err);
        return res.status(500).json({
            success: false,
            message: 'Failed to initialize revenue pool',
            error: err.message || err
        });
    }
});
exports.initializeRevenuePoolController = initializeRevenuePoolController;
const initializationTest = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
});
exports.initializationTest = initializationTest;
//# sourceMappingURL=adminDashboardController.js.map