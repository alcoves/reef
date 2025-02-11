// import { OAuth2Client } from "google-auth-library";

import { sha256 } from "@oslojs/crypto/sha2";
import {
	encodeBase32LowerCaseNoPadding,
	encodeHexLowerCase,
} from "@oslojs/encoding";
import { eq } from "drizzle-orm";
import { db } from "../db/db";
import { type Session, type User, sessions, users } from "../db/schema";

export function generateSessionToken(): string {
	const bytes = new Uint8Array(20);
	crypto.getRandomValues(bytes);
	const token = encodeBase32LowerCaseNoPadding(bytes);
	return token;
}

export async function createSession(
	token: string,
	userId: string,
): Promise<Session> {
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

export async function validateSessionToken(
	token: string,
): Promise<SessionValidationResult> {
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

// Not used, need to implement logout
export async function invalidateSession(sessionId: string): Promise<void> {
	await db.delete(sessions).where(eq(sessions.id, sessionId));
}

export type SessionValidationResult =
	| { session: Session; user: User }
	| { session: null; user: null };

import type { RequestEvent } from "@sveltejs/kit";

export function setSessionTokenCookie(
	event: RequestEvent,
	token: string,
	expiresAt: Date,
): void {
	event.cookies.set("session", token, {
		httpOnly: true,
		sameSite: "lax",
		expires: expiresAt,
		path: "/",
	});
}

export function deleteSessionTokenCookie(event: RequestEvent): void {
	event.cookies.set("session", "", {
		httpOnly: true,
		sameSite: "lax",
		maxAge: 0,
		path: "/",
	});
}
