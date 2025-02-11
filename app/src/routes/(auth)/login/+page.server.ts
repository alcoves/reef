import { generateSessionToken } from "$lib/server/auth/session";
import { createSession } from "$lib/server/auth/session";
import { setSessionTokenCookie } from "$lib/server/auth/session";
import { db } from "$lib/server/db/db";
import { users } from "$lib/server/db/schema";
import { fail } from "@sveltejs/kit";
import { eq } from "drizzle-orm";
import type { Actions } from "./$types";

export const actions = {
	default: async (event) => {
		const { request } = event;
		const data = await request.formData();
		const email = data.get("email");
		const password = data.get("password");

		const [user] = await db.select().from(users).where(eq(users.email, email));

		if (!user) {
			return fail(403, { error: "Failed to login" });
		}

		const passwordsMatch = await Bun.password.verify(
			password,
			user.passwordHash,
		);
		if (!passwordsMatch) return fail(403, { error: "Failed to login" });

		const token = generateSessionToken();
		const session = await createSession(token, user.id);
		setSessionTokenCookie(event, token, session.expiresAt);

		console.log("User logged in successfully!");
		return { success: true };
	},
} satisfies Actions;
