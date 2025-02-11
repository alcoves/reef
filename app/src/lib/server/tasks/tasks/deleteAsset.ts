import { db } from "$lib/server/db/db";
import { assets } from "$lib/server/db/schema";
import { deletePrefixFromS3 } from "$lib/server/utilities/s3";
import { eq } from "drizzle-orm";
import type { MaintenanceJob } from "../workers/maintenance";

export async function deleteAsset(job: MaintenanceJob): Promise<void> {
	try {
		const [assetToDelete] = await db
			.select()
			.from(assets)
			.where(eq(assets.deleted, true))
			.limit(1);
		if (!assetToDelete) return;

		console.info(`Deleting asset from s3: ${assetToDelete.id}`);
		await deletePrefixFromS3({
			bucket: assetToDelete.storageBucket,
			prefix: assetToDelete.storagePrefix,
		});

		console.info(`Deleting asset from db: ${assetToDelete.id}`);
		await db.delete(assets).where(eq(assets.id, assetToDelete.id));
	} catch (error) {
		console.error("Error deleting asset:", error);
		throw error;
	}
}
