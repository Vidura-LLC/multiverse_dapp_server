// src/utils/transactionTracker.ts
import { ref, set, get, update } from "firebase/database";
import { db } from "../config/firebase";
import { Connection, PublicKey } from "@solana/web3.js";

export interface PendingTransaction {
  id: string;
  type: 'CREATE_TOURNAMENT' | 'REGISTER_TOURNAMENT' | 'STAKE' | 'UNSTAKE' | 'DISTRIBUTE_REVENUE' | 'DISTRIBUTE_PRIZES' | 'INITIALIZE_PRIZE_POOL' | 'CREATE_ATA' | 'INITIALIZE_STAKING_POOL' | 'INITIALIZE_REVENUE_POOL';
  userId: string;
  tournamentId?: string;
  status: 'PENDING' | 'CONFIRMED' | 'FAILED' | 'EXPIRED';
  createdAt: number;
  expiresAt: number;
  serializedTransaction: string;
  expectedSignature?: string;
  metadata?: any;
}

export class TransactionTracker {
  private connection: Connection;
  private EXPIRY_TIME = 5 * 60 * 1000; // 5 minutes

  constructor(connection: Connection) {
    this.connection = connection;
  }

  // Store pending transaction
  async storePendingTransaction(
    txType: PendingTransaction['type'],
    userId: string,
    serializedTransaction: string,
    metadata?: any
  ): Promise<string> {
    const txId = `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = Date.now();

    const pendingTx: PendingTransaction = {
      id: txId,
      type: txType,
      userId,
      status: 'PENDING',
      createdAt: now,
      expiresAt: now + this.EXPIRY_TIME,
      serializedTransaction,
      metadata
    };

    await set(ref(db, `pendingTransactions/${txId}`), pendingTx);
    return txId;
  }

  // Update transaction status when signature is received
  async updateTransactionStatus(
    txId: string, 
    signature?: string, 
    status: 'CONFIRMED' | 'FAILED' | 'EXPIRED' = 'CONFIRMED'
  ): Promise<void> {
    const updates: any = {
      status,
      updatedAt: Date.now()
    };
    
    if (signature) {
      updates.expectedSignature = signature;
    }
    
    await update(ref(db, `pendingTransactions/${txId}`), updates);
  }

  // Verify transaction on-chain
  async verifyTransaction(signature: string): Promise<boolean> {
    try {
      const tx = await this.connection.getTransaction(signature, {
        commitment: 'confirmed'
      });
      return tx !== null && tx.meta?.err === null;
    } catch (error) {
      console.error('Error verifying transaction:', error);
      return false;
    }
  }

  // Get pending transaction
  async getPendingTransaction(txId: string): Promise<PendingTransaction | null> {
    const snapshot = await get(ref(db, `pendingTransactions/${txId}`));
    return snapshot.exists() ? snapshot.val() : null;
  }

  // Clean up expired transactions
  async cleanupExpiredTransactions(): Promise<void> {
    const now = Date.now();
    const pendingTxsRef = ref(db, 'pendingTransactions');
    const snapshot = await get(pendingTxsRef);
    
    if (snapshot.exists()) {
      const transactions = snapshot.val();
      const updates: any = {};
      
      Object.keys(transactions).forEach(txId => {
        const tx = transactions[txId];
        if (tx.status === 'PENDING' && tx.expiresAt < now) {
          updates[`${txId}/status`] = 'EXPIRED';
          updates[`${txId}/updatedAt`] = now;
        }
      });
      
      if (Object.keys(updates).length > 0) {
        await update(pendingTxsRef, updates);
      }
    }
  }
}

// Singleton instance
let trackerInstance: TransactionTracker | null = null;

export const getTransactionTracker = (): TransactionTracker => {
  if (!trackerInstance) {
    const { Connection, clusterApiUrl } = require("@solana/web3.js");
    const connection = new Connection(clusterApiUrl("devnet"), "confirmed");
    trackerInstance = new TransactionTracker(connection);
  }
  return trackerInstance;
};