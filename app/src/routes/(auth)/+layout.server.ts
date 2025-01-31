import { redirect } from "@sveltejs/kit";
import type { LayoutServerLoad } from "./$types";
import { validateSessionToken } from "$lib/server/lib/session";

export const load: LayoutServerLoad = async ({ cookies }) => {
	const sessionToken = cookies.get("session");
	if (!sessionToken) return {};
	const { session, user } = await validateSessionToken(sessionToken);
	redirect(301, "/");
};
