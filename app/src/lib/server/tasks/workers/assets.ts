import { getAsset } from "$lib/server/services/assets";
import { dispatchAssetNotification } from "$lib/server/services/notify";
import { env } from "$lib/server/utilities/env";
import { type Job, Worker } from "bullmq";
import { AssetTasks, assetProcessingQueue, bullConnection } from "../queues";
import { generateVideoProxy } from "../tasks/generateVideoProxy";
import { generateVideoThumbnail } from "../tasks/generateVideoThumbnail";
import { ingestAsset } from "../tasks/ingestAsset";

export interface AssetJob extends Job {
	name: AssetTasks;
	data: {
		assetId: string;
	};
}

async function main() {
	const worker = new Worker(
		assetProcessingQueue.name,
		async (job: AssetJob) => {
			try {
				switch (job.name) {
					case AssetTasks.INGEST_ASSET:
						await ingestAsset(job);
						break;
					case AssetTasks.GENERATE_ASSET_VIDEO_PROXY:
						await generateVideoProxy(job);
						break;
					case AssetTasks.GENERATE_ASSET_VIDEO_THUMBNAIL:
						await generateVideoThumbnail(job);
						break;
					default:
						console.error(`Invalid job name: ${job.name}`);
						break;
				}
			} catch (error) {
				console.error("Worker Error:", error);
				throw error;
			}
		},
		{
			connection: bullConnection,
			concurrency: Number.parseInt(env.ALCOVES_TASK_WORKER_CONCURRENCY),
		},
	);

	worker.on("progress", async (job, progress) => {
		console.log(`${job.id} has progressed to ${progress}%`);
		const asset = await getAsset(job.data.assetId);
		await dispatchAssetNotification("assets", "ASSET_UPDATED", [asset]);
	});

	worker.on("completed", async (job) => {
		console.log(`${job.id} has completed!`);
		const asset = await getAsset(job.data.assetId);
		await dispatchAssetNotification("assets", "ASSET_UPDATED", [asset]);
	});

	worker.on("failed", async (job, err) => {
		console.log(`${job?.id} has failed with ${err.message}`);
		if (job?.data?.assetId) {
			const asset = await getAsset(job.data.assetId);
			await dispatchAssetNotification("assets", "ASSET_UPDATED", [asset]);
		}
	});

	console.info(
		`Starting worker: ${worker.name} for queue: ${assetProcessingQueue.name}`,
	);
}

export default main;
