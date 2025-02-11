import { maintenanceQueue } from "./queues";
import assetWorker from "./workers/assets";
import maintenanceWorker from "./workers/maintenance";

export async function startWorkers() {
	assetWorker();
	maintenanceWorker();

	await maintenanceQueue.upsertJobScheduler(
		"delete-assets-scheduler",
		{
			every: 1000,
		},
		{
			name: "delete_asset",
		},
	);
}
