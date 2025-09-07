export type UserRole = "admin" | "developer" | "user";

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

export type DevelperUser = User & {
    professionalDetails: {
        company: string,
        jobTitle: string,
        website: string
    }
}