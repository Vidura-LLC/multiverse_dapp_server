//backend/src/staking/stakingController.ts


import { Request, Response } from 'express';
import { initializeAccountsService, stakeTokenService, unstakeTokenService, getUserStakingAccount, createAssociatedTokenAccount, createAssociatedTokenAccountWithKeypair } from './services';
import { PublicKey } from '@solana/web3.js';



// Controller function for initializing the staking pool
export const initializeAccountsController = async (req: Request, res: Response) => {
  try {
    const { mintPublicKey } = req.body;  // Get mint address from request body

    // Validate the mint address
    if (!mintPublicKey) {
      return res.status(400).json({ error: 'Mint public key is required' });
    }

    // Call the staking pool initialization service
    const result = await initializeAccountsService(mintPublicKey);

    // Return the result
    if (result.success) {
      return res.status(200).json({ message: result.message });
    } else {
      return res.status(500).json({ error: result.message });
    }
  } catch (err) {
    console.error('Error in initialize staking pool controller:', err);
    return res.status(500).json({ error: 'Failed to initialize staking pool' });
  }
};


// Controller to handle staking requests
export const stakeTokens = async (req: Request, res: Response) => {
  console.log('Staking invoked');
  try {
    const { mintPublicKey, userPublicKey, amount, duration } = req.body;

    const mintAddress = new PublicKey(mintPublicKey);
    const userAddress = new PublicKey(userPublicKey);

    // Call the service function to create an unsigned transaction
    const result = await stakeTokenService(mintAddress, userAddress, amount, duration);

    if (result.success) {
      return res.status(200).json(result);
    } else {
      return res.status(500).json(result);
    }
  } catch (err) {
    console.error("Error in staking tokens:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};



export const unstakeTokens = async (req: Request, res: Response) => {
  try {
    const { mintPublicKey, userPublicKey, amount } = req.body;

    if (!mintPublicKey || !amount) {
      return res.status(400).json({ success: false, message: "Mint public key and amount are required" });
    }

    const mintAddress = new PublicKey(mintPublicKey);
    const userAddress = new PublicKey(userPublicKey);
    const result = await unstakeTokenService(mintAddress, userAddress, amount);

    if (result.success) {
      return res.status(200).json(result);
    } else {
      return res.status(500).json(result);
    }
  } catch (err) {
    console.error("Error in unstaking tokens:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};


// ✅ Controller function to fetch user staking account
export const fetchUserStakingAccount = async (req: Request, res: Response) => {
  try {
    const { userPublicKey } = req.params;

    if (!userPublicKey) {
      return res.status(400).json({ success: false, message: "User public key is required" });
    }

    const userPubkey = new PublicKey(userPublicKey);
    const result = await getUserStakingAccount(userPubkey);

    if (result.success) {
      return res.status(200).json(result);
    } else {
      return res.status(404).json(result);
    }
  } catch (err) {
    console.error("❌ Error in fetching user staking account:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};





// Controller function to create token account
export const createTokenAccountController = async (req: Request, res: Response) => {
  try {
    const { mintPublicKey, userPublicKey } = req.body;

    if (!mintPublicKey || !userPublicKey) {
      return res.status(400).json({
        success: false,
        message: "mintPublicKey and userPublicKey are required.",
      });
    }

    // Convert mintPublicKey and userPublicKey to PublicKey instances
    const mintPubkey = new PublicKey(mintPublicKey);
    const userPubkey = new PublicKey(userPublicKey);

    // Call the service function to create a token account transaction
    const result = await createAssociatedTokenAccount(mintPubkey, userPubkey);

    if (result.success) {
      return res.status(200).json(result);  // Return unsigned transaction to frontend
    } else {
      return res.status(500).json(result); // Error during transaction creation
    }
  } catch (err) {
    console.error("❌ Error in creating token account:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};
function createTokenAccount(mintPubkey: PublicKey, userPubkey: PublicKey) {
  throw new Error('Function not implemented.');
}



// Controller to handle creating ATA for testing purpose
export const createTokenAccountControllerWithKeypair = async (req: Request, res: Response) => {
  try {
    const { mintPublicKey, userPublicKey } = req.body;  // Expect mint and user public keys from the body

    // Validate the input
    if (!mintPublicKey || !userPublicKey) {
      return res.status(400).json({
        success: false,
        message: "Both mintPublicKey and userPublicKey are required."
      });
    }

    // Convert public keys from string to PublicKey objects
    const mintPubkey = new PublicKey(mintPublicKey);
    const userPubkey = new PublicKey(userPublicKey);

    // Call the service function to create the ATA using the user's keypair
    const result = await createAssociatedTokenAccountWithKeypair(mintPubkey, userPubkey);

    if (result.success) {
      return res.status(200).json({
        success: true,
        message: "Token account created successfully.",
        associatedTokenAddress: result.associatedTokenAddress.toBase58(),
        signature: result.signature
      });
    } else {
      return res.status(400).json({
        success: false,
        message: result.message
      });
    }
  } catch (err) {
    console.error("❌ Error in createTokenAccountController:", err);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error"
    });
  }
};

