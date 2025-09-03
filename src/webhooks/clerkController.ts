import { NextFunction, Request, Response } from 'express';
import crypto from 'crypto';
import { WebhookEvent } from '@clerk/backend/dist';

export async function clerkController(req: Request, res: Response): Promise<void> {
    try {
        // TODO: Get webhook secret from environment variables
        const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;

        if (!webhookSecret) {
            console.error('CLERK_WEBHOOK_SECRET not found in environment variables');
            res.status(500).json({ error: 'Webhook secret not configured' });
            return;
        }

        // Verify webhook signature
        const signature = req.headers['svix-signature'] as string;
        const timestamp = req.headers['svix-timestamp'] as string;

        if (!signature || !timestamp) {
            console.error('Missing required webhook headers');
            res.status(400).json({ error: 'Missing required headers' });
            return;
        }

        // For now, basic signature verification
        const body = JSON.stringify(req.body);
        const expectedSignature = crypto
            .createHmac('sha256', webhookSecret)
            .update(timestamp + body)
            .digest('base64');

        if (signature !== expectedSignature) {
            console.error('Invalid webhook signature');
            res.status(401).json({ error: 'Invalid signature' });
            return;
        }

        const event: WebhookEvent  = req.body;

        console.log(`Received Clerk webhook: ${event.type}`, {
            userId: event.data.id,
        });

        // Handle different event types
        switch (event.type) {
            case 'user.created':
                // TODO: Handler user created event
                break;
            case 'user.updated':
                // TODO: Handle user updated event
                break;
            case 'user.deleted':
                // TODO: Handle user deleted event
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