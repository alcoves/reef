import pkg from "pg";
const { Pool } = pkg;
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

const pool = new Pool({
	connectionString: process.env.ALCOVES_DB_CONNECTION_STRING!,
});

export const db = drizzle({ client: pool, schema, casing: "snake_case" });
