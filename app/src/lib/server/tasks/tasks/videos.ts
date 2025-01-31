import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { type Job, Worker } from "bullmq";
import { eq } from "drizzle-orm";
import { getMimeType } from "hono/utils/mime";
import sharp from "sharp";
import { v4 as uuid } from "uuid";
import { db } from "../../db/db";
import { assetProxies, assetThumbnails, assets } from "../../db/schema";
import { env } from "../../lib/env";
import { getMediaInfo, runFFmpeg } from "../../lib/ffmpeg";
import { pubClient } from "../../lib/redis";
import {
	downloadObject,
	getPresignedUrl,
	s3InternalClient,
	uploadDirectoryToS3,
	uploadFileToS3,
} from "../../lib/s3";
import { type WebSocketMessage, channelName } from "../../routes/ws";
import { getAsset } from "../../services/assets";
import { VideoTasks, bullConnection, videoProcessingQueue } from "../queues";

export interface VideoProxyJobData {
	assetId: string;
	sourceKey: string;
	sourceBucket: string;
}

export interface VideoThumbnailJobData {
	assetId: string;
	sourceKey: string;
	sourceBucket: string;
}

interface VideoProxyJob extends Job {
	name: VideoTasks;
	data: VideoProxyJobData;
}

const qualities = {
	av1: [
		{
			name: "av1_1080p",
			scale: "scale=-2:1080",
			crf: "36",
			codec: "libsvtav1",
			preset: "6",
			svtParams: "mbr=10000k",
		},
		{
			name: "av1_720p",
			scale: "scale=-2:720",
			crf: "36",
			codec: "libsvtav1",
			preset: "6",
			svtParams: "mbr=5500k",
		},
		{
			name: "av1_360p",
			scale: "scale=-2:360",
			crf: "36",
			codec: "libsvtav1",
			preset: "6",
			svtParams: "mbr=1000k",
		},
	],
	x264: [
		{
			name: "264_1080p",
			scale: "scale=-2:1080",
			crf: "20",
			codec: "libx264",
			preset: "medium",
			bitrate: { rate: "4000K", maxrate: "4000K", bufsize: "4000K" },
		},
		{
			name: "264_720p",
			scale: "scale=-2:720",
			crf: "20",
			codec: "libx264",
			preset: "medium",
			bitrate: { rate: "1500K", maxrate: "1500K", bufsize: "1500K" },
		},
		{
			name: "264_360p",
			scale: "scale=-2:360",
			crf: "20",
			codec: "libx264",
			preset: "medium",
			bitrate: { rate: "400K", maxrate: "400K", bufsize: "400K" },
		},
	],
};

