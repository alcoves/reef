import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { db } from "$lib/server/db/db";
import { assetProxies, assets } from "$lib/server/db/schema";
import { env } from "$lib/server/utilities/env";
import { runFFmpeg } from "$lib/server/utilities/ffmpeg";
import { getPresignedUrl, uploadFileToS3 } from "$lib/server/utilities/s3";
import { eq } from "drizzle-orm";
import mime from "mime";
import sharp from "sharp";
import { v4 as uuidv4 } from "uuid";
import type { AssetJob } from "../workers/assets";

export async function generateVideoThumbnail(job: AssetJob): Promise<void> {
	const tmpDir = await mkdtemp(join(tmpdir(), "alcoves-"));
	console.info(`Created temporary directory: ${tmpDir}`);

	try {
		console.info("Fetching asset");
		const [asset] = await db
			.select()
			.from(assets)
			.where(eq(assets.id, job.data.assetId));
		if (!asset) throw new Error(`Asset not found: ${job.data.assetId}`);

		const thumbnailPath = join(tmpDir, "thumbnail.png");
		const proxyStorageId = uuidv4();
		const proxyStorageName = `${proxyStorageId}.avif`;
		const proxyStorageBucket = env.ALCOVES_OBJECT_STORE_DEFAULT_BUCKET;
		const proxyStorageKey = `${asset.storagePrefix}/thumbnails/${proxyStorageName}`;
		const compressedImageLocalPath = join(tmpDir, proxyStorageName);

		console.info("Getting source media signed url");
		const sourceMediaUrl = await getPresignedUrl({
			key: asset.storageKey,
			bucket: asset.storageBucket,
		});

		console.info("Generating thumbnail");
		// TODO :: If this fails we should use a fallback thumbnail?
		await runFFmpeg({
			input: sourceMediaUrl,
			output: thumbnailPath,
			commands: ["-ss", "0", "-vframes", "1"],
		});

		console.info("Compressing thumbnail");
		const compressedImage = await sharp(thumbnailPath)
			.resize({ width: 400 })
			.avif({ quality: 65 })
			.rotate()
			.toFile(compressedImageLocalPath);

		console.info("Uploading thumbnail");
		await uploadFileToS3({
			filePath: compressedImageLocalPath,
			key: proxyStorageKey,
			bucket: proxyStorageBucket,
			contentType: mime.getType(proxyStorageName) || "image/avif",
		});

		await db.insert(assetProxies).values({
			assetId: asset.id,
			isDefault: true,
			status: "READY",
			type: "THUMBNAIL",
			storageKey: proxyStorageKey,
			storageBucket: proxyStorageBucket,
			size: compressedImage.size,
			width: compressedImage.width,
			height: compressedImage.height,
		});

		// TODO:: In cases or reprocessing or additional thumbnails
		// we should mark the previous thumbnails as not default
		console.info("Thumbnail generation complete");
	} catch (error) {
		throw error;
	} finally {
		console.info("Removing temporary directory");
		await rm(tmpDir, { recursive: true, force: true });
	}
}
