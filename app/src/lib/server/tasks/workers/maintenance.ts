import { type Job, Worker } from "bullmq";
import { MaintenanceTasks, bullConnection, maintenanceQueue } from "../queues";
import { deleteAsset } from "../tasks/deleteAsset";

export interface MaintenanceJob extends Job {
	name: MaintenanceTasks;
	data: {
		assetId: string;
	};
}

async function main() {
	const worker = new Worker(
		maintenanceQueue.name,
		async (job: MaintenanceJob) => {
			try {
				switch (job.name) {
					case MaintenanceTasks.DELETE_ASSET:
						await deleteAsset(job);
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
			concurrency: 1,
		},
	);

	// worker.on('progress', async (job, progress) => {
	//   console.log(`${job.id} has progressed to ${progress}%`);
	// });

	// worker.on("completed", async (job) => {
	//   console.log(`${job.id} has completed!`);
	// });

	// worker.on("failed", async (job, err) => {
	//   console.log(`${job?.id} has failed with ${err.message}`);
	// });

	console.info(
		`Starting worker: ${worker.name} for queue: ${maintenanceQueue.name}`,
	);
}

export default main;
