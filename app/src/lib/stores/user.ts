import { writable } from "svelte/store";

export interface User {
	id: number;
	email: string;
	avatar: string | null;
	createdAt: string;
	updatedAt: string;
}

export const user = writable<User | null>(null);
