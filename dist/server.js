"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const dotenv_1 = __importDefault(require("dotenv"));
const body_parser_1 = __importDefault(require("body-parser"));
const cors_1 = __importDefault(require("cors"));
const stakingRoutes_1 = __importDefault(require("./staking/stakingRoutes"));
const gamehubRoutes_1 = __importDefault(require("./gamehub/gamehubRoutes"));
const revenueRoutes_1 = __importDefault(require("./revenue/revenueRoutes"));
const routes_1 = __importDefault(require("./webhooks/routes"));
const adminDashboardRoutes_1 = __importDefault(require("./adminDashboard/adminDashboardRoutes"));
const routes_2 = __importDefault(require("./game/routes"));
const route_1 = __importDefault(require("./user/route"));
const sdkRoutes_1 = __importDefault(require("./sdk/sdkRoutes"));
const analyticsRoutes_1 = __importDefault(require("./analytics/analyticsRoutes"));
const gamehubController_1 = require("./gamehub/gamehubController");
const node_schedule_1 = __importDefault(require("node-schedule"));
// Load environment variables
dotenv_1.default.config();
const app = (0, express_1.default)();
// Middleware
app.use((0, cors_1.default)({
    origin: [process.env.CLIENT_URL, "http://localhost:3000", "*"], // Add allowed origins
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true
}));
app.use(body_parser_1.default.json());
// Routes
app.use("/api/admin", adminDashboardRoutes_1.default);
app.use("/api/user", route_1.default);
app.use("/api/staking", stakingRoutes_1.default);
app.use("/api/gamehub/", gamehubRoutes_1.default);
app.use('/api/revenue/', revenueRoutes_1.default);
app.use('/api/webhooks/', routes_1.default);
app.use('/api/game/', routes_2.default);
app.use('/api/sdk/', sdkRoutes_1.default);
app.use('/api/analytics', analyticsRoutes_1.default);
// Server Port
const PORT = process.env.PORT || 5000;
app.get('/', (req, res) => {
    return res.json({ message: "Server Up" });
});
// Start the server
app.listen(PORT, () => __awaiter(void 0, void 0, void 0, function* () {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    // Check and update tournament statuses on server startup
    console.log("🔄 Initializing tournament status checks...");
    yield (0, gamehubController_1.checkAndUpdateTournamentStatuses)();
    // Schedule periodic checks every 5 minutes to catch any missed updates
    // Reduced frequency from 1 minute to 5 minutes for better performance
    // Scheduled jobs handle most updates, this is just a safety net
    node_schedule_1.default.scheduleJob('*/5 * * * *', () => __awaiter(void 0, void 0, void 0, function* () {
        yield (0, gamehubController_1.checkAndUpdateTournamentStatuses)();
    }));
    console.log("✅ Tournament status checker scheduled (runs every 5 minutes)");
}));
exports.default = app;
//# sourceMappingURL=server.js.map