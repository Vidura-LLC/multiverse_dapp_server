"use strict";
//src\config\firebase.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = void 0;
const app_1 = require("firebase/app");
const database_1 = require("firebase/database");
// TODO: Replace the following with your app's Firebase project configuration
// See: https://firebase.google.com/docs/web/learn-more#config-object
const firebaseConfig = {
    apiKey: process.env.WEB_API_KEY,
    projectId: process.env.PROJECT_ID,
    databaseURL: process.env.FIREBASE_URL,
};
// Initialize Firebase
const app = (0, app_1.initializeApp)(firebaseConfig);
// Initialize Realtime Database and get a reference to the service
exports.db = (0, database_1.getDatabase)(app);
//# sourceMappingURL=firebase.js.map