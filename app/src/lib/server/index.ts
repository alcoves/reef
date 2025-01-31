import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { migrateDatabase } from "./db/migrate";
import { assetsRouter } from "./routes/assets";
import { authRouter } from "./routes/auth";
import { rootRouter } from "./routes/root";
import { uploadsRouter } from "./routes/uploads";
import { usersRouter } from "./routes/users";
import { ws, wsRouter } from "./routes/ws";
import { startWorkers } from "./tasks";

const app = new Hono();

await migrateDatabase();

// TODO :: Add flag to enable workers on api server
// await startWorkers();

app.use(logger());

app.use(
	cors({
		origin: process.env.CORS_ORIGIN || "http://localhost:5173",
		credentials: true,
		allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
		allowHeaders: ["Content-Type", "Authorization", "Cookie"],
		exposeHeaders: ["Set-Cookie", "Content-Length"],
		maxAge: 86400,
	}),
);

app.route("/", rootRouter);
app.route("/ws", wsRouter);
app.route("/api/auth", authRouter);
app.route("/api/users", usersRouter);
app.route("/api/assets", assetsRouter);
app.route("/api/uploads", uploadsRouter);

export default {
	fetch: app.fetch,
	websocket: ws,
};
