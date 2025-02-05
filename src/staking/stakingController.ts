//backend/src/staking/stakingController.ts


import { Request, Response } from 'express';
import { initializeAccountsService, stakeTokenService, unstakeTokenService, getUserStakingAccount } from './services';
import { PublicKey, Keypair } from '@solana/web3.js';



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


// Controller function to handle staking tokens
export const stakeTokens = async (req: Request, res: Response) => {
  console.log('stacking invoked')
  try {
    const { mintPublicKey, userPublicKey, amount } = req.body;

    if (!mintPublicKey || !userPublicKey || !amount) {
      return res.status(400).json({ success: false, message: "Mint public key, user public key, and amount are required" });
    }

    const mintAddress = new PublicKey(mintPublicKey);
    const userAddress = new PublicKey(userPublicKey); // Get user's wallet public key

    // Call the service function to stake tokens
    const result = await stakeTokenService(mintAddress, userAddress, amount);

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
    const result = await unstakeTokenService(mintAddress, userAddress , amount);

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



