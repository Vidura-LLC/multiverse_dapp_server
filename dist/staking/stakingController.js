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
exports.stakeTokens = exports.initializeAccountsController = void 0;
const services_1 = require("./services");
const web3_js_1 = require("@solana/web3.js");
// Controller function for initializing the staking pool
const initializeAccountsController = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { mintPublicKey } = req.body; // Get mint address from request body
        // Validate the mint address
        if (!mintPublicKey) {
            return res.status(400).json({ error: 'Mint public key is required' });
        }
        // Call the staking pool initialization service
        const result = yield (0, services_1.initializeAccountsService)(mintPublicKey);
        // Return the result
        if (result.success) {
            return res.status(200).json({ message: result.message });
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
exports.initializeAccountsController = initializeAccountsController;
const stakeTokens = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    console.log('stacking invoked');
    try {
        const { mintPublicKey, userPublicKey, amount } = req.body;
        if (!mintPublicKey || !userPublicKey || !amount) {
            return res.status(400).json({ success: false, message: "Mint public key, user public key, and amount are required" });
        }
        const mintAddress = new web3_js_1.PublicKey(mintPublicKey);
        const userAddress = new web3_js_1.PublicKey(userPublicKey); // Get user's wallet public key
        // Call the service function to stake tokens
        const result = yield (0, services_1.stakeTokenService)(mintAddress, userAddress, amount);
        if (result.success) {
            return res.status(200).json(result);
        }
        else {
            return res.status(500).json(result);
        }
    }
    catch (err) {
        console.error("Error in staking tokens:", err);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
});
exports.stakeTokens = stakeTokens;
// // Controller function to handle unstaking tokens
// export const unstakeTokens = async (req: Request, res: Response) => {
//   try {
//     const { userPublicKey, mintPublicKey, amount } = req.body;
//     // Validate inputs
//     if (!userPublicKey || !mintPublicKey || !amount) {
//       return res.status(400).json({ success: false, message: 'User public key, mint public key, and amount are required' });
//     }
//     const userAddress = new PublicKey(userPublicKey);
//     const mintAddress = new PublicKey(mintPublicKey);
//     // Call the service function to unstake tokens
//     const result = await unstakeTokenService(userAddress, mintAddress, amount);
//     if (result.success) {
//       return res.status(200).json(result);
//     } else {
//       return res.status(500).json(result);
//     }
//   } catch (err) {
//     console.error('Error in unstaking tokens:', err);
//     return res.status(500).json({ success: false, message: 'Internal server error' });
//   }
// };
//# sourceMappingURL=stakingController.js.map