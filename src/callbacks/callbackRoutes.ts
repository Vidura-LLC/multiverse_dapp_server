// src/callbacks/callbackRoutes.ts
import { Router, RequestHandler, Request, Response } from 'express';
import { 
  confirmTransactionController, 
  handleTransactionFailureController,
  getTransactionStatusController 
} from './callbackController';

const router = Router();

// Route for frontend to confirm successful transaction
router.post('/confirm-transaction', confirmTransactionController as unknown as RequestHandler);

// Route for frontend to report transaction failure
router.post('/transaction-failed', handleTransactionFailureController as unknown as RequestHandler);

// Route to check transaction status
router.get('/transaction-status/:txId', getTransactionStatusController as unknown as RequestHandler);

export default router;