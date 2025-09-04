export type User = {
    id: string;
    fullName: string;
    email: string;
    publicKey?: string;
    role: string;
    onboarded: boolean;
    createdAt: Date;
    updatedAt: Date;
}

