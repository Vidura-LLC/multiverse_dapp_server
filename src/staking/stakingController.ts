//backend/src/staking/stakingController.ts

import { Request, Response } from 'express';
import { unstakeTokenService, getUserStakingAccount, stakeTokenService, getProgram, claimRewardsService, accrueRewardsService } from './services';
import { PublicKey } from '@solana/web3.js';
import { StakingPoolAccount } from "../adminDashboard/services";
import {TokenType } from "../utils/getPDAs";



// Controller to handle staking requests
export const stakeTokensController = async (req: Request, res: Response) => {
  console.log('Staking invoked');
  try {
    const { mintPublicKey, userPublicKey, amount, lockDuration, adminPublicKey, tokenType } = req.body;

    // Validate required fields
    if (!mintPublicKey || !userPublicKey || !amount || !lockDuration || !adminPublicKey || tokenType === undefined || tokenType === null) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: mintPublicKey, userPublicKey, amount, lockDuration, adminPublicKey, and tokenType are required"
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
      adminPublicKey,
      tokenType
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

    const tt = Number(tokenType);
    if (tt !== TokenType.SPL && tt !== TokenType.SOL) {
      return res.status(400).json({ success: false, message: 'tokenType must be 0 (SPL) or 1 (SOL)' });
    }

    // Call the service function to create an unsigned transaction
    const result = await stakeTokenService(
      new PublicKey(mintPublicKey),
      new PublicKey(userPublicKey),
      amount,
      lockDuration,
      new PublicKey(adminPublicKey),
      tt as TokenType
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
    const { userPublicKey, adminPublicKey, tokenType } = req.body;

    if (!userPublicKey || !adminPublicKey || !tokenType) {
      return res.status(400).json({ success: false, message: 'userPublicKey, adminPublicKey, and tokenType are required' });
    }

    const result = await claimRewardsService(new PublicKey(userPublicKey), new PublicKey(adminPublicKey), tokenType as unknown as TokenType);
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
    const { userPublicKey, adminPublicKey, tokenType, mintPublicKey } = req.body;

    // Validate required fields
    if (!userPublicKey || !adminPublicKey || tokenType === undefined || tokenType === null || !mintPublicKey) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: userPublicKey, adminPublicKey, tokenType and mintPublicKey are required"
      });
    }

    // Validate PublicKey formats
    try {
      new PublicKey(userPublicKey);
      new PublicKey(adminPublicKey);
      new PublicKey(mintPublicKey);
    } catch (pubkeyError) {
      return res.status(400).json({
        success: false,
        message: "Invalid PublicKey format provided"
      });
    }

    const tt = Number(tokenType);
    if (tt !== TokenType.SPL && tt !== TokenType.SOL) {
      return res.status(400).json({ success: false, message: 'tokenType must be 0 (SPL) or 1 (SOL)' });
    }

    const result = await unstakeTokenService(new PublicKey(mintPublicKey), new PublicKey(userPublicKey), new PublicKey(adminPublicKey), tt as TokenType);

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
    const { tokenType, adminPublicKey } = req.query;

    if (!userPublicKey || !tokenType || !adminPublicKey) {
      return res.status(400).json({ success: false, message: "User public key is required" });
    }

    const userPubkey = new PublicKey(userPublicKey);
    const result = await getUserStakingAccount(userPubkey, new PublicKey(adminPublicKey), tokenType as unknown as TokenType);

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
    const { userPublicKey, adminPublicKey, tokenType } = req.body;

    if (!userPublicKey || !adminPublicKey || !tokenType) {
      return res.status(400).json({
        success: false,
        message: "userPublicKey, adminPublicKey, and tokenType are required."
      });
    }

    const userPubkey = new PublicKey(userPublicKey);
    const adminPubkey = new PublicKey(adminPublicKey);

    const result = await accrueRewardsService(userPubkey, adminPubkey, tokenType as unknown as TokenType);

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


