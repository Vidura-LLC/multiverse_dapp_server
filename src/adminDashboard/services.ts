
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




// ✅ Function to check if staking pool exists for an admin
export const checkStakingPoolStatus = async (adminPublicKey: PublicKey) => {
    try {
        const { program } = getProgram();

        // Derive the staking pool PDA
        const [stakingPoolPublicKey] = PublicKey.findProgramAddressSync(
            [Buffer.from("staking_pool"), adminPublicKey.toBuffer()],
            program.programId
        );

        // Derive the pool escrow account PDA
        const [poolEscrowAccountPublicKey] = PublicKey.findProgramAddressSync(
            [Buffer.from("escrow"), stakingPoolPublicKey.toBuffer()],
            program.programId
        );

        console.log("🔹 Checking Staking Pool PDA:", stakingPoolPublicKey.toString());

        // Try to fetch the staking pool account
        const stakingPoolAccount = await program.account.stakingPool.fetchNullable(stakingPoolPublicKey);

        if (stakingPoolAccount) {
            // Staking pool already exists
            return {
                success: true,
                status: true,
                stakingPoolAddress: stakingPoolPublicKey.toString(),
                poolEscrowAccountAddress: poolEscrowAccountPublicKey.toString(),
                adminAddress: adminPublicKey.toString(),
        
            };
        } else {
            // Staking pool doesn't exist - needs initialization
            return {
                success: true,
                status: false, 
            };
        }

    } catch (err) {
        console.error("❌ Error checking staking pool status:", err);
        return {
            success: false,
            message: `Error checking staking pool status: ${err.message || err}`
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
  