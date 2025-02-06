import { Router, RequestHandler } from 'express';
import { initializeAccountsController, stakeTokens, unstakeTokens, fetchUserStakingAccount, createTokenAccountController, createTokenAccountControllerWithKeypair } from './stakingController';

const router = Router();

// Route for initializing the staking pool
router.post('/initialize', initializeAccountsController as unknown as RequestHandler);

//Route to handle staking tokens
router.post('/stake', stakeTokens as unknown as RequestHandler);

//Route to handle unstaking tokens
router.post('/unstake', unstakeTokens as unknown as RequestHandler);

// Route to get user staking account
router.get('/user-staked-amount/:userPublicKey', fetchUserStakingAccount as unknown as RequestHandler);

// Route to create ATA
router.post('/create-ATA', createTokenAccountController as unknown as RequestHandler);

// Route to create ATA with Keypair for testing purpose
router.post('/create-ATA-Keypair', createTokenAccountControllerWithKeypair as unknown as RequestHandler);


export default router;
