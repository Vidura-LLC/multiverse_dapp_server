"use strict";
//src\gamehub\gamehubRoutes.ts
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const middleware_1 = require("./middleware"); // Import the verifyUser middleware
const gamehubController_1 = require("./gamehubController");
const router = (0, express_1.Router)();
// Route to create tournament pool
router.post('/create-tournament', gamehubController_1.createTournament);
// Route to update tournament status
router.post('/update-tournament-status', gamehubController_1.updateTournamentStatus);
// Route to get tournament pool
router.post('/get-tournament-pool', gamehubController_1.getTournamentPoolController);
// Prize pool routes
router.post('/get-prize-pool', gamehubController_1.getPrizePoolController);
router.get('/prize-pools/total-funds', gamehubController_1.getTotalPrizePoolsFundsController);
// Tournament pools aggregation (total pooled funds across tournaments)
router.get('/tournament-pools/total-funds', gamehubController_1.getTotalTournamentPoolsFundsController);
// Tournament entry fees aggregation (from Firebase tournaments)
router.get('/tournaments/entry-fees', gamehubController_1.getTotalTournamentEntryFeesController);
// Route for user authentication (verify the user with publicKey in headers)
router.post('/verify-user', middleware_1.verifyUser, (req, res) => {
    // If the verifyUser middleware passes, this handler will be called
    res.status(200).json({
        message: 'User verified successfully'
    });
});
// Route to get all tournaments
router.get('/tournaments', gamehubController_1.getTournaments);
router.get('/tournaments/:adminPublicKey', gamehubController_1.getTournamentsByAdmin);
// Route to get tournament by ID
router.get('/tournament/:id', gamehubController_1.getTournamentById);
// Route to get active tournament
router.get('/active-tournament', gamehubController_1.getActiveTournament);
// Route to register for tournament (creates transaction)
router.post('/user-participation', gamehubController_1.registerForTournamentController);
// Route to confirm participation after transaction is verified
router.post('/confirm-participation', gamehubController_1.confirmParticipationController);
// Route to get all games
router.get('/all-games', gamehubController_1.getAllGames);
//Leaderboard Routes
// Route to get tournament leaderboard
router.get('/tournament-leaderboard/:id', gamehubController_1.getTournamentLeaderboardController);
// Route to get tournament leaderboard against admin (single tournament)
router.get('/tournament-leaderboard-admin/:id', gamehubController_1.getTournamentLeaderboardAgainstAdminController);
// Route to get aggregated leaderboards for all tournaments by admin
router.get('/admin-leaderboards/:adminPublicKey', gamehubController_1.getAdminTournamentsLeaderboardsController);
// Route to update participant score (protected)
router.post('/score/update', middleware_1.verifyUser, gamehubController_1.updateParticipantScoreController);
// Route to get tournaments by game
router.get('/get-tournaments-by-game/:gameId/:tokenType', gamehubController_1.getTournamentsByGameController);
// Define the route to fetch active tournament data
router.get("/active-tournament", middleware_1.verifyUser, gamehubController_1.getActiveTournament);
exports.default = router;
//# sourceMappingURL=gamehubRoutes.js.map