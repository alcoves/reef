import { fail } from '@sveltejs/kit';
import type { Actions } from './$types';
import { db } from '$lib/server/db/db';
import { users } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { createSession, createSessionCookie, generateSessionToken } from '$lib/server/lib/session';

export const actions = {
  default: async ({ cookies, request, }) => {
    const data = await request.formData();
    const email = data.get('email');
    const password = data.get('password');
    
    const [user] = await db.select().from(users).where(eq(users.email, email));

    if (user) {
      return fail(400, {  error: "User already exists" });
    }

    const passwordHash = await Bun.password.hash(password);

    const [newUser] = await db
      .insert(users)
      .values({
        email,
        passwordHash,
      })
      .returning();

    const token = generateSessionToken();
    await createSession(token, newUser.id);
    const sessionCookie = createSessionCookie(token);
    cookies.set(sessionCookie.name, sessionCookie.value, sessionCookie.attributes);

    return { success: true }
  }
} satisfies Actions;