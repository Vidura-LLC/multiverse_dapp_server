//src/utils/transactionMonitor.ts
import { Connection, clusterApiUrl } from '@solana/web3.js';
import { getTransactionTracker } from './transactionTracker';
import { ref, get, update } from 'firebase/database';
import { db } from '../config/firebase';
import schedule from 'node-schedule';

export class TransactionMonitorService {
  private connection: Connection;
  private tracker: any;
  private isMonitoring: boolean = false;

  constructor() {
    this.connection = new Connection(clusterApiUrl("devnet"), "confirmed");
    this.tracker = getTransactionTracker();
  }

  // Start monitoring pending transactions
  startMonitoring() {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    console.log('🔍 Starting transaction monitoring service...');

    // Check for pending transactions every 30 seconds
    schedule.scheduleJob('*/30 * * * * *', async () => {
      await this.monitorPendingTransactions();
    });

    // Clean up expired transactions every 5 minutes
    schedule.scheduleJob('*/5 * * * *', async () => {
      await this.tracker.cleanupExpiredTransactions();
    });
  }

  // Stop monitoring
  stopMonitoring() {
    this.isMonitoring = false;
    schedule.gracefulShutdown();
    console.log('🛑 Transaction monitoring service stopped');
  }

  // Monitor all pending transactions
  private async monitorPendingTransactions() {
    try {
      const pendingTxsRef = ref(db, 'pendingTransactions');
      const snapshot = await get(pendingTxsRef);
      
      if (!snapshot.exists()) return;

      const transactions = snapshot.val();
      const pendingTxs = Object.values(transactions).filter((tx: any) => 
        tx.status === 'PENDING' && tx.expiresAt > Date.now()
      );

      console.log(`🔍 Monitoring ${pendingTxs.length} pending transactions`);

      // Check each pending transaction
      for (const tx of pendingTxs) {
        await this.checkTransactionStatus(tx as any);
      }
    } catch (error) {
      console.error('Error monitoring pending transactions:', error);
    }
  }

  // Check individual transaction status
  private async checkTransactionStatus(tx: any) {
    try {
      // If we have a signature, check if it's confirmed
      if (tx.expectedSignature) {
        const isConfirmed = await this.tracker.verifyTransaction(tx.expectedSignature);
        
        if (isConfirmed && tx.status !== 'CONFIRMED') {
          await this.tracker.updateTransactionStatus(tx.id, tx.expectedSignature, 'CONFIRMED');
          await this.handleConfirmedTransaction(tx);
          console.log(`✅ Transaction ${tx.id} confirmed automatically`);
        } else if (!isConfirmed && this.isTransactionExpired(tx)) {
          await this.tracker.updateTransactionStatus(tx.id, tx.expectedSignature, 'FAILED');
          await this.handleFailedTransaction(tx);
          console.log(`❌ Transaction ${tx.id} failed after expiry`);
        }
      } else if (this.isTransactionExpired(tx)) {
        // No signature received and transaction expired
        await this.tracker.updateTransactionStatus(tx.id, '', 'EXPIRED');
        await this.handleExpiredTransaction(tx);
        console.log(`⏰ Transaction ${tx.id} expired without signature`);
      }
    } catch (error) {
      console.error(`Error checking transaction ${tx.id}:`, error);
    }
  }

  private isTransactionExpired(tx: any): boolean {
    return Date.now() > tx.expiresAt;
  }

  private async handleConfirmedTransaction(tx: any) {
    // Auto-confirm transactions that were successful but frontend didn't report
    switch (tx.type) {
      case 'CREATE_TOURNAMENT':
        if (tx.metadata?.tournamentId) {
          await update(ref(db, `tournaments/${tx.metadata.tournamentId}`), {
            blockchainStatus: 'CONFIRMED',
            blockchainSignature: tx.expectedSignature,
            confirmedAt: Date.now(),
            autoConfirmed: true
          });
        }
        break;
      
      case 'REGISTER_TOURNAMENT':
        if (tx.metadata?.tournamentId && tx.userId) {
          await update(ref(db, `tournaments/${tx.metadata.tournamentId}/participants/${tx.userId}`), {
            blockchainStatus: 'CONFIRMED',
            registrationSignature: tx.expectedSignature,
            confirmedAt: Date.now(),
            autoConfirmed: true
          });
        }
        break;

      case 'DISTRIBUTE_REVENUE':
        if (tx.metadata?.tournamentId) {
          await update(ref(db, `tournaments/${tx.metadata.tournamentId}`), {
            distributionCompleted: true,
            distributionSignature: tx.expectedSignature,
            distributionTimestamp: Date.now(),
            status: 'Completed',
            autoConfirmed: true
          });
        }
        break;
    }
  }

  private async handleFailedTransaction(tx: any) {
    switch (tx.type) {
      case 'CREATE_TOURNAMENT':
        if (tx.metadata?.tournamentId) {
          await update(ref(db, `tournaments/${tx.metadata.tournamentId}`), {
            blockchainStatus: 'FAILED',
            error: 'Transaction failed or expired',
            failedAt: Date.now()
          });
        }
        break;
      
      case 'REGISTER_TOURNAMENT':
        if (tx.metadata?.tournamentId && tx.userId) {
          // Remove failed registration from participants
          const tournamentRef = ref(db, `tournaments/${tx.metadata.tournamentId}`);
          const tournamentSnapshot = await get(tournamentRef);
          
          if (tournamentSnapshot.exists()) {
            const tournament = tournamentSnapshot.val();
            const participants = tournament.participants || {};
            delete participants[tx.userId];
            
            await update(tournamentRef, {
              participants,
              participantsCount: Object.keys(participants).length
            });
          }
        }
        break;
    }
  }

  private async handleExpiredTransaction(tx: any) {
    // Handle transactions that expired without any signature
    await this.handleFailedTransaction(tx);
  }
}

// Service initialization
export const transactionMonitor = new TransactionMonitorService();

// Start monitoring when server starts
export const initializeTransactionMonitoring = () => {
  transactionMonitor.startMonitoring();
  
  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('Received SIGINT, shutting down transaction monitoring...');
    transactionMonitor.stopMonitoring();
    process.exit(0);
  });
};
