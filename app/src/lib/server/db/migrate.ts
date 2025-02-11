import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db } from "./db";

export const migrateDatabase = async () => {
	try {
		console.log("Starting Database Migration");
		await migrate(db, { migrationsFolder: "./src/db/migrations" });
		console.log("Migration Ended Successfully");
	} catch (error) {
		console.error("Database Migration Failed!");
		console.error(error);
		process.exit(1);
	}
};
