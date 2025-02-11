import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { db } from "$lib/server/db/db";
import { assetProxies, assets } from "$lib/server/db/schema";
import {
	type VideoMetadata,
	qualities,
	runFFmpeg,
} from "$lib/server/utilities/ffmpeg";
import {
	downloadObject,
	getPresignedUrl,
	uploadDirectoryToS3,
} from "$lib/server/utilities/s3";
import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import type { AssetJob } from "../workers/assets";

export async function generateVideoProxy(job: AssetJob): Promise<void> {
	const tmpDir = await mkdtemp(join(tmpdir(), "alcoves-"));
	console.info(`Created temporary directory: ${tmpDir}`);

	try {
		console.info("Fetching asset");
		const [asset] = await db
			.select()
			.from(assets)
			.where(eq(assets.id, job.data.assetId));
		if (!asset) throw new Error(`Asset not found: ${job.data.assetId}`);

		const downloadFirst = false;
		const proxyStorageId = uuidv4();
		const proxyStorageFolder = join(tmpDir, proxyStorageId);
		const proxyStorageBucket = asset.storageBucket;
		const proxyStorageKey = `${asset.storagePrefix}/streams/${proxyStorageId}`;
		const mainPlaylistName = "main.m3u8";
		const mainPlaylistKey = `${proxyStorageKey}/${mainPlaylistName}`;
		await mkdir(proxyStorageFolder, { recursive: true });

		// TODO :: We should probably reset all HLS proxies to not default
		const assetVideoProxy = await db
			.insert(assetProxies)
			.values({
				id: proxyStorageId,
				type: "HLS",
				isDefault: true,
				assetId: asset.id,
				storageBucket: proxyStorageBucket,
				storageKey: mainPlaylistKey,
			})
			.returning();

		let sourceUri = "";
		if (downloadFirst) {
			sourceUri = await downloadObject({
				localDir: tmpDir,
				key: asset.storageKey,
				bucket: asset.storageBucket,
			});
		} else {
			sourceUri = await getPresignedUrl({
				key: asset.storageKey,
				bucket: asset.storageBucket,
			});
		}

		// TODO :: Could do better validation here
		const metadata = asset.metadata as VideoMetadata;
		const hasAudio = metadata.streams.some(
			(stream) => stream.codec_type === "audio",
		);

		const baseAcc = {
			filters: [] as string[],
			inputStreams: hasAudio ? ["-map", "0:a:0"] : ([] as string[]),
			streamMaps: hasAudio
				? ["a:0,name:audio,agroup:audio,default:yes"]
				: ([] as string[]),
		};

		const { inputStreams, filters, streamMaps } = qualities.av1.reduce(
			(
				acc: {
					filters: string[];
					inputStreams: string[];
					streamMaps: string[];
				},
				cv,
				index,
			) => {
				acc.filters.push(
					`-filter:v:${index}`,
					cv.scale,
					`-crf:v:${index}`,
					cv.crf,
					`-c:v:${index}`,
					cv.codec,
					`-preset:v:${index}`,
					cv.preset,
				);

				if (cv.svtParams) {
					acc.filters.push(`-svtav1-params:${index}`, cv.svtParams);
				}
				if (cv.bitrate?.rate) {
					acc.filters.push(`-b:v:${index}`, cv.bitrate.rate);
				}
				if (cv.bitrate?.maxrate) {
					acc.filters.push(`-maxrate:v:${index}`, cv.bitrate.maxrate);
				}
				if (cv.bitrate?.bufsize) {
					acc.filters.push(`-bufsize:v:${index}`, cv.bitrate.bufsize);
				}

				// Always map video stream
				acc.inputStreams.push("-map", "0:v:0");
				acc.streamMaps.push(`v:${index},name:${cv.name},agroup:audio`);

				return acc;
			},
			baseAcc,
		);

		const commands = [
			"-hide_banner",
			...inputStreams,
			...filters,
			"-var_stream_map",
			streamMaps.join(" "),
			"-g",
			"300",
			"-c:a",
			"libopus", // or "aac" if preferred
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

		console.info("Video proxy generation complete");
	} catch (error) {
		throw error;
	} finally {
		console.info("Removing temporary directory");
		await rm(tmpDir, { recursive: true, force: true });
	}
}
