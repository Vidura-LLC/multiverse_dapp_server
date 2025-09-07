import { Request, Response } from 'express';
import { WebhookEvent, UserJSON } from '@clerk/backend/dist';
import { createUser, updateUser } from '../utils/firebaseUtils';
import { User } from "../types/user";
import { get, ref, remove } from "firebase/database";
import { db } from '../config/firebase';
export async function clerkController(req: Request, res: Response): Promise<void> {
    try {
        // TODO: Get webhook secret from environment variables
        const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;

        if (!webhookSecret) {
            console.error('CLERK_WEBHOOK_SECRET not found in environment variables');
            res.status(500).json({ error: 'Webhook secret not configured' });
            return;
        }
        const event: WebhookEvent  = req.body;

        console.log(`Received Clerk webhook: ${event.type}`, {
            userId: event.data.id,
        });

        // Handle different event types
        switch (event.type) {
            case 'user.created':
                await handleUserCreated(event);
                break;
            case 'user.updated':
                await handleUserUpdated(event);
                break;
            case 'user.deleted':
                await handleUserDeleted(event);
                break;
            default:
                console.log(`Unhandled webhook event type: ${event.type}`);
        }

        res.status(200).json({ received: true });
        return;
    } catch (error) {
        console.error('Error processing Clerk webhook:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

// Event handler functions
async function handleUserCreated(event: WebhookEvent): Promise<void> {
    try {
        const userData = event.data as UserJSON;

        const roleFromMetadata = (userData.public_metadata as any)?.role ?? "user";
        const publicKeyFromMetadata = (userData.public_metadata as any)?.publicKey ?? "";
        const onboardedFromMetadata = (userData.public_metadata as any)?.onboarded ?? false;
        const professionalDetailsFromMetadata = (userData.public_metadata as any)?.professionalDetails as
            | { company: string; jobTitle: string; website: string }
            | undefined;

        const user: User = {
            id: userData.id,
            fullName: `${userData.first_name || ''} ${userData.last_name || ''}`.trim() || '',
            email: userData.email_addresses[0].email_address || '',
            publicKey: publicKeyFromMetadata,
            role: roleFromMetadata,
            onboarded: onboardedFromMetadata,
            createdAt: new Date(userData.created_at),
            updatedAt: new Date(userData.updated_at)
        };

        console.log('Creating new user:', { userId: user.id, email: user.email });

        const newUser = await createUser(user)
        console.log('User created successfully:', newUser);

        // If the user is a developer, persist developer-specific details separately
        if (roleFromMetadata === "developer" && professionalDetailsFromMetadata) {
            await updateUser({
                id: user.id,
                // Extend stored record with developer details
                professionalDetails: professionalDetailsFromMetadata,
            } as any);
        }

    } catch (error) {
        console.error('Error handling user.created event:', error);
        throw error;
    }
}

async function handleUserUpdated(event: WebhookEvent): Promise<void> {
    try {
        const userData = event.data as UserJSON;

        const roleFromMetadata = (userData.public_metadata as any)?.role ?? 'user';
        const professionalDetailsFromMetadata = (userData.public_metadata as any)?.professionalDetails as
            | { company: string; jobTitle: string; website: string }
            | undefined;

        const updatedUser: Partial<User> & { professionalDetails?: { company: string; jobTitle: string; website: string } } = {
            id: userData.id, // Add the Clerk user ID
            fullName: `${userData.first_name ?? ''} ${userData.last_name ?? ''}`.trim() ?? '',
            email: userData.email_addresses?.[0]?.email_address ?? '',
            publicKey: (userData.public_metadata as any)?.publicKey ?? "",
            role: roleFromMetadata,
            onboarded: (userData.public_metadata as any)?.onboarded ?? false,
            updatedAt: new Date(userData.updated_at)
        };

        if (roleFromMetadata === 'developer' && professionalDetailsFromMetadata) {
            updatedUser.professionalDetails = professionalDetailsFromMetadata;
        }

        console.log('Updating user:', { userId: userData.id, updates: updatedUser });

        const user = await updateUser(updatedUser);

        console.log('User updated successfully:', user);
    } catch (error) {
        console.error('Error handling user.updated event:', error);
        throw error;
    }
}

async function handleUserDeleted(event: WebhookEvent): Promise<void> {
    try {
        const userId = (event.data as UserJSON).id;

        console.log('Deleting user by user.id:', { userId });

        // Find the document reference (Firebase push key) where user.id matches the webhook id
        const usersRef = ref(db, "users");
        const usersSnapshot = await get(usersRef);

        if (!usersSnapshot.exists()) {
            console.log('No users found in database.');
            return;
        }

        const users = usersSnapshot.val();
        let docRefIdToDelete: string | null = null;

        for (const docRefId in users) {
            if (users[docRefId]?.id === userId) {
                docRefIdToDelete = docRefId;
                break;
            }
        }

        if (docRefIdToDelete) {
            const userRef = ref(db, `users/${docRefIdToDelete}`);
            await remove(userRef);
            console.log('User deleted successfully:', docRefIdToDelete);
        } else {
            console.log('User with id not found:', userId);
        }
    } catch (error) {
        console.error('Error handling user.deleted event:', error);
        throw error;
    }
}