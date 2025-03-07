//

import { ref, get } from "firebase/database";
import { db } from "../config/firebase";  // Assuming db is your Firebase database instance
import { PublicKey } from "@solana/web3.js/lib";

// Function to check if user exists and matches with the provided publicKey
export const checkUser = async (publicKey: string) => {
  try {
    // Reference to the users node in the Firebase Realtime Database
    const usersRef = ref(db, 'users');
    
    // Get all users data
    const snapshot = await get(usersRef);
    
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
    } else {
      console.log("No users found in the database");
      return null;
    }
  } catch (error) {
    console.error("Error checking user: ", error);
    throw new Error("Error checking user");
  }
};


// Middleware to check user authentication
export const verifyUser = async (req: { headers: { [x: string]: any; }; user: any; }, res: { status: (arg0: number) => { (): any; new(): any; json: { (arg0: { message: string; }): any; new(): any; }; }; }, next: () => void) => {
    try {
      const publicKey = req.headers['public-key'];  // Assuming the frontend sends publicKey in the headers
      
      // Call the checkUser function to verify if the publicKey exists
      const user = await checkUser(publicKey);
      
      if (user) {
        // If the user is found, proceed with the next function (GameHub action)
        req.user = user;  // Attach user data to the request object for further use
        next();
      } else {
        // If the user is not found, deny access
        return res.status(401).json({ message: "Unauthorized: Public Key does not match" });
      }
    } catch (error) {
      console.error("Error in verifyUser middleware:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  };
  