// import { OAuth2Client } from "google-auth-library";

import { encodeBase32LowerCaseNoPadding, encodeHexLowerCase } from "@oslojs/encoding";
import { sha256 } from "@oslojs/crypto/sha2";
import { eq } from "drizzle-orm";
import { type Session, sessions, type User, users } from "../db/schema";
import { db } from "../db/db";

export function generateSessionToken(): string {
	const bytes = new Uint8Array(20);
	crypto.getRandomValues(bytes);
	const token = encodeBase32LowerCaseNoPadding(bytes);
	return token;
}

export async function createSession(token: string, userId: string): Promise<Session> {
	const sessionId = encodeHexLowerCase(sha256(new TextEncoder().encode(token)));
	const [session] = await db
		.insert(sessions)
		.values({
			id: sessionId,
			userId,
			expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
		})
		.returning();
	return session;
}

export async function validateSessionToken(token: string): Promise<SessionValidationResult> {
	const sessionId = encodeHexLowerCase(sha256(new TextEncoder().encode(token)));
	const result = await db
		.select({ user: users, session: sessions })
		.from(sessions)
		.innerJoin(users, eq(sessions.userId, users.id))
		.where(eq(sessions.id, sessionId));
	if (result.length < 1) {
		return { session: null, user: null };
	}
	const { user, session } = result[0];
	if (Date.now() >= session.expiresAt.getTime()) {
		await db.delete(sessions).where(eq(sessions.id, session.id));
		return { session: null, user: null };
	}
	if (Date.now() >= session.expiresAt.getTime() - 1000 * 60 * 60 * 24 * 15) {
		session.expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);
		await db
			.update(sessions)
			.set({
				expiresAt: session.expiresAt,
			})
			.where(eq(sessions.id, session.id));
	}
	return { session, user };
}

export async function invalidateSession(sessionId: string): Promise<void> {
	await db.delete(sessions).where(eq(sessions.id, sessionId));
}

export type SessionValidationResult =
	| { session: Session; user: User }
	| { session: null; user: null };

interface AuthCookie {
	name: string;
	value: string;
	attributes: any;
}

export function createSessionCookie(sessionId: string): AuthCookie {
	return {
		name: "session",
		value: sessionId,
		attributes: {
			httpOnly: true,
			path: "/",
			sameSite: "Lax",
			maxAge: 60 * 60 * 24 * 30,
			secure: Bun.env.NODE_ENV === "production" ? true : false,
		},
	};
}

export function deleteSessionCookie(): AuthCookie {
	return {
		name: "session",
		value: "",
		attributes: {
			httpOnly: true,
			path: "/",
			sameSite: "Lax",
			maxAge: 0,
			secure: Bun.env.NODE_ENV === "production" ? true : false,
		},
	};
}

// const CLIENT_ID = process.env.ALCOVES_AUTH_GOOGLE_ID;
// const CLIENT_SECRET = process.env.ALCOVES_AUTH_GOOGLE_SECRET;
// const REDIRECT_URI = process.env.ALCOVES_AUTH_GOOGLE_REDIRECT_URL;

// const oAuth2Client = new OAuth2Client(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

// export async function getGoogleOAuthTokens(authCode: string) {
// 	try {
// 		const { tokens } = await oAuth2Client.getToken(authCode);
// 		return tokens?.access_token ? tokens : Promise.reject();
// 	} catch (e) {
// 		console.error(e);
// 		throw new Error("Failed to get Google OAuth tokens");
// 	}
// }

// export async function getUserInfo(accessToken: string) {
// 	const url = "https://www.googleapis.com/oauth2/v3/userinfo";
// 	const res = await fetch(url, {
// 		headers: {
// 			Authorization: `Bearer ${accessToken}`,
// 		},
// 	});
// 	const userInfo = await res.json();
// 	console.log(userInfo);
// 	return userInfo;
// }
