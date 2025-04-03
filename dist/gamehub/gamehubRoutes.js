"use strict";
//src\gamehub\gamehubRoutes.ts
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const middleware_1 = require("./middleware"); // Import the verifyUser middleware
const gamehubController_1 = require("./gamehubController");
const router = (0, express_1.Router)();
// Route to create tournament pool
router.post('/create-tournament', gamehubController_1.createTournament);
router.post('/get-tournament-pool', gamehubController_1.getTournamentPoolController);
// Route to create tournament
router.post('/create-tournament-pool', gamehubController_1.initializeTournamentPoolController);
// Route for registering a user for a tournament
router.post('/register-for-tournament', gamehubController_1.registerForTournamentController);
// Route for user authentication (verify the user with publicKey in headers)
router.post('/verify-user', middleware_1.verifyUser, (req, res) => {
    // If the verifyUser middleware passes, this handler will be called
    res.status(200).json({
        message: 'User verified successfully'
    });
});
router.get('/tournaments', gamehubController_1.getTournaments);
router.get('/tournament/:id', gamehubController_1.getTournamentById);
router.get('/active-tournament', gamehubController_1.getActiveTournament);
router.post('/user-participation', gamehubController_1.registerForTournamentController);
router.get('/all-games', gamehubController_1.getAllGames);
//Leaderboard Routes
// Route to get tournament leaderboard
router.get('/tournament-leaderboard/:id', gamehubController_1.getTournamentLeaderboardController);
// Route to update participant score (protected)
router.post('/score/update', middleware_1.verifyUser, gamehubController_1.updateParticipantScoreController);
// Route to get tournaments by game
router.get('/get-tournaments-by-game/:gameId', gamehubController_1.getTournamentsByGameController);
exports.default = router;
// Define the route to fetch active tournament data
router.get("/active-tournament", middleware_1.verifyUser, gamehubController_1.getActiveTournament);
//# sourceMappingURL=gamehubRoutes.js.map