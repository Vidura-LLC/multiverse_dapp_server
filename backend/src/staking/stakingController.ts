//backend/src/staking/stakingController.ts


import { Request, Response } from 'express';
import { initializeAccountsService, stakeTokenService, unstakeTokenService, getUserStakingAccount, getTokenMetadata } from './services';
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
  try {
    const { mintPublicKey, amount } = req.body;

    if (!mintPublicKey || !amount) {
      return res.status(400).json({ success: false, message: "Mint public key and amount are required" });
    }

    const mintAddress = new PublicKey(mintPublicKey);

    // Call the service function to stake tokens
    const result = await stakeTokenService(mintAddress, amount);
    
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
    const { mintPublicKey, amount } = req.body;

    if (!mintPublicKey || !amount) {
      return res.status(400).json({ success: false, message: "Mint public key and amount are required" });
    }

    const mintAddress = new PublicKey(mintPublicKey);
    const result = await unstakeTokenService(mintAddress, amount);

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



// ✅ Controller to Fetch Token Metadata
export const fetchTokenMetadata = async (req: Request, res: Response) => {
  try {
    const { mintAddress } = req.params;

    if (!mintAddress) {
      return res.status(400).json({ success: false, message: "Mint address is required" });
    }

    const mintPublicKey = new PublicKey(mintAddress);
    const result = await getTokenMetadata(mintPublicKey);

    if (result.success) {
      return res.status(200).json(result);
    } else {
      return res.status(404).json(result);
    }
  } catch (err) {
    console.error("❌ Error fetching token metadata:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};
