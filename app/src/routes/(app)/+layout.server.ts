import { validateSessionToken } from "$lib/server/lib/session";
import { redirect } from "@sveltejs/kit";
import type { LayoutServerLoad } from "./$types";

export const load: LayoutServerLoad = async ({ cookies }) => {
	const sessionToken = cookies.get("session");
	if (!sessionToken) redirect(301, "/login");
	const { session, user } = await validateSessionToken(sessionToken);
	if (!user || !session) redirect(301, "/login");

	return {
		authenticatedUser: user,
	};
};
