import createSubscriber from "pg-listen";
import type { AssetNotification } from "../../../types/ambient";
import type { Asset } from "../db/schema";

export let subscriber = createSubscriber({
	connectionString: process.env.ALCOVES_DB_CONNECTION_STRING!,
});

subscriber.events.on("error", (error) => {
	console.error("Fatal database connection error:", error);
});

let isConnected = false;

export async function ensureConnection() {
	if (!isConnected) {
		subscriber = createSubscriber({
			connectionString: process.env.ALCOVES_DB_CONNECTION_STRING!,
		});
		await subscriber.connect();
		isConnected = true;
		console.log("Successfully connected to PostgreSQL");
	}
}

export async function getNotifySubscriber() {
	await ensureConnection();
	return subscriber;
}

export async function dispatchAssetNotification(
	channelId: string,
	type: "ASSET_UPDATED" | "ASSET_CREATED" | "ASSET_DELETED",
	assets: Partial<Asset>[],
) {
	const subscriber = await getNotifySubscriber();
	const cleanedAssets = assets.map((asset) => {
		delete asset.metadata; // Because it is huge
		return asset;
	});
	const payload = {
		type,
		assets: cleanedAssets,
		time: Date.now(),
	} as AssetNotification;
	await subscriber.notify(channelId, JSON.stringify(payload));
}
