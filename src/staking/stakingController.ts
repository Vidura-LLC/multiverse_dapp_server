//backend/src/staking/stakingController.ts

import { Request, Response } from 'express';
import { unstakeTokenService, getUserStakingAccount, stakeTokenService, getProgram, claimRewardsService, accrueRewardsService } from './services';
import { PublicKey } from '@solana/web3.js';
import { StakingPoolAccount } from "../adminDashboard/services";



// Controller to handle staking requests
export const stakeTokensController = async (req: Request, res: Response) => {
  console.log('Staking invoked');
  try {
    const { mintPublicKey, userPublicKey, amount, lockDuration, adminPublicKey } = req.body;

    // Validate required fields
    if (!mintPublicKey || !userPublicKey || !amount || !lockDuration || !adminPublicKey) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: mintPublicKey, userPublicKey, amount, lockDuration, and adminPublicKey are required"
      });
    }

    // Validate types
    if (typeof amount !== 'number' || typeof lockDuration !== 'number') {
      return res.status(400).json({
        success: false,
        message: "Amount and lockDuration must be numbers"
      });
    }

    // Validate positive values
    if (amount <= 0 || lockDuration <= 0) {
      return res.status(400).json({
        success: false,
        message: "Amount and lockDuration must be positive numbers"
      });
    }

    console.log('Request body validation passed:', {
      mintPublicKey,
      userPublicKey,
      amount,
      lockDuration,
      adminPublicKey
    });

    // Validate PublicKey formats
    try {
      new PublicKey(mintPublicKey);
      new PublicKey(userPublicKey);
      new PublicKey(adminPublicKey);
    } catch (pubkeyError) {
      return res.status(400).json({
        success: false,
        message: "Invalid PublicKey format provided"
      });
    }

    // Call the service function to create an unsigned transaction
    const result = await stakeTokenService(
      new PublicKey(mintPublicKey),
      new PublicKey(userPublicKey),
      amount,
      lockDuration,
      new PublicKey(adminPublicKey)
    );

    if (result.success) {
      return res.status(200).json(result);
    } else {
      return res.status(500).json(result);
    }
  } catch (err) {
    console.error("Error in staking tokens:", err);
    return res.status(500).json({ 
      success: false, 
      message: `Internal server error: ${err.message || err}` 
    });
  }
};

// ✅ Controller to claim staking rewards
export const claimRewardsController = async (req: Request, res: Response) => {
  try {
    const { userPublicKey, adminPublicKey } = req.body;

    if (!userPublicKey || !adminPublicKey) {
      return res.status(400).json({ success: false, message: 'userPublicKey and adminPublicKey are required' });
    }

    const result = await claimRewardsService(new PublicKey(userPublicKey), new PublicKey(adminPublicKey));
    if (result.success) {
      return res.status(200).json(result);
    } else {
      return res.status(500).json(result);
    }
  } catch (err) {
    console.error('❌ Error in claimRewardsController:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const unstakeTokensController = async (req: Request, res: Response) => {
  try {
    const { userPublicKey, adminPublicKey } = req.body;

    // Validate required fields
    if (!userPublicKey || !adminPublicKey) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: userPublicKey and adminPublicKey are required"
      });
    }

    // Validate PublicKey formats
    try {
      new PublicKey(userPublicKey);
      new PublicKey(adminPublicKey);
    } catch (pubkeyError) {
      return res.status(400).json({
        success: false,
        message: "Invalid PublicKey format provided"
      });
    }

    // Get the mint public key from the staking pool
    const { program } = getProgram();
    const [stakingPoolPublicKey] = PublicKey.findProgramAddressSync(
      [Buffer.from("staking_pool"), new PublicKey(adminPublicKey).toBuffer()],
      program.programId
    );

    // Fetch the staking pool data to get the mint public key
    const stakingPoolData = await program.account.stakingPool.fetch(stakingPoolPublicKey) as StakingPoolAccount;
    const mintPublicKey = stakingPoolData.mint;

    const result = await unstakeTokenService(mintPublicKey, new PublicKey(userPublicKey), new PublicKey(adminPublicKey));

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
export const fetchUserStakingAccountController = async (req: Request, res: Response) => {
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
      return res.status(200).json(result);
    }
  } catch (err) {
    console.error("❌ Error in fetching user staking account:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// Controller function to accrue rewards for a specific user
export const accrueRewardsController = async (req: Request, res: Response) => {
  try {
    const { userPublicKey, adminPublicKey } = req.body;

    if (!userPublicKey || !adminPublicKey) {
      return res.status(400).json({
        success: false,
        message: "userPublicKey and adminPublicKey are required."
      });
    }

    const userPubkey = new PublicKey(userPublicKey);
    const adminPubkey = new PublicKey(adminPublicKey);

    const result = await accrueRewardsService(userPubkey, adminPubkey);

    if (result.success) {
      return res.status(200).json(result);
    } else {
      return res.status(400).json(result);
    }
  } catch (err) {
    console.error("❌ Error in accruing rewards:", err);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error"
    });
  }
};


