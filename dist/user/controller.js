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
const web3_js_1 = require("@solana/web3.js");
const services_1 = require("../staking/services");
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
//# sourceMappingURL=controller.js.map