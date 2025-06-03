// Updated src/callbacks/callbackController.ts - Add admin transaction handling

import { Request, Response } from 'express';
import { getTransactionTracker } from '../utils/transactionTracker';
import { ref, update, get } from 'firebase/database';
import { db } from '../config/firebase';

const tracker = getTransactionTracker();

export const confirmTransactionController = async (req: Request, res: Response) => {
  try {
    const { transactionId, signature, userPublicKey } = req.body;

    if (!transactionId || !signature) {
      return res.status(400).json({
        success: false,
        message: "Transaction ID and signature are required"  
      });
    }

    // Get the pending transaction
    const pendingTx = await tracker.getPendingTransaction(transactionId);
    if (!pendingTx) {
      return res.status(404).json({
        success: false,
        message: "Transaction not found or expired"
      });
    }

    // Verify the transaction on-chain
    const isVerified = await tracker.verifyTransaction(signature);
    
    if (!isVerified) {
      await tracker.updateTransactionStatus(transactionId, signature, 'FAILED');
      return res.status(400).json({
        success: false,
        message: "Transaction verification failed"
      });
    }

    // Update transaction status
    await tracker.updateTransactionStatus(transactionId, signature, 'CONFIRMED');

    // Handle post-confirmation logic based on transaction type
    await handlePostConfirmation(pendingTx, signature);

    return res.status(200).json({
      success: true,
      message: "Transaction confirmed successfully",
      signature
    });

  } catch (error) {
    console.error('Error in confirmTransactionController:', error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

export const handleTransactionFailureController = async (req: Request, res: Response) => {
  try {
    const { transactionId, error, userPublicKey } = req.body;

    if (!transactionId) {
      return res.status(400).json({
        success: false,
        message: "Transaction ID is required"
      });
    }

    // Update transaction status to failed
    await tracker.updateTransactionStatus(transactionId, '', 'FAILED');

    // Handle cleanup or rollback logic
    await handleTransactionFailure(transactionId, error);

    return res.status(200).json({
      success: true,
      message: "Transaction failure recorded"
    });

  } catch (error) {
    console.error('Error in handleTransactionFailureController:', error);
    return res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};

export const getTransactionStatusController = async (req: Request, res: Response) => {
  try {
    const { txId } = req.params;

    const pendingTx = await tracker.getPendingTransaction(txId);
    if (!pendingTx) {
      return res.status(404).json({
        success: false,
        message: "Transaction not found"
      });
    }

    return res.status(200).json({
      success: true,
      transaction: {
        id: pendingTx.id,
        type: pendingTx.type,
        status: pendingTx.status,
        createdAt: new Date(pendingTx.createdAt).toISOString(),
        expiresAt: new Date(pendingTx.expiresAt).toISOString(),
        signature: pendingTx.expectedSignature,
        metadata: pendingTx.metadata
      }
    });

  } catch (error) {
    console.error('Error in getTransactionStatusController:', error);
    return res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};

// 🔹 UPDATED: Helper functions for post-confirmation actions (added admin transaction types)
async function handlePostConfirmation(pendingTx: any, signature: string) {
  console.log(`🔄 Processing post-confirmation for ${pendingTx.type}...`);
  
  switch (pendingTx.type) {
    case 'CREATE_TOURNAMENT':
      if (pendingTx.metadata?.tournamentId) {
        await update(ref(db, `tournaments/${pendingTx.metadata.tournamentId}`), {
          blockchainStatus: 'CONFIRMED',
          blockchainSignature: signature,
          confirmedAt: Date.now(),
          status: 'Not Started' // Ready to start at scheduled time
        });
        console.log(`✅ Tournament ${pendingTx.metadata.tournamentId} confirmed on blockchain`);
      }
      break;
    
    case 'REGISTER_TOURNAMENT':
      if (pendingTx.metadata?.tournamentId && pendingTx.userId) {
        await update(ref(db, `tournaments/${pendingTx.metadata.tournamentId}/participants/${pendingTx.userId}`), {
          blockchainStatus: 'CONFIRMED',
          registrationSignature: signature,
          confirmedAt: Date.now(),
          registrationComplete: true
        });
        console.log(`✅ User ${pendingTx.userId} registration confirmed for tournament ${pendingTx.metadata.tournamentId}`);
      }
      break;
    
    case 'STAKE':
      if (pendingTx.userId) {
        console.log(`✅ Staking confirmed for user ${pendingTx.userId}`);
        // Could update user staking status in Firebase if needed
      }
      break;
    
    case 'UNSTAKE':
      if (pendingTx.userId) {
        console.log(`✅ Unstaking confirmed for user ${pendingTx.userId}`);
      }
      break;
    
    case 'DISTRIBUTE_REVENUE':
      if (pendingTx.metadata?.tournamentId) {
        await update(ref(db, `tournaments/${pendingTx.metadata.tournamentId}`), {
          distributionCompleted: true,
          distributionSignature: signature,
          distributionTimestamp: Date.now(),
          status: 'Completed'
        });
        console.log(`✅ Revenue distribution confirmed for tournament ${pendingTx.metadata.tournamentId}`);
      }
      break;
    
    case 'DISTRIBUTE_PRIZES':
      if (pendingTx.metadata?.tournamentId) {
        await update(ref(db, `tournaments/${pendingTx.metadata.tournamentId}`), {
          prizesDistributed: true,
          prizesDistributionSignature: signature,
          prizesDistributionTimestamp: Date.now()
        });
        console.log(`✅ Prize distribution confirmed for tournament ${pendingTx.metadata.tournamentId}`);
      }
      break;
    
    case 'INITIALIZE_PRIZE_POOL':
      if (pendingTx.metadata?.tournamentId) {
        await update(ref(db, `tournaments/${pendingTx.metadata.tournamentId}`), {
          prizePoolInitialized: true,
          prizePoolSignature: signature,
          prizePoolInitializedAt: Date.now()
        });
        console.log(`✅ Prize pool initialized for tournament ${pendingTx.metadata.tournamentId}`);
      }
      break;
    
    // 🔹 NEW: Admin transaction confirmations
    case 'INITIALIZE_STAKING_POOL':
      // Create a record in admin actions or update admin dashboard status
      await update(ref(db, `adminActions/${pendingTx.userId}`), {
        stakingPoolInitialized: true,
        stakingPoolSignature: signature,
        stakingPoolInitializedAt: Date.now(),
        stakingPoolAddress: pendingTx.metadata?.stakingPoolAddress,
        poolEscrowAddress: pendingTx.metadata?.poolEscrowAddress
      });
      console.log(`✅ Staking pool initialized by admin ${pendingTx.userId}`);
      break;
    
    case 'INITIALIZE_REVENUE_POOL':
      // Create a record in admin actions or update admin dashboard status  
      await update(ref(db, `adminActions/${pendingTx.userId}`), {
        revenuePoolInitialized: true,
        revenuePoolSignature: signature,
        revenuePoolInitializedAt: Date.now(),
        revenuePoolAddress: pendingTx.metadata?.revenuePoolAddress,
        revenueEscrowAddress: pendingTx.metadata?.revenueEscrowAddress
      });
      console.log(`✅ Revenue pool initialized by admin ${pendingTx.userId}`);
      break;
  }
}

// 🔹 UPDATED: Handle transaction failures (added admin transaction types)
async function handleTransactionFailure(transactionId: string, error: any) {
  const pendingTx = await tracker.getPendingTransaction(transactionId);
  if (!pendingTx) return;

  console.log(`❌ Processing transaction failure for ${pendingTx.type}...`);

  switch (pendingTx.type) {
    case 'CREATE_TOURNAMENT':
      if (pendingTx.metadata?.tournamentId) {
        await update(ref(db, `tournaments/${pendingTx.metadata.tournamentId}`), {
          blockchainStatus: 'FAILED',
          error: error?.message || 'Transaction failed',
          failedAt: Date.now(),
          status: 'Failed'
        });
      }
      break;
    
    case 'REGISTER_TOURNAMENT':
      if (pendingTx.metadata?.tournamentId && pendingTx.userId) {
        // Remove failed registration from participants
        const tournamentRef = ref(db, `tournaments/${pendingTx.metadata.tournamentId}`);
        const tournamentSnapshot = await get(tournamentRef);
        
        if (tournamentSnapshot.exists()) {
          const tournament = tournamentSnapshot.val();
          const participants = tournament.participants || {};
          delete participants[pendingTx.userId];
          
          await update(tournamentRef, {
            participants,
            participantsCount: Object.keys(participants).length
          });
        }
      }
      break;
    
    case 'DISTRIBUTE_REVENUE':
      if (pendingTx.metadata?.tournamentId) {
        await update(ref(db, `tournaments/${pendingTx.metadata.tournamentId}`), {
          distributionFailed: true,
          distributionError: error?.message || 'Distribution failed',
          distributionFailedAt: Date.now()
        });
      }
      break;
    
    // 🔹 NEW: Admin transaction failures
    case 'INITIALIZE_STAKING_POOL':
      await update(ref(db, `adminActions/${pendingTx.userId}`), {
        stakingPoolInitializationFailed: true,
        stakingPoolError: error?.message || 'Staking pool initialization failed',
        stakingPoolFailedAt: Date.now()
      });
      console.log(`❌ Staking pool initialization failed for admin ${pendingTx.userId}`);
      break;
    
    case 'INITIALIZE_REVENUE_POOL':
      await update(ref(db, `adminActions/${pendingTx.userId}`), {
        revenuePoolInitializationFailed: true,
        revenuePoolError: error?.message || 'Revenue pool initialization failed',
        revenuePoolFailedAt: Date.now()
      });
      console.log(`❌ Revenue pool initialization failed for admin ${pendingTx.userId}`);
      break;
  }
}