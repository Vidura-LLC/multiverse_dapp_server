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
// Route for user authentication (verify the user with publicKey in headers)
router.post('/verify-user', middleware_1.verifyUser, (req, res) => {
    // If the verifyUser middleware passes, this handler will be called
    res.status(200).json({
        message: 'User verified successfully'
    });
});
// Route to get all tournaments
router.get('/tournaments', gamehubController_1.getTournaments);
// Route to get tournament by ID
router.get('/tournament/:id', gamehubController_1.getTournamentById);
// Route to get active tournament
router.get('/active-tournament', gamehubController_1.getActiveTournament);
// Route to register for tournament
router.post('/user-participation', gamehubController_1.registerForTournamentController);
// Route to get all games
router.get('/all-games', gamehubController_1.getAllGames);
//Leaderboard Routes
// Route to get tournament leaderboard
router.get('/tournament-leaderboard/:id', gamehubController_1.getTournamentLeaderboardController);
// Route to update participant score (protected)
router.post('/score/update', middleware_1.verifyUser, gamehubController_1.updateParticipantScoreController);
// Route to get tournaments by game
router.get('/get-tournaments-by-game/:gameId', gamehubController_1.getTournamentsByGameController);
// Define the route to fetch active tournament data
router.get("/active-tournament", middleware_1.verifyUser, gamehubController_1.getActiveTournament);
exports.default = router;
//# sourceMappingURL=gamehubRoutes.js.map