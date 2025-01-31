import { Queue } from "bullmq";
import { env } from "../lib/env";

const imageProcessingQueueName = "images";
const videoProcessingQueueName = "videos";

// Not currently used really.
export enum ImageTasks {
	FETCH_IMAGE_METADATA = "fetch_image_metadata",
	GENERATE_IMAGE_PROXIES = "generate_image_proxies",
}

export enum VideoTasks {
	GENERATE_VIDEO_PROXIES = "generate_video_proxies",
	GENERATE_VIDEO_THUMBNAIL = "generate_video_thumbnail",
}

export const bullConnection = {
	host: env.ALCOVES_TASK_DB_HOST,
	port: Number.parseInt(env.ALCOVES_TASK_DB_PORT),
};

export const imageProcessingQueue = new Queue(imageProcessingQueueName, {
	connection: bullConnection,
});

export const videoProcessingQueue = new Queue(videoProcessingQueueName, {
	connection: bullConnection,
});
