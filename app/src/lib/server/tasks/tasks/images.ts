import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { Worker } from "bullmq";
import sharp from "sharp";
import { v4 as uuid } from "uuid";
import { db } from "../../db/db";
import { assetThumbnails } from "../../db/schema";
import { env } from "../../lib/env";
import { downloadObject, uploadFileToS3 } from "../../lib/s3";
import { ImageTasks, bullConnection, imageProcessingQueue } from "../queues";

export interface ImageProxyJobData {
	assetId: string;
	sourceKey: string;
	sourceBucket: string;
}

interface ImageProxyJob {
	name: ImageTasks;
	data: ImageProxyJobData;
}

async function main() {
	const worker = new Worker(
		imageProcessingQueue.name,
		async (job: ImageProxyJob) => {
			const tmpDir = await mkdtemp(join(tmpdir(), "alcoves-"));
			console.info(`Created temporary directory: ${tmpDir}`);

			try {
				if (job.name === ImageTasks.GENERATE_IMAGE_PROXIES) {
					const sourceImage = await downloadObject({
						localDir: tmpDir,
						key: job.data.sourceKey,
						bucket: job.data.sourceBucket,
					});

					const filepath = join(tmpDir, "image.avif");

					const sizes = [
						{ size: "sm", width: 400, quality: 50 },
						{ size: "md", width: 800, quality: 65 },
						{ size: "lg", width: 1200, quality: 75 },
					];

					for (const size of sizes) {
						const compressedImage = await sharp(sourceImage)
							.resize({ width: 400 })
							.avif({ quality: 65 })
							.rotate() // auto-rotate based on EXIF data
							.toFile(filepath);

						const proxyStorageId = uuid();
						const storageBucket = env.ALCOVES_OBJECT_STORE_DEFAULT_BUCKET;
						const storageKey = `DEBUG/${proxyStorageId}`;

						const uploadedObject = await uploadFileToS3({
							filePath: filepath,
							key: storageKey,
							bucket: storageBucket,
							contentType: "image/avif",
						});

						const assetImageProxy = await db
							.insert(thumbnails)
							.values({
								assetId: job.data.assetId,
								size: compressedImage.size,
								width: compressedImage.width,
								height: compressedImage.height,
								storageBucket: storageBucket,
								storageKey: storageKey,
							})
							.returning();
					}

					const compressedImage = await sharp(sourceImage)
						.resize({ width: 400 })
						.avif({ quality: 65 })
						.rotate() // auto-rotate based on EXIF data
						.toFile(filepath);

					const proxyStorageId = uuid();
					const storageBucket = env.ALCOVES_OBJECT_STORE_DEFAULT_BUCKET;
					const storageKey = `DEBUG/${proxyStorageId}`;

					const uploadedObject = await uploadFileToS3({
						filePath: filepath,
						key: storageKey,
						bucket: storageBucket,
						contentType: "image/avif",
					});

					const assetThumbnail = await db
						.insert(assetThumbnails)
						.values({
							assetId: job.data.assetId,
							size: compressedImage.size,
							width: compressedImage.width,
							height: compressedImage.height,
							storageBucket: storageBucket,
							storageKey: storageKey,
						})
						.returning();
				}

				// switch (job.name) {
				// 	case ImageTasks.GENERATE_IMAGE_PROXIES:
				// 		console.log("Image proxy Job");
				// 		break;
				// 	case ImageTasks.FETCH_IMAGE_METADATA:
				// 		console.info("Downloading image", job.data);
				// 		const imagePath = await downloadObject({
				// 			localDir: tmpDir,
				// 			key: job.data.key,
				// 			bucket: job.data.bucket,
				// 		});
				// 		console.info("Parsing metadata");
				// 		const metadata = await sharp(imagePath).metadata();
				// 		// console.log(JSON.stringify(metadata, null, 2))

				// 		const compressedImage = await sharp(imagePath)
				// 			.resize({
				// 				width: 400,
				// 			})
				// 			.avif({
				// 				quality: 50,
				// 				// progressive: true,
				// 			})
				// 			.toBuffer();

				// 		console.info("Uploading compressed image");
				// 		const url = await uploadBufferToS3({
				// 			imageBuffer: compressedImage,
				// 			bucket: job.data.bucket,
				// 			key: "test.jpg",
				// 		});

				// 		// Update database
				// 		break;
				// 	default:
				// 		break;
				// }
			} catch (error) {
				console.error("Error processing image", error);
				throw error;
			} finally {
				console.info("Removing temporary directory");
				rm(tmpDir, { recursive: true, force: true });
			}
		},
		{
			connection: bullConnection,
			concurrency: Number.parseInt(env.ALCOVES_TASK_WORKER_CONCURRENCY || "1"),
		},
	);

	worker.on("completed", (job) => {
		console.log(`${job.id} has completed!`);
	});

	worker.on("failed", (job, err) => {
		console.log(`${job?.id} has failed with ${err.message}`);
	});

	console.info(
		`Starting worker: ${worker.name} for queue: ${imageProcessingQueue.name}`,
	);
}

export default main;
