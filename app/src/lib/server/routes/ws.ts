import type { ServerWebSocket } from "bun";
import { Hono } from "hono";
import { createBunWebSocket } from "hono/bun";
import { getClient } from "../lib/redis";

const router = new Hono();

const { upgradeWebSocket, websocket } = createBunWebSocket<ServerWebSocket>();

// This needs to be scoped to the user and or library
export const channelName = "alcoves";

// Create shared Redis client
let sharedClient: Awaited<ReturnType<typeof getClient>> | null = null;

enum WebSocketMessageType {
	ASSET_UPDATED = "ASSET_UPDATED",
	PROXY_UPDATED = "PROXY_UPDATED",
}

export interface WebSocketMessage {
	type: WebSocketMessageType;
	payload: { [key: string]: any };
}

router.get(
	"/",
	upgradeWebSocket((c) => {
		return {
			onOpen: async (event, ws) => {
				console.log("Connection opened");

				if (!sharedClient) {
					sharedClient = await getClient();
				}

				await sharedClient.subscribe(channelName, (message) => {
					// console.debug(`Received message from channel ${channelName}: ${message}`);
					ws.send(message);
				});
			},
			onClose: async () => {
				console.log("Connection closed");
				if (sharedClient) {
					await sharedClient.unsubscribe(channelName);
				}
			},
			onError: async (err) => {
				console.error("WebSocket error:", err);
				if (sharedClient) {
					await sharedClient.unsubscribe(channelName);
				}
			},
		};
	}),
);

// Debug
// const publisher = await pubClient();
// setInterval(async () => {
//   console.info("I an sending a message to the channel")
//   publisher.publish(channelName, 'Hello from the server!')
// }, 1000)

export const ws = websocket;
export const wsRouter = router;
