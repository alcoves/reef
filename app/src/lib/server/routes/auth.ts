import { Hono } from "hono";
import { setCookie } from "hono/cookie";
import { HTTPException } from "hono/http-exception";
import { type UserAuthMiddleware, userAuth } from "../middleware/auth";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import {
	createSession,
	createSessionCookie,
	deleteSessionCookie,
	generateSessionToken,
	invalidateSession,
} from "../lib/session";
import { eq } from "drizzle-orm";
import { users } from "../db/schema";
import { db } from "../db/db";

const router = new Hono<{ Variables: UserAuthMiddleware }>();


router.post("/logout", userAuth, async (c) => {
	const { session } = c.get("authorization");
	await invalidateSession(session.id);

	const emptySessionCookie = deleteSessionCookie();
	setCookie(c, emptySessionCookie.name, emptySessionCookie.value, emptySessionCookie.attributes);

	return c.json({
		message: "Successfully logged out",
	});
});

export const authRouter = router;

// import { getGoogleOAuthTokens, getUserInfo } from "../lib/auth";

// router.get("/callbacks/google", async (c) => {
// 	const code = c.req.query("code");
// 	if (!code) throw new HTTPException(400, { message: "No code was provided" });

// 	const tokens = await getGoogleOAuthTokens(code);

// 	if (tokens?.access_token) {
// 		const userInfo = await getUserInfo(tokens.access_token);
// 		console.log("userInfo", userInfo);

// 		console.info("Upserting user in the database...");
// 		const [user] = await db
// 			.insert(users)
// 			.values({
// 				email: userInfo?.email,
// 				avatar: userInfo?.picture,
// 				id: generateIdFromEntropySize(10),
// 			})
// 			.onConflictDoUpdate({
// 				target: users.email,
// 				set: { email: userInfo?.email, avatar: userInfo?.picture },
// 			})
// 			.returning();

// 		console.log(user);

// 		const session = await lucia.createSession(user.id, {});
// 		const sessionCookie = lucia.createSessionCookie(session.id);
// 		setCookie(c, sessionCookie.name, sessionCookie.value, sessionCookie.attributes);

// 		// TODO :: Can the state object on the FE be used to pass the redirect URL?
// 		const redirectUrl = process.env.NODE_ENV === "production" ? "/" : "http://localhost:3005";
// 		return c.redirect(redirectUrl);
// 	}

// 	return c.json({
// 		message: "Failed to authenticate user",
// 	});
// });
