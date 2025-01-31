//backend/src/server.ts

import app from "./app";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Server Port
const PORT = process.env.PORT || 5000;

// Start the server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
