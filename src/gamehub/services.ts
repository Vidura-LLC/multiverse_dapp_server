import {
    Connection,
    PublicKey,
    Keypair,
    SystemProgram,
    clusterApiUrl,
    Transaction,
  } from "@solana/web3.js";
  import * as anchor from "@project-serum/anchor";
  import { createAssociatedTokenAccountInstruction, getAssociatedTokenAddressSync, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
  import dotenv from "dotenv";
  import { bs58 } from "@project-serum/anchor/dist/cjs/utils/bytes";
import { BN } from "bn.js";
  
  dotenv.config();
  
  // Helper function to get the program
  const getProgram = () => {
    const idl = require("../gamehub/gamehub_idl.json");  // The IDL of your smart contract
    const walletKeypair = require("../staking/testWallet.json"); // Admin wallet keypair
  
    const adminKeypair = Keypair.fromSecretKey(new Uint8Array(walletKeypair));
    const adminPublicKey = adminKeypair.publicKey;
  
    const connection = new Connection(clusterApiUrl("devnet"), "confirmed");
  
    const programId = new PublicKey(
      "BmBAppuJQGGHmVizxKLBpJbFtq8yGe9v7NeVgHPEM4Vs" // Replace with your actual program ID
    );
  
    const provider = new anchor.AnchorProvider(
      connection,
      new anchor.Wallet(adminKeypair),
      anchor.AnchorProvider.defaultOptions()
    );
    anchor.setProvider(provider);
  
    return {
      program: new anchor.Program(idl, programId, provider),
      adminPublicKey,
      adminKeypair,
      connection,
    };
  };
  // ✅ Function to initialize the staking pool and escrow account
  export const initializeAccountsService = async (
    adminPublicKey: PublicKey,
    tournamentId: String,
    entryFee: number,
    mintPublicKey: PublicKey) => {
    try {
      const { program } = getProgram();
  
      const [tournamentPoolPublicKey] = PublicKey.findProgramAddressSync(
        [Buffer.from("tournament_pool"), adminPublicKey.toBuffer()],
        program.programId
      );
  
      const [poolEscrowAccountPublicKey] = PublicKey.findProgramAddressSync(
        [Buffer.from("escrow"), tournamentPoolPublicKey.toBuffer()],
        program.programId
      );
  
      console.log("🔹 tournamentPool PDA Address:", tournamentPoolPublicKey.toString());
      console.log(
        "🔹 Pool Escrow Account Address:",
        poolEscrowAccountPublicKey.toString()
      );

      const entryFeeBN = new BN(entryFee);

  
      await program.methods
        .createTournamentPool(tournamentId, entryFeeBN)
        .accounts({
          admin: adminPublicKey,
          tournamentPool: tournamentPoolPublicKey,
          mint: mintPublicKey,
          poolEscrowAccount: poolEscrowAccountPublicKey,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .rpc();
  
    // After initializing the tournament pool, fetch its data
    const tournamentPoolData = await getTournamentPool(adminPublicKey);

    return {
      success: true,
      message: 'Tournament pool initialized successfully!',
      tournamentPoolData, // Return the fetched tournament pool data
    };
  } catch (err) {
    console.error('❌ Error initializing tournament pool:', err);
    return { success: false, message: 'Error initializing tournament pool' };
  }
  };



  
  
  interface TournamentPoolAccount {
    admin: PublicKey;
    mint: PublicKey, // Admin public key
    tournamentId: string; // Tournament ID
    entryFee: anchor.BN; // Entry fee in base units (e.g., lamports or token units)
    totalFunds: anchor.BN; // Total funds accumulated in the pool
    bump: number; // Bump seed for the tournament pool account
  }
  

// Fetch the Tournament Pool Account
export const getTournamentPool = async (adminPublicKey: PublicKey) => {
  try {
    const { program, connection } = getProgram();

    // Derive the public key for the tournament pool
    const [tournamentPoolPublicKey] = PublicKey.findProgramAddressSync(
      [Buffer.from('tournament_pool'), adminPublicKey.toBuffer()],
      program.programId
    );

    console.log('Tournament Pool PublicKey:', tournamentPoolPublicKey.toBase58());

    // Check if the tournament pool exists
    const accountExists = await connection.getAccountInfo(tournamentPoolPublicKey);

    if (!accountExists) {
      return { success: false, message: 'Tournament pool does not exist.' };
    }

    // Fetch the tournament pool data
    const tournamentPool = await program.account.tournamentPool.fetch(
      tournamentPoolPublicKey
    ) as TournamentPoolAccount;

    console.log('Tournament Pool:', tournamentPool);

    // Convert entryFee from base units (lamports or token decimals) to a readable format
    const tokenDecimals = 9; // Adjust token decimals as needed
    const readableEntryFee = tournamentPool.entryFee.toNumber() / (10 ** tokenDecimals);

    // Ensure that the fields are defined and use safe .toString() calls
    const rawData = {
      tournamentId: tournamentPool.tournamentId,
      entryFee: readableEntryFee, // Convert entryFee to a human-readable format
      totalFunds: tournamentPool.totalFunds.toString(),
      admin: tournamentPool.admin.toBase58(),
    };

    console.log('✅ Raw Tournament Pool Data:', rawData);

    return { success: true, data: rawData };
  } catch (err) {
    console.error('❌ Error fetching tournament pool:', err);
    return { success: false, message: 'Error fetching tournament pool.' };
  }
};

export const registerForTournamentService = async (
  mintPublicKey: PublicKey,
  userPublicKey: PublicKey,
  adminPublicKey: PublicKey

) => {
  try {
    const { program, connection  } = getProgram();

    // Fetch the tournament pool details (including entryFee)
    const tournamentPoolData = await getTournamentPool(adminPublicKey);

    if (!tournamentPoolData.success) {
      return { success: false, message: tournamentPoolData.message };
    }

    const entryFee = tournamentPoolData.data.entryFee;

    // Derive the program addresses (PDAs) for the tournament pool and escrow account
    const [tournamentPoolPublicKey] = PublicKey.findProgramAddressSync(
      [Buffer.from("tournament_pool"), adminPublicKey.toBuffer()],
      program.programId
    );

    const [poolEscrowAccountPublicKey] = PublicKey.findProgramAddressSync(
      [Buffer.from("escrow"), tournamentPoolPublicKey.toBuffer()],
      program.programId
    );

    console.log("🔹 tournamentPool PDA Address:", tournamentPoolPublicKey.toString());
    console.log("🔹 Pool Escrow Account Address:", poolEscrowAccountPublicKey.toString());

    // Get the user's token account (create if it doesn't exist)
    const userTokenAccountPublicKey = await getOrCreateAssociatedTokenAccount(
      connection,
      mintPublicKey,
      userPublicKey
    );

    console.log('User PublicKey:', userPublicKey.toBase58());
    console.log('Tournament Pool PublicKey:', tournamentPoolPublicKey.toBase58());
    console.log('Escrow Account PublicKey:', poolEscrowAccountPublicKey.toBase58());

    // Ensure the user has enough balance for the entry fee
    const userTokenAccountInfo = await connection.getAccountInfo(userTokenAccountPublicKey);
    const userBalance = userTokenAccountInfo?.lamports || 0; // Fetch user's balance in token units
    const entryFeeLamports = new BN(entryFee * 10 ** 9); // Convert entry fee to lamports (considering decimals)

    if (userBalance < entryFeeLamports.toNumber()) {
      return { success: false, message: 'Insufficient funds for registration' };
    }

    // Get the latest blockhash
    const { blockhash } = await connection.getLatestBlockhash('finalized');

    // Create the unsigned transaction for registering the user
    const transaction = await program.methods
      .registerForTournament() // No need to pass entryFee since it's fetched from the pool
      .accounts({
        user: userPublicKey,
        tournamentPool: tournamentPoolPublicKey,
        userTokenAccount: userTokenAccountPublicKey,
        poolEscrowAccount: poolEscrowAccountPublicKey, // Ensure escrow account is passed here
        mint: mintPublicKey,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .transaction(); // Create the transaction, don't sign it

    transaction.recentBlockhash = blockhash;
    transaction.feePayer = userPublicKey;

    // Serialize transaction and send it to the frontend
    return {
      success: true,
      message: "Transaction created successfully!",
      transaction: transaction.serialize({ requireAllSignatures: false })
    };
  } catch (err) {
    console.error("❌ Error creating staking transaction:", err);
    return { success: false, message: "Error creating staking transaction" };
  }
};


export const registerForTournamentServiceWithKeypair = async (
  mintPublicKey: PublicKey
) => {
  try {
    const { program, adminKeypair, connection, adminPublicKey } = getProgram();

    // Fetch the tournament pool details (including entryFee)
    const tournamentPoolData = await getTournamentPool(adminPublicKey);

    if (!tournamentPoolData.success) {
      return { success: false, message: tournamentPoolData.message };
    }

    const entryFee = tournamentPoolData.data.entryFee;

    // Derive the program addresses (PDAs) for the tournament pool and escrow account
    const [tournamentPoolPublicKey] = PublicKey.findProgramAddressSync(
      [Buffer.from("tournament_pool"), adminPublicKey.toBuffer()],
      program.programId
    );

    const [poolEscrowAccountPublicKey] = PublicKey.findProgramAddressSync(
      [Buffer.from("escrow"), tournamentPoolPublicKey.toBuffer()],
      program.programId
    );

    console.log("🔹 tournamentPool PDA Address:", tournamentPoolPublicKey.toString());
    console.log("🔹 Pool Escrow Account Address:", poolEscrowAccountPublicKey.toString());

    // Get the user's token account (create if it doesn't exist)
    const userTokenAccountPublicKey = await getOrCreateAssociatedTokenAccount(
      connection,
      mintPublicKey,
      adminPublicKey
    );

    console.log('User PublicKey:', adminPublicKey.toBase58());
    console.log('Tournament Pool PublicKey:', tournamentPoolPublicKey.toBase58());
    console.log('Escrow Account PublicKey:', poolEscrowAccountPublicKey.toBase58());

    // Ensure the user has enough balance for the entry fee
    const userTokenAccountInfo = await connection.getAccountInfo(userTokenAccountPublicKey);
    const userBalance = userTokenAccountInfo?.lamports || 0; // Fetch user's balance in token units
    const entryFeeLamports = new BN(entryFee * 10 ** 9); // Convert entry fee to lamports (considering decimals)

    if (userBalance < entryFeeLamports.toNumber()) {
      return { success: false, message: 'Insufficient funds for registration' };
    }

    // Get the latest blockhash
    const { blockhash } = await connection.getLatestBlockhash('finalized');

    // Create the unsigned transaction for registering the user
    const transaction = await program.methods
      .registerForTournament() // No need to pass entryFee since it's fetched from the pool
      .accounts({
        user: adminPublicKey,
        tournamentPool: tournamentPoolPublicKey,
        userTokenAccount: userTokenAccountPublicKey,
        poolEscrowAccount: poolEscrowAccountPublicKey, // Ensure escrow account is passed here
        mint: mintPublicKey,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .transaction(); // Create the transaction, don't sign it

    transaction.recentBlockhash = blockhash;
    transaction.feePayer = adminPublicKey;

    // Sign the transaction with the user's keypair
    await transaction.sign(adminKeypair); // Sign the transaction with the user keypair

    // Send the transaction to the Solana network and get the signature
    const transactionSignature = await connection.sendTransaction(transaction, [adminKeypair], {
      skipPreflight: false,
      preflightCommitment: 'processed',
    });

    // Confirm the transaction
    const confirmation = await connection.confirmTransaction(transactionSignature, 'confirmed');

    
    
    return {
      success: true,
      message: 'Transaction created, signed, and sent successfully!',
      transactionSignature,
    };
  } catch (err) {
    console.error('❌ Error registering for tournament:', err);
    return { success: false, message: 'Error registering for tournament' };
  }
};



  
  
  // ✅ Helper function to get or create an associated token account
  async function getOrCreateAssociatedTokenAccount(
    connection: Connection,
    mint: PublicKey,
    owner: PublicKey
  ): Promise<PublicKey> {
    const associatedTokenAddress = getAssociatedTokenAddressSync(
      mint,
      owner,
      false, // ✅ Not a PDA
      TOKEN_2022_PROGRAM_ID
    );
  
    const accountInfo = await connection.getAccountInfo(associatedTokenAddress);
  
    if (!accountInfo) {
      console.log(
        `🔹 Token account does not exist. Creating ATA: ${associatedTokenAddress.toBase58()}`
      );
  
      const transaction = new anchor.web3.Transaction().add(
        createAssociatedTokenAccountInstruction(
          owner,
          associatedTokenAddress,
          owner,
          mint,
          TOKEN_2022_PROGRAM_ID
        )
      );
      const { adminKeypair } = getProgram();
      await anchor.web3.sendAndConfirmTransaction(connection, transaction, [
        adminKeypair
      ]);
      console.log(`✅ Successfully created ATA: ${associatedTokenAddress.toBase58()}`);
    } else {
      console.log(`🔹 Token account exists: ${associatedTokenAddress.toBase58()}`);
    }
  
    return associatedTokenAddress;
  }
  