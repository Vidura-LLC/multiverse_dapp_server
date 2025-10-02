export type TGameStatus = "draft" | "published";

export type TGameCreate = {
    id: string;
    name: string;
    description: string;
    image: File | null;
    status: TGameStatus;
    createdBy: string;
}

export type Game = {
    id: string;
    userId: string;
    name: string;
    description: string;
    image: string;
    createdAt: Date;
    updatedAt: Date;
    status: TGameStatus;
    createdBy: string;
}