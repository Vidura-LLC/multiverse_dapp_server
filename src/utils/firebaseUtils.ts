import { PublicKey } from "@solana/web3.js";
import { db } from "../config/firebase";
import { set, ref, get, push, query, orderByChild, equalTo } from "firebase/database";
import { User } from "../types/user";

/**
 * Fetch a user by their publicKey
 */
export async function getUser(publicKey: PublicKey) {
    try {
        const usersRef = query(ref(db, "users"), orderByChild("PublicKey"), equalTo(publicKey.toString()));
        const snapshot = await get(usersRef);

        if (snapshot.exists()) {
            const users = snapshot.val();
            const userId = Object.keys(users)[0]; // Get the first matching user ID
            return { id: userId, ...users[userId] }; // Return user object with ID
        } else {
            return null; // User does not exist
        }
    } catch (error) {
        console.error("Error retrieving user:", error);
        return null;
    }
}

/**
 * Create a new user with a random ID
 */
export const createUser = async (user: User) => {
    try {
        const newUserRef = push(ref(db, "users")); // Generate a random user ID
        const userId = newUserRef.key; // Get the generated ID

        await set(newUserRef, {
            id: userId, // Store user ID
            publicKey: user.publicKey,
            fullName: user.fullName,
            email: user.email,
            role: user.role,
            createdAt: new Date().toISOString(),
        });

        console.log("User created successfully:", userId);
        return userId;
    } catch (error) {
        console.error("Error creating user:", error);
        return null;
    }
};

export const updateUser = async (user: Partial<User>) => {
    try {
        const userRef = ref(db, `users/${user.id}`);
        await set(userRef, user);
        console.log("User updated successfully:", user.id);
        return user;
    } catch (error) {
        console.error("Error updating user:", error);
        return null;
    }
}

/**
 * Check if a user exists using publicKey
 */
export const checkUser = async (publicKey: PublicKey) => {
    try {
        const user = await getUser(publicKey);
        if (user) {
            console.log("User found:", user);
            return user;
        } else {
            console.log("User not found");
            return false;
        }
    } catch (error) {
        console.error("Error checking user:", error);
        return false;
    }
};
