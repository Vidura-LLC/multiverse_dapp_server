"use strict";
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
app.use("/api/staking", stakingRoutes_1.default);
app.use("/api/gamehub/", gamehubRoutes_1.default);
app.use('/api/revenue/', revenueRoutes_1.default);
app.use('/api/webhooks/', routes_1.default);
// Server Port
const PORT = process.env.PORT || 5000;
app.get('/', (req, res) => {
    return res.json({ message: "Server Up" });
});
// Start the server
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});
exports.default = app;
//# sourceMappingURL=server.js.map