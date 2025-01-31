import { apiWsEndpoint } from "$lib/api";
import { writable } from "svelte/store";
import { browser } from "$app/environment";

export enum WebSocketMessageType {
	ASSET_UPDATED = "ASSET_UPDATED",
	PROXY_UPDATED = "PROXY_UPDATED",
}

interface WebSocketMessage {
	type: WebSocketMessageType;
	payload: any;
}

const messageStore = writable<WebSocketMessage | null>(null);
let socket: WebSocket | null = null;

if (browser) {
	socket = new WebSocket(apiWsEndpoint);

	socket.onopen = () => {
		console.log("WS: Connected to server");
	};

	socket.onclose = () => {
		console.log("WS: Disconnected from server");
	};

	socket.onmessage = (event) => {
		console.info("WS: Received message:", event);
		try {
			messageStore.set(JSON.parse(event.data));
		} catch (e) {
			console.error("WS: Failed to parse WebSocket message:", e);
			messageStore.set(null);
		}
	};

	socket.onerror = (error) => {
		console.error("WS: Error:", error);
	};

	setInterval(() => {
		// Attempt to reconnect if the connection is closed
		if (socket?.readyState === WebSocket.CLOSED) {
			console.log("WS: Reconnecting...");
			socket = new WebSocket(apiWsEndpoint);
		}
	}, 5000);
}

export default {
	subscribe: messageStore.subscribe,
	close: () => {
		if (socket) {
			socket.close();
		}
	},
};
