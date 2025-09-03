import { NextFunction, Request, Response } from 'express';
import crypto from 'crypto';
import { WebhookEvent, UserJSON } from '@clerk/backend/dist';
import { createUser } from '../utils/firebaseUtils';
import { User } from "../types/user";

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

        // Extract user information from Clerk event
        const user: User = {
            id: userData.id,
            fullName: `${userData.first_name || ''} ${userData.last_name || ''}`.trim() || '',
            email: userData.email_addresses[0].email_address || '',
            publicKey: "",
            role: "",
            createdAt: new Date(userData.created_at),
            updatedAt: new Date(userData.updated_at)
        };

        console.log('Creating new user:', { userId: user.id, email: user.email });

        // TODO: Save user to database
        const newUser = await createUser(user)

        // Example: await UserModel.create(user);
        // Example: await db.collection('users').doc(user.id).set(user);

        console.log('User created successfully:', newUser);

    } catch (error) {
        console.error('Error handling user.created event:', error);
        throw error;
    }
}

async function handleUserUpdated(event: WebhookEvent): Promise<void> {
    try {
        const userData = event.data as UserJSON;

        // Extract updated user information
        const updatedUser: Partial<User> = {
            fullName: `${userData.first_name || ''} ${userData.last_name || ''}`.trim() || 'Unknown',
            email: userData.email_addresses?.[0]?.email_address || '',
            publicKey: (userData.public_metadata as any)?.publicKey || undefined,
            role: (userData.public_metadata as any)?.role || 'user',
            updatedAt: new Date(userData.updated_at)
        };

        console.log('Updating user:', { userId: userData.id, updates: updatedUser });

        // TODO: Update user in database
        // Example: await UserModel.findByIdAndUpdate(userData.id, updatedUser);
        // Example: await db.collection('users').doc(userData.id).update(updatedUser);

        console.log('User updated successfully:', userData.id);
    } catch (error) {
        console.error('Error handling user.updated event:', error);
        throw error;
    }
}

async function handleUserDeleted(event: WebhookEvent): Promise<void> {
    try {
        const userId = (event.data as UserJSON).id;

        console.log('Deleting user:', { userId });

        // TODO: Delete user from database
        // Example: await UserModel.findByIdAndDelete(userId);
        // Example: await db.collection('users').doc(userId).delete();

        console.log('User deleted successfully:', userId);
    } catch (error) {
        console.error('Error handling user.deleted event:', error);
        throw error;
    }
}