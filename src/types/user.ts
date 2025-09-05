export type User = {
    id: string;
    fullName: string;
    email: string;
    publicKey?: string;
    role: UserRole;
    onboarded: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export type UserRole = "admin" | "developer" | "user";
