import { PublicKey } from "@solana/web3.js/lib";
import { db } from "../config/firebase";
import { set, ref, get } from 'firebase/database'

export async function getUser(publicKey: PublicKey) {
    try {
        const userRef = ref(db, `multiverse-users/${publicKey.toString()}`); // Directly reference the user by publicKey
        const snapshot = await get(userRef);

        if (snapshot.exists()) {
            return snapshot.val(); // Return user object
        } else {
            return null; // User does not exist
        }
    } catch (error) {
        console.error("Error retrieving user:", error);
        return null;
    }
}


export const createUser = async (publicKey: PublicKey) => {
    try {
        await set(ref(db, `multiverse-users/${publicKey}`), {
            publicKey,
            createdAt: new Date().toISOString(),
        });
        console.log('User created successfully');
    } catch (error) {
        console.error('Error creating user:', error);
    }
};


export const checkUser = async (publicKey: PublicKey) => {
    try {
        const userRef = ref(db, `multiverse-users/${publicKey.toString()}`); // Direct lookup
        const snapshot = await get(userRef);

        if (snapshot.exists()) {
            console.log("User found:", snapshot.val());
            return snapshot.val(); // Return user object
        } else {
            console.log("User not found");
            return false; // User does not exist
        }
    } catch (error) {
        console.error("Error checking user:", error);
        return false;
    }
};

