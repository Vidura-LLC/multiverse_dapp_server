//src\gamehub\gamehubRoutes.ts

import { Router, RequestHandler, Request, Response } from 'express';
import { verifyUser } from './middleware';  // Import the verifyUser middleware
import { getActiveTournament, getAllGames, getTournamentById, getTournamentPoolController, getTournaments, registerForTournamentController, createTournament, getTournamentLeaderboardController, updateParticipantScoreController, getTournamentsByGameController, updateTournamentStatus, getPrizePoolController, getTotalPrizePoolsFundsController, getTotalTournamentPoolsFundsController, getTotalTournamentEntryFeesController, getTournamentsByAdmin, getTournamentLeaderboardAgainstAdminController, getAdminTournamentsLeaderboardsController } from './gamehubController';


const router = Router();

// Route to create tournament pool
router.post('/create-tournament', createTournament as unknown as RequestHandler);

// Route to update tournament status
router.post('/update-tournament-status', updateTournamentStatus as unknown as RequestHandler);

// Route to get tournament pool
router.post('/get-tournament-pool', getTournamentPoolController as unknown as RequestHandler);

// Prize pool routes
router.post('/get-prize-pool', getPrizePoolController as unknown as RequestHandler);
router.get('/prize-pools/total-funds', getTotalPrizePoolsFundsController as unknown as RequestHandler);

// Tournament pools aggregation (total pooled funds across tournaments)
router.get('/tournament-pools/total-funds', getTotalTournamentPoolsFundsController as unknown as RequestHandler);

// Tournament entry fees aggregation (from Firebase tournaments)
router.get('/tournaments/entry-fees', getTotalTournamentEntryFeesController as unknown as RequestHandler);


// Route for user authentication (verify the user with publicKey in headers)
router.post('/verify-user', verifyUser as unknown as RequestHandler, (req: Request, res: Response) => {
    // If the verifyUser middleware passes, this handler will be called
    res.status(200).json({
        message: 'User verified successfully'
    });
});

// Route to get all tournaments
router.get('/tournaments', getTournaments as unknown as RequestHandler);
router.get('/tournaments/:adminPublicKey', getTournamentsByAdmin as unknown as RequestHandler);

// Route to get tournament by ID
router.get('/tournament/:id', getTournamentById as unknown as RequestHandler);

// Route to get active tournament
router.get('/active-tournament', getActiveTournament as unknown as RequestHandler);

// Route to register for tournament
router.post('/user-participation', registerForTournamentController as unknown as RequestHandler);

// Route to get all games
router.get('/all-games', getAllGames as unknown as RequestHandler);

//Leaderboard Routes
// Route to get tournament leaderboard
router.get('/tournament-leaderboard/:id', getTournamentLeaderboardController as unknown as RequestHandler);

// Route to get tournament leaderboard against admin (single tournament)
router.get('/tournament-leaderboard-admin/:id', getTournamentLeaderboardAgainstAdminController as unknown as RequestHandler);

// Route to get aggregated leaderboards for all tournaments by admin
router.get('/admin-leaderboards/:adminPublicKey', getAdminTournamentsLeaderboardsController as unknown as RequestHandler);

// Route to update participant score (protected)
router.post('/score/update', verifyUser as unknown as RequestHandler, updateParticipantScoreController as unknown as RequestHandler);

// Route to get tournaments by game
router.get('/get-tournaments-by-game/:gameId/:tokenType', getTournamentsByGameController as unknown as RequestHandler);

// Define the route to fetch active tournament data
router.get("/active-tournament", verifyUser as unknown as RequestHandler, getActiveTournament as unknown as RequestHandler);


export default router;
