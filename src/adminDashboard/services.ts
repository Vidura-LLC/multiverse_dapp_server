
//src/adminDashboard/services.ts

import {
    PublicKey,
    SystemProgram,
  } from "@solana/web3.js";
  import {
    TOKEN_2022_PROGRAM_ID,
  } from "@solana/spl-token";
  import dotenv from "dotenv";
  import { getProgram } from "../staking/services";
  dotenv.config();
import * as anchor from "@project-serum/anchor";

export const SEEDS = {
  STAKING_POOL: "staking_pool",
  STAKING_POOL_ESCROW: "escrow",
  REVENUE_POOL: "revenue_pool",
  REVENUE_POOL_ESCROW: "revenue_escrow",
  PRIZE_POOL: "prize_pool",
  PRIZE_POOL_ESCROW: "prize_escrow",
  REWARD_POOL: "reward_pool",
  REWARD_POOL_ESCROW: "reward_escrow",
  TOURNAMENT_POOL: "tournament_pool",
}

export enum TokenType {
  SPL = 0,
  SOL = 1,
}



export interface StakingPoolAccount {
    admin: PublicKey;
    mint: PublicKey;
    totalStaked: anchor.BN;
    totalWeight: anchor.BN;
    accRewardPerWeight: anchor.BN;
    epochIndex: anchor.BN;
    tokenType: {spl?: {} | {sol?: {}}}
    bump: number;
}

export interface RewardPoolAccount {
  admin: PublicKey;
  mint: PublicKey;
  totalFunds: anchor.BN;
  lastDistribution: anchor.BN;
  tokenType: {spl?: {} | {sol?: {}}}
  bump: number;
}