async function main() {
	const client = await pubClient();

	const worker = new Worker(
		videoProcessingQueue.name,
		async (job: VideoProxyJob) => {
			const tmpDir = await mkdtemp(join(tmpdir(), "alcoves-"));
			console.info(`Created temporary directory: ${tmpDir}`);

			try {
				if (job.name === VideoTasks.GENERATE_VIDEO_PROXIES) {
					const downloadFirst = false;

					const proxyStorageId = uuid();
					const proxyStorageFolder = join(tmpDir, proxyStorageId);
					await mkdir(proxyStorageFolder, { recursive: true });

					const asset = await db.query.assets.findFirst({
						where: eq(assets.id, job.data.assetId),
					});

					if (!asset) {
						throw new Error("Asset not found");
					}

					const proxyStorageBucket = env.ALCOVES_OBJECT_STORE_DEFAULT_BUCKET;
					const proxyStorageKey = `${env.ALCOVES_OBJECT_STORE_ASSETS_PREFIX}/${asset.id}/streams/${proxyStorageId}`;
					const mainPlaylistName = "main.m3u8";
					const mainPlaylistKey = `${proxyStorageKey}/${mainPlaylistName}`;

					const assetVideoProxy = await db
						.insert(assetProxies)
						.values({
							id: proxyStorageId,
							type: "HLS",
							assetId: asset.id,
							storageBucket: proxyStorageBucket,
							storageKey: mainPlaylistKey,
						})
						.returning();

					let sourceUri = "";
					if (downloadFirst) {
						sourceUri = await downloadObject({
							localDir: tmpDir,
							key: job.data.sourceKey,
							bucket: job.data.sourceBucket,
						});
					} else {
						sourceUri = await getPresignedUrl({
							client: s3InternalClient,
							key: job.data.sourceKey,
							bucket: job.data.sourceBucket,
						});
					}

					// TODO :: getMediaInfo could be more strict on what it returns.
					const metadata = await getMediaInfo(sourceUri);
					// console.log("Video metadata:", metadata);

					if (metadata?.streams?.some((s) => s.codec_type === "video")) {
						const vStream = metadata.streams.find(
							(s) => s.codec_type === "video",
						);
						await db
							.update(assets)
							.set({
								metadata: metadata,
								duration: Number.parseFloat(metadata?.format.duration),
								width: vStream?.width,
								height: vStream?.height,
							})
							.where(eq(assets.id, asset.id));
					} else {
						throw new Error(
							"Failed to get media metadata, video could be missing streams or specific metadata",
						);
					}

					const { inputStreams, filters, streamMaps } = qualities.av1.reduce(
						(
							acc: {
								filters: string[];
								inputStreams: string[];
								streamMaps: string[];
							},
							cv,
							index,
							arr,
						) => {
							acc.filters.push(
								...[
									`-filter:v:${index}`,
									cv.scale,
									`-crf:v:${index}`,
									cv.crf,
									`-c:v:${index}`,
									cv.codec,
									`-preset:v:${index}`,
									cv.preset,
								],
							);

							if (cv.svtParams) {
								acc.filters.push(`-svtav1-params:${index}`, cv.svtParams);
							}

							if (cv.bitrate?.rate) {
								acc.filters.push(`-b:v:${index}`, cv.bitrate.rate);
							}

							if (cv?.bitrate?.maxrate) {
								acc.filters.push(`-maxrate:v:${index}`, cv.bitrate.maxrate);
							}

							if (cv?.bitrate?.bufsize) {
								acc.filters.push(`-bufsize:v:${index}`, cv.bitrate.bufsize);
							}

							acc.inputStreams.push("-map", "0:v:0"); //  '-map', 'a:0' is not added because we are creating a dedicated audio group
							acc.streamMaps.push(`v:${index},name:${cv.name},agroup:audio`);
							return acc;
						},
						{
							filters: [],
							inputStreams: ["-map", "0:a:0"],
							// Create a dedicated audio group. Then reference it in the video group. Set default audio to yes
							streamMaps: ["a:0,name:audio,agroup:audio,default:yes"],
						},
					);

					const commands = [
						"-hide_banner",
						// For each rendition we need a mapping
						...inputStreams,
						...filters,
						"-var_stream_map",
						streamMaps.join(" "),
						"-g",
						"300",
						"-c:a",
						"libopus", // "aac",
						"-b:a",
						"128k",
						"-ac",
						"2",
						"-f",
						"hls",
						"-hls_time",
						"6",
						"-hls_playlist_type",
						"vod",
						"-hls_flags",
						"independent_segments",
						"-hls_segment_type",
						"fmp4",
						"-hls_segment_filename",
						`${proxyStorageFolder}/stream_%v_%d.m4s`,
						"-hls_fmp4_init_filename",
						"stream_%v_init.mp4",
						"-master_pl_name",
						mainPlaylistName,
					];

					console.log("Starting FFmpeg process.");
					await runFFmpeg({
						input: sourceUri,
						output: `${proxyStorageFolder}/stream_%v.m3u8`,
						commands,
						onProgress: async (progress, estimatedTimeRemaining) => {
							await job.updateProgress(progress);
							await job.updateData({
								...job.data,
								estimatedTimeRemaining,
							});
							await db
								.update(assetProxies)
								.set({
									status: "PROCESSING",
									progress: progress,
									updatedAt: new Date(),
								})
								.where(eq(assetProxies.id, assetVideoProxy[0].id));
							await job.updateProgress(0.1);

							console.log(
								`Progress: ${progress}% - Estimated Time Remaining: ${estimatedTimeRemaining}`,
							);
						},
					})
						.then(async () => {
							console.log("FFmpeg processing completed successfully.");
							await job.updateProgress(100);

							await uploadDirectoryToS3({
								dirPath: proxyStorageFolder,
								prefix: proxyStorageKey,
								bucket: proxyStorageBucket,
							});

							await db.transaction(async (tx) => {
								await tx
									.update(assetProxies)
									.set({
										status: "READY",
										progress: 100,
										updatedAt: new Date(),
									})
									.where(eq(assetProxies.id, assetVideoProxy[0].id));

								await tx
									.update(assets)
									.set({
										status: "READY",
										updatedAt: new Date(),
									})
									.where(eq(assets.id, asset.id));
							});
						})
						.catch(async (error) => {
							console.error("FFmpeg processing failed:", error);
							// Update record with error status
							await db.transaction(async (tx) => {
								await tx
									.update(assetProxies)
									.set({
										status: "ERROR",
										updatedAt: new Date(),
									})
									.where(eq(assetProxies.id, assetVideoProxy[0].id));

								await tx
									.update(assets)
									.set({
										status: "ERROR",
										updatedAt: new Date(),
									})
									.where(eq(assets.id, asset.id));
							});

							throw new Error(error);
						});
				} else if (job.name === VideoTasks.GENERATE_VIDEO_THUMBNAIL) {
					const proxyStorageId = uuid();
					const proxyStorageName = `${proxyStorageId}.avif`;
					const proxyStorageBucket = env.ALCOVES_OBJECT_STORE_DEFAULT_BUCKET;
					const proxyStorageKey = `${env.ALCOVES_OBJECT_STORE_ASSETS_PREFIX}/${job.data.assetId}/thumbnails/${proxyStorageName}`;
					const thumbnailPath = join(tmpDir, "thumbnail.png");

					const sourceFileUrl = await getPresignedUrl({
						client: s3InternalClient,
						key: job.data.sourceKey,
						bucket: job.data.sourceBucket,
					});

					await runFFmpeg({
						input: sourceFileUrl,
						output: thumbnailPath,
						commands: ["-ss", "00:00:01", "-vframes", "1"],
					});

					const compressedImageLocalPath = join(tmpDir, proxyStorageName);
					const compressedImage = await sharp(thumbnailPath)
						.resize({ width: 400 })
						.avif({ quality: 65 })
						.rotate()
						.toFile(compressedImageLocalPath);

					await db.insert(assetThumbnails).values({
						size: compressedImage.size,
						height: compressedImage.height,
						width: compressedImage.width,
						assetId: job.data.assetId,
						storageBucket: proxyStorageBucket,
						storageKey: proxyStorageKey,
					});

					await uploadFileToS3({
						filePath: compressedImageLocalPath,
						key: proxyStorageKey,
						bucket: proxyStorageBucket,
						contentType: getMimeType(proxyStorageName) || "image/avif",
					});
				}
			} catch (error) {
				console.error("Error processing video", error);
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

	worker.on("progress", async (job) => {
		console.log(`${job.id} has updated!`);
		const asset = await getAsset(job.data.assetId);
		asset
			? client.publish(
					channelName,
					JSON.stringify({
						type: "ASSET_UPDATED",
						payload: asset,
					} as WebSocketMessage),
				)
			: null;
	});

	worker.on("completed", async (job) => {
		console.log(`${job.id} has completed!`);
		const asset = await getAsset(job.data.assetId);
		asset
			? client.publish(
					channelName,
					JSON.stringify({
						type: "ASSET_UPDATED",
						payload: asset,
					} as WebSocketMessage),
				)
			: null;
	});

	worker.on("failed", async (job, err) => {
		console.log(`${job?.id} has failed with ${err.message}`);
		if (job?.data?.assetId) {
			const asset = await getAsset(job.data.assetId);
			asset
				? client.publish(
						channelName,
						JSON.stringify({
							type: "ASSET_UPDATED",
							payload: asset,
						} as WebSocketMessage),
					)
				: null;
		}
	});

	console.info(
		`Starting worker: ${worker.name} for queue: ${videoProcessingQueue.name}`,
	);
}

export default main;
