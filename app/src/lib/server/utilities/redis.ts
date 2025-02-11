import redis from "redis";
import { env } from "./env";

export async function getClient() {
	const client = redis.createClient({
		url: `redis://${env.ALCOVES_TASK_DB_HOST}:${env.ALCOVES_TASK_DB_PORT}`,
	});

	client
		.on("end", () => console.log("Redis client disconnected"))
		.on("connect", () => console.log("Redis client connecting..."))
		.on("error", (err) => console.error("Redis Client Error:", err))
		.on("ready", () => console.log("Redis client connected successfully"))
		.on("reconnecting", () => console.log("Redis client reconnecting..."));

	process.on("SIGTERM", async () => {
		await client.quit();
	});

	process.on("SIGINT", async () => {
		await client.quit();
	});

	await client.connect();
	return client;
}

export async function pubClient() {
	const client = await getClient();
	return client;
}
