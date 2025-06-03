//src\config\firebase.ts
import dotenv from "dotenv";

import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

dotenv.config();

// TODO: Replace the following with your app's Firebase project configuration
// See: https://firebase.google.com/docs/web/learn-more#config-object
const firebaseConfig = {
    apiKey: process.env.WEB_API_KEY,
    projectId: process.env.PROJECT_ID,
    databaseURL: process.env.FIREBASE_URL,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);


// Initialize Realtime Database and get a reference to the service
export const db = getDatabase(app);