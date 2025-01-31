import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from './$types';
import { db } from '$lib/server/db/db';
import { users } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { generateSessionToken } from '$lib/server/lib/session';
import { createSession } from '$lib/server/lib/session';
import { createSessionCookie } from '$lib/server/lib/session';

export const actions = {
  default: async ({ cookies, request, }) => {
    const data = await request.formData();
    const email = data.get('email');
    const password = data.get('password');
    
    const [user] = await db.select().from(users).where(eq(users.email, email));

    if (!user) {
      return fail(403, {  error: "Failed to login" });
    }

    const passwordsMatch = await Bun.password.verify(password, user.passwordHash);
    if (!passwordsMatch) return fail(403, {  error: "Failed to login" });

    const token = generateSessionToken();
    await createSession(token, user.id);
    const sessionCookie = createSessionCookie(token);
    cookies.set(sessionCookie.name, sessionCookie.value, sessionCookie.attributes);

    console.log("User logged in successfully!")
    return { success: true }
  }
} satisfies Actions;