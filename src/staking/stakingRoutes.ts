import { Router, RequestHandler } from 'express';
import { stakeTokensController, unstakeTokensController, fetchUserStakingAccountController, claimRewardsController, accrueRewardsController } from './stakingController';

const router = Router();


//Route to handle staking tokens
router.post('/stake', stakeTokensController as unknown as RequestHandler);

//Route to handle unstaking tokens
router.post('/unstake', unstakeTokensController as unknown as RequestHandler);

// Route to claim rewards
router.post('/claim-rewards', claimRewardsController as unknown as RequestHandler);

// Route to get user staking account
router.get('/user-staked-amount/:userPublicKey', fetchUserStakingAccountController as unknown as RequestHandler);

// Route to accrue rewards for a specific user
router.post('/accrue-rewards', accrueRewardsController as unknown as RequestHandler);


export default router;
