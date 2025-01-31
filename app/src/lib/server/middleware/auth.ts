import { getCookie, setCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import { validateSessionToken } from "../lib/session";
import type { Session, User } from "../db/schema";

export type UserAuthMiddleware = {
	authorization: {
		user: User;
		session: Session;
	};
};

export const userAuth = createMiddleware(async (c, next) => {
	const sessionId = getCookie(c, "session");
	if (!sessionId) throw new HTTPException(401);

	const { session, user } = await validateSessionToken(sessionId);
	if (!session || !user) throw new HTTPException(401);

	// If Session.fresh is true, it indicates the session expiration
	// has been extended and you should set a new session cookie.
	// if (session?.fresh) {
	// 	console.info("Refreshing session...");
	// 	const refreshedSession = await createSession(user.id, {});
	// 	const refreshedSessionCookie = createSessionCookie(refreshedSession.id);
	// 	setCookie(
	// 		c,
	// 		refreshedSessionCookie.name,
	// 		refreshedSessionCookie.value,
	// 		refreshedSessionCookie.attributes,
	// 	);
	// }

	c.set("authorization", {
		user,
		session,
	});

	await next();
});
