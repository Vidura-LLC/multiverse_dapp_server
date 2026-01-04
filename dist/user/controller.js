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
exports.createAtaForUser = createAtaForUser;
exports.checkAdminStatus = checkAdminStatus;
const web3_js_1 = require("@solana/web3.js");
const services_1 = require("../staking/services");
const middleware_1 = require("../gamehub/middleware");
function createAtaForUser(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const { userPublicKey } = req.body;
        try {
            const publicKey = new web3_js_1.PublicKey(userPublicKey);
            const MINT = new web3_js_1.PublicKey(process.env.TOKEN_MINT_ADDRESS);
            yield (0, services_1.createAssociatedTokenAccount)(MINT, publicKey);
            console.log("ATA created for user");
            return res.status(200).json({ message: "ATA created for user" });
        }
        catch (error) {
            console.log("Failed to create ATA for user", error);
            res.status(500).json({ error: "Failed to create ATA for user" });
        }
    });
}
/**
 * Check if a user is an admin by their public key
 * GET /api/user/check-admin?publicKey=<publicKey>
 */
function checkAdminStatus(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { publicKey } = req.query;
            if (!publicKey || typeof publicKey !== 'string') {
                return res.status(400).json({
                    success: false,
                    message: 'Public key is required',
                });
            }
            const user = yield (0, middleware_1.checkUser)(publicKey);
            if (!user) {
                return res.status(200).json({
                    success: true,
                    isAdmin: false,
                    message: 'User not found',
                });
            }
            const isAdmin = user.role === 'admin' || user.role === 'super_admin';
            return res.status(200).json({
                success: true,
                isAdmin,
                role: user.role || null,
            });
        }
        catch (error) {
            console.error('[User] Error checking admin status:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to check admin status',
                error: error.message || error,
            });
        }
    });
}
//# sourceMappingURL=controller.js.map