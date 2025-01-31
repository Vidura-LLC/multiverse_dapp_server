//backend/src/staking/stakingRoutes.ts


import { Router, RequestHandler } from 'express';
import { initializeAccountsController, stakeTokens, unstakeTokens, fetchUserStakingAccount } from './/stakingController';

const router = Router();

// Route for initializing the staking pool
router.post('/initialize', initializeAccountsController as unknown as RequestHandler);

//Route to handle staking tokens
router.post('/stake', stakeTokens as unknown as RequestHandler);


//Route to handle unstaking tokens
router.post('/unstake', unstakeTokens as unknown as RequestHandler);

// Route to get user staking account
router.get('/user-staking/:userPublicKey', fetchUserStakingAccount as unknown as RequestHandler);


// ✅ Route to get token metadata
// router.get("/get-token-metadata/:mintAddress", fetchTokenMetadata as unknown as RequestHandler);

export default router;
