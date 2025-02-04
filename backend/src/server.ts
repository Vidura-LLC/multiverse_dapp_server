import { Request, Response } from "express";
import app from "./app";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Server Port
const PORT = process.env.PORT || 5000;

app.get('/', (req: Request, res: Response): any => {
  return res.json({ message: "Server Up" });
})

// Start the server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
