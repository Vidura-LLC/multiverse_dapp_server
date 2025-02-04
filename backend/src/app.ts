import express, { Response, Request, Application } from "express";
import bodyParser from "body-parser";
import cors from "cors";
import stakingRoutes from "./staking/stakingRoutes";

const app: Application = express();

// Middleware
app.use(cors({
    origin: 'http://localhost:3000', // Allow frontend URL
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true // Allow cookies and authentication headers
}));


app.use(bodyParser.json());

// Routes
app.use("/api/staking", stakingRoutes);

export default app;
