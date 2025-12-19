// src/sdk/scoreService.ts

import { ref, get, set } from 'firebase/database';
import { db } from '../config/firebase';
import { TokenType } from '../utils/getPDAs';
import { Tournament } from '../gamehub/gamehubController';

export interface SubmitScoreParams {
  tournamentId: string;
  userPublicKey: string;
  score: number;
  tokenType: TokenType;
  gameId: string; // From SDK auth middleware
}

export interface SubmitScoreResult {
  success: boolean;
  message: string;
  data?: {
    tournamentId: string;
    userPublicKey: string;
    score: number;
    rank?: number;
  };
  errorCode?: SubmitScoreErrorCode;
}

export type SubmitScoreErrorCode =
  | 'INVALID_TOKEN_TYPE'
  | 'TOURNAMENT_NOT_FOUND'
  | 'WRONG_GAME'
  | 'TOURNAMENT_NOT_ACTIVE'
  | 'NOT_REGISTERED'
  | 'ALREADY_PLAYED'
  | 'INVALID_SCORE'
  | 'INTERNAL_ERROR';

export async function submitScore(params: SubmitScoreParams): Promise<SubmitScoreResult> {
  const { tournamentId, userPublicKey, score, tokenType, gameId } = params;

  try {
    const tt = Number(tokenType);
    if (tt !== TokenType.SPL && tt !== TokenType.SOL) {
      return {
        success: false,
        message: 'tokenType must be 0 (SPL) or 1 (SOL)',
        errorCode: 'INVALID_TOKEN_TYPE',
      };
    }

    if (typeof score !== 'number' || Number.isNaN(score) || score < 0) {
      return {
        success: false,
        message: 'Score must be a non-negative number',
        errorCode: 'INVALID_SCORE',
      };
    }

    const tournamentRef = ref(db, `tournaments/${tt}/${tournamentId}`);
    const snapshot = await get(tournamentRef);

    if (!snapshot.exists()) {
      return {
        success: false,
        message: 'Tournament not found',
        errorCode: 'TOURNAMENT_NOT_FOUND',
      };
    }

    const tournament = snapshot.val() as Tournament;

    // Verify tournament belongs to this game
    if (tournament.gameId !== gameId) {
      return {
        success: false,
        message: 'Tournament does not belong to this game',
        errorCode: 'WRONG_GAME',
      };
    }

    // Verify tournament is active
    if (tournament.status !== 'Active') {
      return {
        success: false,
        message: `Tournament is not active. Current status: ${tournament.status}`,
        errorCode: 'TOURNAMENT_NOT_ACTIVE',
      };
    }

    const participants = (tournament as any).participants || {};
    const participant = participants[userPublicKey];

    if (!participant) {
      return {
        success: false,
        message: 'You are not registered in this tournament',
        errorCode: 'NOT_REGISTERED',
      };
    }

    // Treat missing hasPlayed field as false for backward compatibility
    if (participant.hasPlayed === true) {
      return {
        success: false,
        message: 'You have already submitted a score for this tournament',
        errorCode: 'ALREADY_PLAYED',
      };
    }

    const now = new Date().toISOString();

    const updatedParticipant = {
      // Preserve any existing participant fields such as joinedAt
      ...participant,
      score,
      hasPlayed: true,
      scoreSubmittedAt: now,
    };

    const participantRef = ref(db, `tournaments/${tt}/${tournamentId}/participants/${userPublicKey}`);
    await set(participantRef, updatedParticipant);

    return {
      success: true,
      message: 'Score submitted successfully',
      data: {
        tournamentId,
        userPublicKey,
        score,
      },
    };
  } catch (error) {
    console.error('[ScoreService] Error submitting score:', error);
    return {
      success: false,
      message: 'Internal server error',
      errorCode: 'INTERNAL_ERROR',
    };
  }
}


