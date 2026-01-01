import { PublicKey } from "@solana/web3.js";
import { createAssociatedTokenAccount } from "../staking/services";
import { Request, Response } from "express";
import { checkUser } from "../gamehub/middleware";

export async function createAtaForUser(req: Request, res: Response) {
    const { userPublicKey } = req.body;
    try {
        const publicKey = new PublicKey(userPublicKey);
        const MINT = new PublicKey(process.env.TOKEN_MINT_ADDRESS as string);
        await createAssociatedTokenAccount(MINT, publicKey)

        console.log("ATA created for user");
        return res.status(200).json({ message: "ATA created for user" });

    } catch (error) {
        console.log("Failed to create ATA for user", error);
        res.status(500).json({ error: "Failed to create ATA for user" });
    }
}

/**
 * Check if a user is an admin by their public key
 * GET /api/user/check-admin?publicKey=<publicKey>
 */
export async function checkAdminStatus(req: Request, res: Response) {
    try {
        const { publicKey } = req.query;

        if (!publicKey || typeof publicKey !== 'string') {
            return res.status(400).json({
                success: false,
                message: 'Public key is required',
            });
        }

        const user = await checkUser(publicKey);
        
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
    } catch (error: any) {
        console.error('[User] Error checking admin status:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to check admin status',
            error: error.message || error,
        });
    }
}

