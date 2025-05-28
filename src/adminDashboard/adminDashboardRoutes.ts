import { Router, RequestHandler } from 'express';
import { checkPoolStatusController, initializeStakingPoolController } from './adminDashboardController';

const router = Router();

// Route for checking the staking pool status
router.get('/check-pool-status/:adminPublicKey', checkPoolStatusController as unknown as RequestHandler);

// Route for initializing the staking pool
router.post('/initialize-staking-pool', initializeStakingPoolController as unknown as RequestHandler);

export default router;