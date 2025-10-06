import { PublicKey } from "@solana/web3.js";
import { createAssociatedTokenAccount } from "../staking/services";
import { Request, Response } from "express";

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

