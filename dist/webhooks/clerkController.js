"use strict";
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
exports.clerkController = clerkController;
const firebaseUtils_1 = require("../utils/firebaseUtils");
const database_1 = require("firebase/database");
const firebase_1 = require("../config/firebase");
function clerkController(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // TODO: Get webhook secret from environment variables
            const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;
            if (!webhookSecret) {
                console.error('CLERK_WEBHOOK_SECRET not found in environment variables');
                res.status(500).json({ error: 'Webhook secret not configured' });
                return;
            }
            const event = req.body;
            console.log(`Received Clerk webhook: ${event.type}`, {
                userId: event.data.id,
            });
            // Handle different event types
            switch (event.type) {
                case 'user.created':
                    yield handleUserCreated(event);
                    break;
                case 'user.updated':
                    yield handleUserUpdated(event);
                    break;
                case 'user.deleted':
                    yield handleUserDeleted(event);
                    break;
                default:
                    console.log(`Unhandled webhook event type: ${event.type}`);
            }
            res.status(200).json({ received: true });
            return;
        }
        catch (error) {
            console.error('Error processing Clerk webhook:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    });
}
// Event handler functions
function handleUserCreated(event) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const userData = event.data;
            const user = {
                id: userData.id,
                fullName: `${userData.first_name || ''} ${userData.last_name || ''}`.trim() || '',
                email: userData.email_addresses[0].email_address || '',
                publicKey: "",
                role: "user",
                onboarded: false,
                createdAt: new Date(userData.created_at),
                updatedAt: new Date(userData.updated_at)
            };
            console.log('Creating new user:', { userId: user.id, email: user.email });
            const newUser = yield (0, firebaseUtils_1.createUser)(user);
            console.log('User created successfully:', newUser);
        }
        catch (error) {
            console.error('Error handling user.created event:', error);
            throw error;
        }
    });
}
function handleUserUpdated(event) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
        try {
            const userData = event.data;
            const updatedUser = {
                id: userData.id, // Add the Clerk user ID
                fullName: (_c = `${(_a = userData.first_name) !== null && _a !== void 0 ? _a : ''} ${(_b = userData.last_name) !== null && _b !== void 0 ? _b : ''}`.trim()) !== null && _c !== void 0 ? _c : '',
                email: (_f = (_e = (_d = userData.email_addresses) === null || _d === void 0 ? void 0 : _d[0]) === null || _e === void 0 ? void 0 : _e.email_address) !== null && _f !== void 0 ? _f : '',
                publicKey: (_h = (_g = userData.public_metadata) === null || _g === void 0 ? void 0 : _g.publicKey) !== null && _h !== void 0 ? _h : "",
                role: (_k = (_j = userData.public_metadata) === null || _j === void 0 ? void 0 : _j.role) !== null && _k !== void 0 ? _k : 'user',
                onboarded: (_m = (_l = userData.public_metadata) === null || _l === void 0 ? void 0 : _l.onboarded) !== null && _m !== void 0 ? _m : false,
                updatedAt: new Date(userData.updated_at)
            };
            console.log('Updating user:', { userId: userData.id, updates: updatedUser });
            const user = yield (0, firebaseUtils_1.updateUser)(updatedUser);
            console.log('User updated successfully:', user);
        }
        catch (error) {
            console.error('Error handling user.updated event:', error);
            throw error;
        }
    });
}
function handleUserDeleted(event) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        try {
            const userId = event.data.id;
            console.log('Deleting user by user.id:', { userId });
            // Find the document reference (Firebase push key) where user.id matches the webhook id
            const usersRef = (0, database_1.ref)(firebase_1.db, "users");
            const usersSnapshot = yield (0, database_1.get)(usersRef);
            if (!usersSnapshot.exists()) {
                console.log('No users found in database.');
                return;
            }
            const users = usersSnapshot.val();
            let docRefIdToDelete = null;
            for (const docRefId in users) {
                if (((_a = users[docRefId]) === null || _a === void 0 ? void 0 : _a.id) === userId) {
                    docRefIdToDelete = docRefId;
                    break;
                }
            }
            if (docRefIdToDelete) {
                const userRef = (0, database_1.ref)(firebase_1.db, `users/${docRefIdToDelete}`);
                yield (0, database_1.remove)(userRef);
                console.log('User deleted successfully:', docRefIdToDelete);
            }
            else {
                console.log('User with id not found:', userId);
            }
        }
        catch (error) {
            console.error('Error handling user.deleted event:', error);
            throw error;
        }
    });
}
//# sourceMappingURL=clerkController.js.map