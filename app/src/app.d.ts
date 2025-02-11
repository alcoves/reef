import type { Session } from "$lib/server/auth/session";
import type { User } from "$lib/server/user";

declare global {
	namespace App {
		interface Locals {
			user: User | null; // Are these types correct?
			session: Session | null; // Are these types correct?
		}
	}
}
