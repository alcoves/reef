import { Queue } from "bullmq";
import { env } from "../utilities/env";

const assetProcessingQueueName = "assets";

export enum AssetTasks {
	INGEST_ASSET = "ingest_asset",
	GENERATE_ASSET_VIDEO_PROXY = "generate_asset_video_proxy",
	GENERATE_ASSET_VIDEO_THUMBNAIL = "generate_asset_video_thumbnail",
}

export const bullConnection = {
	host: env.ALCOVES_TASK_DB_HOST,
	port: Number.parseInt(env.ALCOVES_TASK_DB_PORT),
};

export const assetProcessingQueue = new Queue(assetProcessingQueueName, {
	connection: bullConnection,
});
