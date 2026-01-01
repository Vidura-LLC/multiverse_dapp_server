import express, { Response, Request, Application } from "express";
import dotenv from "dotenv";
import bodyParser from "body-parser";
import cors from "cors";
import stakingRoutes from "./staking/stakingRoutes";
import gamehubRoutes from "./gamehub/gamehubRoutes";
import revenueRoutes from './revenue/revenueRoutes';
import webhooksRoutes from './webhooks/routes'
import adminDashboardRoutes from "./adminDashboard/adminDashboardRoutes";
import gameRoutes from "./game/routes";
import userRoutes from "./user/route";
import sdkRoutes from './sdk/sdkRoutes';
import analyticsRoutes from './analytics/analyticsRoutes';
import { checkAndUpdateTournamentStatuses } from "./gamehub/gamehubController";
import schedule from 'node-schedule';

// Load environment variables
dotenv.config();

const app: Application = express();

// Middleware
app.use(cors({
    origin: [process.env.CLIENT_URL, "http://localhost:3000", "*"], // Add allowed origins
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true
}));


app.use(bodyParser.json());

// Routes
app.use("/api/admin", adminDashboardRoutes);
app.use("/api/user", userRoutes);
app.use("/api/staking", stakingRoutes);
app.use("/api/gamehub/", gamehubRoutes);
app.use('/api/revenue/', revenueRoutes);
app.use('/api/webhooks/', webhooksRoutes)
app.use('/api/game/', gameRoutes)
app.use('/api/sdk/', sdkRoutes)
app.use('/api/analytics', analyticsRoutes)

// Server Port
const PORT = process.env.PORT || 5000;

app.get('/', (req: Request, res: Response): any => {
    return res.json({ message: "Server Up" });
})

// Start the server
app.listen(PORT, async () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    
    // Check and update tournament statuses on server startup
    console.log("🔄 Initializing tournament status checks...");
    await checkAndUpdateTournamentStatuses();
    
    // Schedule periodic checks every 5 minutes to catch any missed updates
    // Reduced frequency from 1 minute to 5 minutes for better performance
    // Scheduled jobs handle most updates, this is just a safety net
    schedule.scheduleJob('*/5 * * * *', async () => {
        await checkAndUpdateTournamentStatuses();
    });
    console.log("✅ Tournament status checker scheduled (runs every 5 minutes)");
});

export default app;
