import { validateSessionToken } from "$lib/server/auth/session";
import {
	deleteSessionTokenCookie,
	setSessionTokenCookie,
} from "$lib/server/auth/session";
import { startWorkers } from "$lib/server/tasks";
import type { Handle } from "@sveltejs/kit";

startWorkers();

export const handle: Handle = async ({ event, resolve }) => {
	const token = event.cookies.get("session") ?? null;
	if (token === null) {
		event.locals.user = null;
		event.locals.session = null;
		return resolve(event);
	}

	const { session, user } = await validateSessionToken(token);
	if (session !== null) {
		setSessionTokenCookie(event, token, session.expiresAt);
	} else {
		deleteSessionTokenCookie(event);
	}

	event.locals.session = session;
	event.locals.user = user;
	return resolve(event);
};
