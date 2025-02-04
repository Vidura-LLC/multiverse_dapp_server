import { Request, Response } from 'express';
import { initializeAccountsService, stakeTokenService } from './services';
import { PublicKey, Keypair } from '@solana/web3.js'



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



// // Controller function to handle unstaking tokens
// export const unstakeTokens = async (req: Request, res: Response) => {
//   try {
//     const { userPublicKey, mintPublicKey, amount } = req.body;

//     // Validate inputs
//     if (!userPublicKey || !mintPublicKey || !amount) {
//       return res.status(400).json({ success: false, message: 'User public key, mint public key, and amount are required' });
//     }

//     const userAddress = new PublicKey(userPublicKey);
//     const mintAddress = new PublicKey(mintPublicKey);

//     // Call the service function to unstake tokens
//     const result = await unstakeTokenService(userAddress, mintAddress, amount);

//     if (result.success) {
//       return res.status(200).json(result);
//     } else {
//       return res.status(500).json(result);
//     }
//   } catch (err) {
//     console.error('Error in unstaking tokens:', err);
//     return res.status(500).json({ success: false, message: 'Internal server error' });
//   }
// };