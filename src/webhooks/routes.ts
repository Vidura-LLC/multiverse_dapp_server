import { Router} from 'express';
import { clerkController } from './clerkController';

const router = Router();

router.post('/clerk', clerkController)

export default router;