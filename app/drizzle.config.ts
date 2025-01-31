import { defineConfig } from "drizzle-kit";

export default defineConfig({
	out: "./src/lib/server/db/migrations",
	schema: "./src/lib/server/db/schema.ts",
	dialect: "postgresql",
	dbCredentials: {
		url: process.env.ALCOVES_DB_CONNECTION_STRING!,
	},
	verbose: true,
	strict: true,
});
