import express, { Response, Request, Application } from "express";
import dotenv from "dotenv";
import bodyParser from "body-parser";
import cors from "cors";
import stakingRoutes from "./staking/stakingRoutes";

// Load environment variables
dotenv.config();

const app: Application = express();

// Middleware
app.use(cors({
    origin: '*', // Allow frontend URL
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true // Allow cookies and authentication headers
}));


app.use(bodyParser.json());

// Routes
app.use("/api/staking", stakingRoutes);

// Server Port
const PORT = process.env.PORT || 5000;

app.get('/', (req: Request, res: Response): any => {
    return res.json({ message: "Server Up" });
})

// Start the server
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});

export default app;
