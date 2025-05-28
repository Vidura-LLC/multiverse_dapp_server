
import {
  PublicKey,
  SystemProgram,
} from "@solana/web3.js";
import {
  TOKEN_2022_PROGRAM_ID,
} from "@solana/spl-token";
import { bs58 } from "@project-serum/anchor/dist/cjs/utils/bytes";
import dotenv from "dotenv";
import { getProgram } from "../staking/services";
dotenv.config();




// ✅ Function to check pool status for staking, revenue, and prize pools
export const checkPoolStatus = async (adminPublicKey: PublicKey, tournamentId?: string) => {
    try {
        const { program } = getProgram();

        const result = {
            success: true,
            stakingPool: {
                status: false, // false = needs initialization, true = exists
                stakingPoolAddress: '',
                poolEscrowAccountAddress: '',
            },
            revenuePool: {
                status: false, // false = needs initialization, true = exists
                revenuePoolAddress: '',
                revenueEscrowAccountAddress: '',
            },
            adminAddress: adminPublicKey.toString()
        };

        // ✅ 1. Check Staking Pool
        const [stakingPoolPublicKey] = PublicKey.findProgramAddressSync(
            [Buffer.from("staking_pool"), adminPublicKey.toBuffer()],
            program.programId
        );

        const [stakingEscrowAccountPublicKey] = PublicKey.findProgramAddressSync(
            [Buffer.from("escrow"), stakingPoolPublicKey.toBuffer()],
            program.programId
        );

        console.log("🔹 Checking Staking Pool PDA:", stakingPoolPublicKey.toString());

        const stakingPoolAccount = await program.account.stakingPool.fetchNullable(stakingPoolPublicKey);

        result.stakingPool = {
            status: stakingPoolAccount !== null,
            stakingPoolAddress: stakingPoolPublicKey.toString(),
            poolEscrowAccountAddress: stakingEscrowAccountPublicKey.toString(),
        };

        // ✅ 2. Check Revenue Pool
        const [revenuePoolPublicKey] = PublicKey.findProgramAddressSync(
            [Buffer.from("revenue_pool"), adminPublicKey.toBuffer()],
            program.programId
        );

        const [revenueEscrowAccountPublicKey] = PublicKey.findProgramAddressSync(
            [Buffer.from("revenue_escrow"), revenuePoolPublicKey.toBuffer()],
            program.programId
        );

        console.log("🔹 Checking Revenue Pool PDA:", revenuePoolPublicKey.toString());

        const revenuePoolAccount = await program.account.revenuePool.fetchNullable(revenuePoolPublicKey);

        result.revenuePool = {
            status: revenuePoolAccount !== null,
            revenuePoolAddress: revenuePoolPublicKey.toString(),
            revenueEscrowAccountAddress: revenueEscrowAccountPublicKey.toString(),

        }

        return result;

    } catch (err) {
        console.error("❌ Error checking pool status:", err);
        return {
            success: false,
            message: `Error checking pool status: ${err.message || err}`
        };
    }
};


// ✅ Function to initialize the staking pool and escrow account
export const initializeStakingPoolService = async (mintPublicKey: PublicKey, adminPublicKey: PublicKey) => {
    try {
        const { program, connection } = getProgram();

        // ✅ Staking pool doesn't exist - create initialization transaction
        console.log("🔄 Creating staking pool initialization transaction...");
        
        console.log("Admin PublicKey:", adminPublicKey.toBase58());

        const [stakingPoolPublicKey] = PublicKey.findProgramAddressSync(
            [Buffer.from("staking_pool"), adminPublicKey.toBuffer()],
            program.programId
        );

        const [poolEscrowAccountPublicKey] = PublicKey.findProgramAddressSync(
            [Buffer.from("escrow"), stakingPoolPublicKey.toBuffer()],
            program.programId
        );

        console.log("🔹 Staking Pool PDA Address:", stakingPoolPublicKey.toString());
        console.log("🔹 Pool Escrow Account Address:", poolEscrowAccountPublicKey.toString());




        
        // Get the latest blockhash
        const { blockhash } = await connection.getLatestBlockhash("finalized");
        console.log("Latest Blockhash:", blockhash);

        // Create the transaction
        const transaction = await program.methods
            .initializeAccounts()
            .accounts({
                admin: adminPublicKey,
                stakingPool: stakingPoolPublicKey,
                mint: mintPublicKey,
                poolEscrowAccount: poolEscrowAccountPublicKey,
                systemProgram: SystemProgram.programId,
                tokenProgram: TOKEN_2022_PROGRAM_ID,
            })
            .transaction();

        // Set recent blockhash and fee payer
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = adminPublicKey;

        // Serialize transaction and send it to the frontend
        return {
            success: true,
            message: "Transaction created successfully!",
            stakingPoolPublicKey: stakingPoolPublicKey.toBase58(),
            poolEscrowAccountPublicKey: poolEscrowAccountPublicKey.toBase58(),
            transaction: transaction.serialize({ requireAllSignatures: false }).toString("base64"),
        };
    } catch (err) {
        console.error("❌ Error initializing staking pool:", err);
        return {
            success: false,
            message: `Error initializing staking pool: ${err.message || err}`
        };
    }
};
  