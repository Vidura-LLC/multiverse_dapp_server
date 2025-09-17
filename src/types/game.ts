export type TGameStatus = "Active" | "Upcoming" | "Ended" | "Draft" | "Distributed" | "Awarded";

export type TGameCreate = {
    id: string;
    name: string;
    description: string;
    image: File | null;
    userId: string;
    status: TGameStatus;
}

export type Game = {
    id: string;
    name: string;
    description: string;
    image: string;
    createdAt: Date;
    updatedAt: Date;
    userId: string;
    status: TGameStatus;
}