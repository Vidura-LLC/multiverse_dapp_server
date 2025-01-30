import express, { Application } from "express";
import bodyParser from "body-parser";
import cors from "cors";
import stakingRoutes from "./staking/stakingRoutes";

const app: Application = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Routes
app.use("/api/staking", stakingRoutes);

export default app;
