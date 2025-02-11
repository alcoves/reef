import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { db } from "$lib/server/db/db";
import { assets } from "$lib/server/db/schema";
import { getMediaInfo } from "$lib/server/utilities/ffmpeg";
import { getPresignedUrl } from "$lib/server/utilities/s3";
import { eq } from "drizzle-orm";
import { AssetTasks, assetProcessingQueue } from "../queues";
import type { AssetJob } from "../workers/assets";

const getBytesAsMegabytes = (bytes: number) => bytes / 1024 / 1024;

export async function ingestAsset(job: AssetJob): Promise<void> {
	const tmpDir = await mkdtemp(join(tmpdir(), "alcoves-"));
	console.info(`Created temporary directory: ${tmpDir}`);

	try {
		console.info("Processing asset ingestion job");
		const [asset] = await db
			.select()
			.from(assets)
			.where(eq(assets.id, job.data.assetId));
		if (!asset) throw new Error(`Asset not found: ${job.data.assetId}`);

		console.info("Fetching asset metadata");
		if (asset.type === "VIDEO") {
			const sourceMediaUrl = await getPresignedUrl({
				key: asset.storageKey,
				bucket: asset.storageBucket,
			});
			const metadata = await getMediaInfo(sourceMediaUrl);

			// TODO :: This should probably be a zod validated data object

			if (!metadata) {
				throw new Error("Failed to fetch media metadata");
			}

			const updates: any = {};

			const size = getBytesAsMegabytes(Number.parseFloat(metadata.format.size));
			if (size) updates.size = size.toFixed(2);

			const duration = Number.parseFloat(metadata.format.duration);
			if (duration) updates.duration = duration;

			const videoStream = metadata.streams.find(
				(stream) => stream.codec_type === "video",
			);
			if (!videoStream) throw new Error("Video stream not found");
			const width = videoStream.width;
			const height = videoStream.height;
			if (width) updates.width = width;
			if (height) updates.height = height;

			try {
				const filename = basename(asset.filename);
				const match = filename.match(/(\d{4}-\d{2}-\d{2})_(\d{2}-\d{2}-\d{2})/);

				if (match) {
					const [date, time] = match.slice(1);
					const [hour, min, sec] = time.split("-");
					const cTime = new Date(`${date}T${hour}:${min}:${sec}`);

					// test the date
					cTime.toISOString();

					if (cTime) {
						console.info("A creation time was parsed from the filename", cTime);
						updates.cTime = cTime;
					}
				}
			} catch (error) {
				console.warn(
					"Unable to parse creation time from filename, skipping...",
				);
			}

			await db
				.update(assets)
				.set({ ...updates, metadata })
				.where(eq(assets.id, asset.id));

			await assetProcessingQueue.add(
				AssetTasks.GENERATE_ASSET_VIDEO_THUMBNAIL,
				{
					assetId: asset.id,
				},
			);

			await assetProcessingQueue.add(AssetTasks.GENERATE_ASSET_VIDEO_PROXY, {
				assetId: asset.id,
			});
		} else if (asset.type === "IMAGE") {
			throw new Error("Image processing not implemented");
		} else {
			throw new Error("Invalid asset type");
		}
	} catch (error) {
		// Rethrow error for worker try catch
		throw error;
	} finally {
		console.info("Removing temporary directory");
		await rm(tmpDir, { recursive: true, force: true });
	}
}
