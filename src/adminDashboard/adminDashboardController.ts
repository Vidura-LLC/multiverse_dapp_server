import { PublicKey } from '@solana/web3.js';
import { checkStakingPoolStatus, initializeStakingPoolService } from "./services";
import { Request, Response } from 'express';


// In adminDashboard/adminDashboardController.ts - Add this controller

export const checkStakingPoolStatusController = async (req: Request, res: Response) => {
    try {
        const { adminPublicKey } = req.body;

        // Validate the admin public key
        if (!adminPublicKey) {
            return res.status(400).json({
                success: false,
                error: 'Admin public key is required'
            });
        }

        // Validate public key format
        try {
            new PublicKey(adminPublicKey);
        } catch (error) {
            return res.status(400).json({
                success: false,
                error: 'Invalid admin public key format'
            });
        }

        // Check staking pool status
        const result = await checkStakingPoolStatus(new PublicKey(adminPublicKey));

        if (result.success) {
            return res.status(200).json({
                data: result
            });
        } 
    } catch (err) {
        console.error('Error in check staking pool status controller:', err);
        return res.status(500).json({
            success: false,
            error: 'Failed to check staking pool status',
            details: err.message
        });
    }
};

// Controller function for initializing the staking pool
export const initializeStakingPoolController = async (req: Request, res: Response) => {
    try {
        const { mintPublicKey, adminPublicKey } = req.body;  // Get mint address from request body

        // Validate the mint address
        if (!mintPublicKey || !adminPublicKey) {
            return res.status(400).json({ error: 'Mint public key is required' });
        }

        // Call the staking pool initialization service
        const result = await initializeStakingPoolService(new PublicKey(mintPublicKey), new PublicKey(adminPublicKey));

        // Return the result
        if (result.success) {
            return res.status(200).json({ data: result });
        } else {
            return res.status(500).json({ error: result.message });
        }
    } catch (err) {
        console.error('Error in initialize staking pool controller:', err);
        return res.status(500).json({ error: 'Failed to initialize staking pool' });
    }
  };