export interface RevenuePoolAccount {
    admin: PublicKey;
    mint: PublicKey;
    totalFunds: anchor.BN;
    lastDistribution: anchor.BN;
    tokenType: {spl?: {} | {sol?: {}}}
    bump: number;
}
      

  // ✅ Function to initialize the staking pool and escrow account
  export const initializeStakingPoolService = async (mintPublicKey: PublicKey, adminPublicKey: PublicKey, tokenType: TokenType = TokenType.SPL) => {
      try {
          const { program, connection } = getProgram();
  
          // ✅ Staking pool doesn't exist - create initialization transaction
          console.log("🔄 Creating staking pool initialization transaction...");
          console.log("Token Type:", tokenType === TokenType.SPL ? "SPL" : "SOL");
          console.log("Admin PublicKey:", adminPublicKey.toBase58());
  
          const [stakingPoolPublicKey] = PublicKey.findProgramAddressSync(
              [Buffer.from(SEEDS.STAKING_POOL), adminPublicKey.toBuffer()],
              program.programId
          );
  
          const [poolEscrowAccountPublicKey] = PublicKey.findProgramAddressSync(
              [Buffer.from(SEEDS.STAKING_POOL_ESCROW), stakingPoolPublicKey.toBuffer()],
              program.programId
          );
  
          console.log("🔹 Staking Pool PDA Address:", stakingPoolPublicKey.toString());
          console.log("🔹 Pool Escrow Account Address:", poolEscrowAccountPublicKey.toString());
  
  
  
  
          
          // Get the latest blockhash
          const { blockhash } = await connection.getLatestBlockhash("finalized");
          console.log("Latest Blockhash:", blockhash);
  
          const tokenTypeArg = tokenType === TokenType.SPL ? {spl: {}} : {sol: {}};

          // Create the transaction
          const transaction = await program.methods
              .initializeAccounts(tokenTypeArg)
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
              tokenType: tokenType === TokenType.SPL ? "SPL" : "SOL",
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
  
  /**
   * Initialize the global revenue pool
   * @param mintPublicKey - The token mint address
   * @returns Result object with transaction details and addresses
   */
  export const initializeRevenuePoolService = async (mintPublicKey: PublicKey, adminPublicKey: PublicKey) => {
      try {
          const { program, connection } = getProgram();
  
          // Log initial parameters for clarity
          console.log("Initializing Revenue Pool:");
          console.log("Admin PublicKey:", adminPublicKey.toBase58());
          console.log("Mint PublicKey:", mintPublicKey.toBase58());
  
          // Derive the PDA for the revenue pool
          const [revenuePoolPublicKey] = PublicKey.findProgramAddressSync(
              [Buffer.from("revenue_pool"), adminPublicKey.toBuffer()],
              program.programId
          );
  
          // Derive the PDA for the revenue escrow account
          const [revenueEscrowPublicKey] = PublicKey.findProgramAddressSync(
              [Buffer.from("revenue_escrow"), revenuePoolPublicKey.toBuffer()],
              program.programId
          );
  
          console.log("🔹 Revenue Pool PDA Address:", revenuePoolPublicKey.toString());
          console.log("🔹 Revenue Escrow PDA Address:", revenueEscrowPublicKey.toString());
  
          // Get the latest blockhash
          const { blockhash } = await connection.getLatestBlockhash("finalized");
          console.log("Latest Blockhash:", blockhash);
  
          // Create the transaction
          const transaction = await program.methods
              .initializeRevenuePool()
              .accounts({
                  revenuePool: revenuePoolPublicKey,
                  revenueEscrowAccount: revenueEscrowPublicKey,
                  mint: mintPublicKey,
                  admin: adminPublicKey,
                  systemProgram: anchor.web3.SystemProgram.programId,
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
              transaction: transaction.serialize({ requireAllSignatures: false }).toString('base64'),
          };
      } catch (err) {
          console.error("❌ Error initializing revenue pool:", err);
          return {
              success: false,
              message: `Error initializing revenue pool: ${err.message || err}`
          };
      }
  };

    /**
   * Initialize a prize pool for a specific tournament
   * @param tournamentId - The tournament ID
   * @param mintPublicKey - The token mint address
   * @returns Result object with transaction details and addresses
   */
    export const initializePrizePoolService = async (tournamentId: string, mintPublicKey: PublicKey, adminPublicKey: PublicKey) => {
        try {
          const { program, connection } = getProgram();
      
          // Log initial parameters for clarity
          console.log("Initializing Prize Pool for Tournament:");
          console.log("Tournament ID:", tournamentId);
          console.log("Admin PublicKey:", adminPublicKey.toBase58());
          console.log("Mint PublicKey:", mintPublicKey.toBase58());
      
          // First, derive the tournament pool PDA to ensure it exists
          const tournamentIdBytes = Buffer.from(tournamentId, "utf8");
          const [tournamentPoolPublicKey] = PublicKey.findProgramAddressSync(
            [Buffer.from("tournament_pool"), adminPublicKey.toBuffer(), tournamentIdBytes],
            program.programId
          );
          
          console.log("🔹 Tournament Pool PDA Address:", tournamentPoolPublicKey.toString());
          
          // Add this to initializePrizePoolService
          console.log("Full tournament pool key:", tournamentPoolPublicKey.toString());
          console.log("Tournament ID bytes:", tournamentIdBytes);
          console.log("Admin pubkey:", adminPublicKey.toString());
      
          // Derive the PDA for the prize pool (now derived from tournament pool)
          const [prizePoolPublicKey] = PublicKey.findProgramAddressSync(
            [Buffer.from("prize_pool"), tournamentPoolPublicKey.toBuffer()],
            program.programId
          );
      
          // Derive the PDA for the prize escrow account
          const [prizeEscrowPublicKey] = PublicKey.findProgramAddressSync(
            [Buffer.from("prize_escrow"), prizePoolPublicKey.toBuffer()],
            program.programId
          );
      
          console.log("🔹 Prize Pool PDA Address:", prizePoolPublicKey.toString());
          console.log("🔹 Prize Escrow PDA Address:", prizeEscrowPublicKey.toString());
      
          // Get the latest blockhash
          const { blockhash } = await connection.getLatestBlockhash("finalized");
          console.log("Latest Blockhash:", blockhash);
      
          // Create the transaction
          const transaction = await program.methods
            .initializePrizePool(tournamentId)
            .accounts({
              prizePool: prizePoolPublicKey,
              tournamentPool: tournamentPoolPublicKey,
              prizeEscrowAccount: prizeEscrowPublicKey,
              mint: mintPublicKey,
              admin: adminPublicKey,
              systemProgram: anchor.web3.SystemProgram.programId,
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
          transaction: transaction.serialize({ requireAllSignatures: false }).toString('base64'),
          prizePool: prizePoolPublicKey.toString(),
        };
      } catch (err) {
          console.error("❌ Error initializing prize pool:", err);
          return {
            success: false,
            message: `Error initializing prize pool: ${err.message || err}`
          };
        }
      };
      


  // ✅ Initialize Reward Pool (admin-only)
export const initializeRewardPoolService = async (
  mintPublicKey: PublicKey,
  adminPublicKey: PublicKey
) => {
  try {
    const { program, connection } = getProgram();

    // Derive PDAs
    const [rewardPoolPublicKey] = PublicKey.findProgramAddressSync(
      [Buffer.from("reward_pool"), adminPublicKey.toBuffer()],
      program.programId
    );

    const [rewardEscrowPublicKey] = PublicKey.findProgramAddressSync(
      [Buffer.from("reward_escrow"), rewardPoolPublicKey.toBuffer()],
      program.programId
    );

    // Build unsigned tx
    const { blockhash } = await connection.getLatestBlockhash("finalized");
    const transaction = await program.methods
      .initializeRewardPool()
      .accounts({
        rewardPool: rewardPoolPublicKey,
        rewardEscrowAccount: rewardEscrowPublicKey,
        mint: mintPublicKey,
        admin: adminPublicKey,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .transaction();

    transaction.recentBlockhash = blockhash;
    transaction.feePayer = adminPublicKey;

    return {
      success: true,
      message: "Transaction created successfully!",
      rewardPool: rewardPoolPublicKey.toBase58(),
      rewardEscrow: rewardEscrowPublicKey.toBase58(),
      transaction: transaction.serialize({ requireAllSignatures: false }).toString("base64"),
    };
  } catch (err: any) {
    console.error("❌ Error creating initializeRewardPool tx:", err);
    return { success: false, message: `Error creating tx: ${err.message || err}` };
  }
};

  
  // ✅ Function to check pool status for staking, revenue, and prize pools
  export const checkPoolStatus = async (adminPublicKey: PublicKey, tournamentId?: string) => {
      try {
          const { program } = getProgram();
  
          const result = {
              success: true,
              stakingPool: {
                  status: false, // false = needs initialization, true = exists
              },
              revenuePool: {
                  status: false, // false = needs initialization, true = exists
              },
              rewardPool: {
                status: false, // false = needs initialization, true = exists
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
  
          const stakingPoolAccount = await program.account.stakingPool.fetchNullable(stakingPoolPublicKey) as StakingPoolAccount;
  
          result.stakingPool = {
              status: stakingPoolAccount !== null,
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
  
          const revenuePoolAccount = await program.account.revenuePool.fetchNullable(revenuePoolPublicKey) as RevenuePoolAccount;
  
          result.revenuePool = {
              status: revenuePoolAccount !== null,
          }

 
          // ✅ 3. Check Reward Pool
          const [rewardPoolPublicKey] = PublicKey.findProgramAddressSync(
            [Buffer.from("reward_pool"), adminPublicKey.toBuffer()],
            program.programId
        );

        const [rewardEscrowAccountPublicKey] = PublicKey.findProgramAddressSync(
            [Buffer.from("reward_escrow"), rewardPoolPublicKey.toBuffer()],
            program.programId
        );

        console.log("🔹 Checking Reward Pool PDA:", rewardPoolPublicKey.toString());

        const rewardPoolAccount = await program.account.rewardPool.fetchNullable(rewardPoolPublicKey) as RewardPoolAccount;

        result.rewardPool = {
            status: rewardPoolAccount !== null,
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