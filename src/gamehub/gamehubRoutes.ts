//src\gamehub\gamehubRoutes.ts

import { Router, RequestHandler, Request, Response } from 'express';
import { verifyUser } from './middleware';  // Import the verifyUser middleware
import {
  initializeTournamentPoolController,
  getActiveTournament,
  getAllGames,
  getTournamentById,
  getTournamentPoolController,
  getTournaments,
  registerForTournamentController,
  createTournament,
  getTournamentLeaderboardController,
  updateParticipantScoreController,
  getTournamentsByGameController,
  startTournamentController,
  endTournamentController
} from './gamehubController';
import { deleteTournament } from './gamehubController';
const router = Router();

// Route to create tournament pool
router.post('/create-tournament', createTournament as unknown as RequestHandler);

router.post('/get-tournament-pool', getTournamentPoolController as unknown as RequestHandler);

// Route to create tournament
router.post('/create-tournament-pool', initializeTournamentPoolController as unknown as RequestHandler);

// Route for registering a user for a tournament
router.post('/register-for-tournament', registerForTournamentController as unknown as RequestHandler);

// Route for user authentication (verify the user with publicKey in headers)
router.post('/verify-user', verifyUser as unknown as RequestHandler, ((req: Request, res: Response) => {
    // If the verifyUser middleware passes, this handler will be called
    res.status(200).json({
        message: 'User verified successfully'
    });
}) as unknown as RequestHandler);

router.get('/tournaments', getTournaments as unknown as RequestHandler);

router.get('/tournament/:id', getTournamentById as unknown as RequestHandler);

router.get('/active-tournament', getActiveTournament as unknown as RequestHandler);

router.post('/user-participation', registerForTournamentController as unknown as RequestHandler);

router.get('/all-games', getAllGames as unknown as RequestHandler);

//Leaderboard Routes
// Route to get tournament leaderboard
router.get('/tournament-leaderboard/:id', getTournamentLeaderboardController as unknown as RequestHandler);

// Route to update participant score (protected)
router.post('/score/update', verifyUser as unknown as RequestHandler, updateParticipantScoreController as unknown as RequestHandler);

// Route to get tournaments by game
router.get('/get-tournaments-by-game/:gameId', getTournamentsByGameController as unknown as RequestHandler);

// Tournament routes
router.post('/tournaments', createTournament as unknown as RequestHandler);
router.get('/tournaments/active', getActiveTournament as unknown as RequestHandler);
router.get('/tournaments', getTournaments as unknown as RequestHandler);
router.get('/tournaments/:id', getTournamentById as unknown as RequestHandler);
router.post('/tournaments/:tournamentId/start', startTournamentController as unknown as RequestHandler);
router.post('/tournaments/:tournamentId/end', endTournamentController as unknown as RequestHandler);
router.delete('/tournaments/:tournamentId/delete', deleteTournament as unknown as RequestHandler);

// Tournament pool routes
router.post('/tournament-pool/initialize', initializeTournamentPoolController as unknown as RequestHandler);
router.post('/tournament-pool/register', registerForTournamentController as unknown as RequestHandler);
router.get('/tournament-pool', getTournamentPoolController as unknown as RequestHandler);

// Game-specific tournament routes
router.get('/games/:gameId/tournaments', getTournamentsByGameController as unknown as RequestHandler);

export default router;