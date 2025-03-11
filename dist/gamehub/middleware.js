"use strict";
//
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyUser = exports.checkUser = void 0;
const database_1 = require("firebase/database");
const firebase_1 = require("../config/firebase"); // Assuming db is your Firebase database instance
// Function to check if user exists and matches with the provided publicKey
const checkUser = (publicKey) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Reference to the users node in the Firebase Realtime Database
        const usersRef = (0, database_1.ref)(firebase_1.db, 'users');
        // Get all users data
        const snapshot = yield (0, database_1.get)(usersRef);
        if (snapshot.exists()) {
            const usersData = snapshot.val(); // This will return all users as a JS object
            // Loop through all users to check if the provided publicKey matches
            for (const userId in usersData) {
                if (usersData[userId].PublicKey === publicKey) {
                    // If a match is found, return the user data
                    return usersData[userId];
                }
            }
            // If no match is found, return null
            console.log("User not found with the given publicKey");
            return null;
        }
        else {
            console.log("No users found in the database");
            return null;
        }
    }
    catch (error) {
        console.error("Error checking user: ", error);
        throw new Error("Error checking user");
    }
});
exports.checkUser = checkUser;
// Middleware to check user authentication
const verifyUser = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const publicKey = req.headers['public-key']; // Assuming the frontend sends publicKey in the headers
        // Call the checkUser function to verify if the publicKey exists
        const user = yield (0, exports.checkUser)(publicKey);
        if (user) {
            // If the user is found, proceed with the next function (GameHub action)
            req.user = user; // Attach user data to the request object for further use
            next();
        }
        else {
            // If the user is not found, deny access
            return res.status(401).json({ message: "Unauthorized: Public Key does not match" });
        }
    }
    catch (error) {
        console.error("Error in verifyUser middleware:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
});
exports.verifyUser = verifyUser;
//# sourceMappingURL=middleware.js.map