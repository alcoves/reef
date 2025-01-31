import path from "path";
import {
	CompleteMultipartUploadCommand,
	CreateMultipartUploadCommand,
	UploadPartCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { v4 as uuid } from "uuid";
import { z } from "zod";
import { db } from "../db/db";
import { assets } from "../db/schema";
import { env } from "../lib/env";
import { s3InternalClient, s3PublicClient } from "../lib/s3";
import { type UserAuthMiddleware, userAuth } from "../middleware/auth";
import { VideoTasks, videoProcessingQueue } from "../tasks/queues";
import type {
	VideoProxyJobData,
	VideoThumbnailJobData,
} from "../tasks/tasks/videos";

const router = new Hono<{ Variables: UserAuthMiddleware }>();
router.use(userAuth);

router.post(
	"/",
	zValidator(
		"json",
		z.object({
			size: z.number(),
			filename: z.string(),
			contentType: z.string(),
			parts: z.number(),
		}),
	),
	async (c) => {
		// const { user } = c.get("authorization");
		const { filename, contentType, size, parts } = c.req.valid("json");

		const assetId = uuid();
		const storageKey = `${env.ALCOVES_OBJECT_STORE_ASSETS_PREFIX}/${assetId}/${assetId}`;

		const [asset] = await db
			.insert(assets)
			.values({
				id: assetId,
				ownerId: c.get("authorization").user.id,
				title: path.parse(filename).name || "New Upload",
				description: "",
				metadata: {},
				size: size || 0,
				storageKey,
				status: "UPLOADING",
				storageBucket: env.ALCOVES_OBJECT_STORE_DEFAULT_BUCKET,
				mimeType: contentType || "application/octet-stream",
			})
			.returning();

		const createCommand = new CreateMultipartUploadCommand({
			Key: storageKey,
			ContentType: contentType,
			Bucket: env.ALCOVES_OBJECT_STORE_DEFAULT_BUCKET,
		});

		const { UploadId } = await s3InternalClient.send(createCommand);

		const signedUrls = await Promise.all(
			Array.from({ length: parts }, (_, i) => i + 1).map(async (partNumber) => {
				const command = new UploadPartCommand({
					UploadId,
					Key: storageKey,
					PartNumber: partNumber,
					Bucket: env.ALCOVES_OBJECT_STORE_DEFAULT_BUCKET,
				});

				const signedUrl = await getSignedUrl(s3PublicClient, command, {
					expiresIn: 3600 * 24, // 24 hours
				});

				return {
					signedUrl,
					partNumber,
				};
			}),
		);

		return c.json({
			payload: {
				key: storageKey,
				assetId: asset.id,
				parts: signedUrls,
				uploadId: UploadId,
			},
		});
	},
);

router.post(
	"/complete",
	zValidator(
		"json",
		z.object({
			key: z.string(),
			uploadId: z.string(),
			assetId: z.string(),
			parts: z.array(
				z.object({
					ETag: z.string(),
					PartNumber: z.number(),
				}),
			),
		}),
	),
	async (c) => {
		const { key, uploadId, parts, assetId } = c.req.valid("json");

		try {
			const command = new CompleteMultipartUploadCommand({
				Bucket: env.ALCOVES_OBJECT_STORE_DEFAULT_BUCKET,
				Key: key,
				UploadId: uploadId,
				MultipartUpload: {
					Parts: parts.map(({ ETag, PartNumber }) => ({
						ETag,
						PartNumber,
					})),
				},
			});

			const result = await s3InternalClient.send(command);

			const [asset] = await db
				.update(assets)
				.set({ status: "UPLOADED" })
				.where(eq(assets.id, assetId))
				.returning({
					id: assets.id,
					storageKey: assets.storageKey,
					storageBucket: assets.storageBucket,
				});

			await videoProcessingQueue.add(VideoTasks.GENERATE_VIDEO_THUMBNAIL, {
				assetId: asset.id,
				sourceKey: asset.storageKey,
				sourceBucket: asset.storageBucket,
			} as VideoThumbnailJobData);

			await videoProcessingQueue.add(VideoTasks.GENERATE_VIDEO_PROXIES, {
				assetId: asset.id,
				sourceKey: asset.storageKey,
				sourceBucket: asset.storageBucket,
			} as VideoProxyJobData);

			return c.json({
				payload: {
					asset,
					location: result.Location,
					key: result.Key,
					bucket: result.Bucket,
				},
			});
		} catch (error) {
			console.error("Complete multipart upload failed:", error);
			return c.json(
				{
					error: "Failed to complete multipart upload",
				},
				500,
			);
		}
	},
);

export const uploadsRouter = router;
