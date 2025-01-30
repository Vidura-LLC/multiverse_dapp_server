import { Router, RequestHandler } from 'express';
import { initializeAccountsController, stakeTokens } from './/stakingController';

const router = Router();

// Route for initializing the staking pool
router.post('/initialize', initializeAccountsController as unknown as RequestHandler);

//Route to handle staking tokens
router.post('/stake', stakeTokens as unknown as RequestHandler);

export default router;
