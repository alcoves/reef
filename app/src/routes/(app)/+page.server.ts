import path from "path";
import { db } from "$lib/server/db/db";
import { type AssetProxy, assets } from "$lib/server/db/schema";
import { AssetTasks, assetProcessingQueue } from "$lib/server/tasks/queues";
import { env } from "$lib/server/utilities/env";
import {
	ASSET_STORAGE_PREFIX,
	S3AWSClient,
	getPresignedUrl,
} from "$lib/server/utilities/s3";
import {
	CompleteMultipartUploadCommand,
	CreateMultipartUploadCommand,
	UploadPartCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { type Actions, fail } from "@sveltejs/kit";
import { and, eq, inArray } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import type { PageServerLoad } from "./$types";

import { dispatchAssetNotification } from "$lib/server/services/notify";
import { z } from "zod";

const mimeTypeValidator = z
	.string()
	.refine((val) => val.startsWith("image/") || val.startsWith("video/"), {
		message: "Invalid MIME type. Must be an image or video type",
	});

const createUploadSchema = z.object({
	filename: z.string().min(1, { message: "Filename is required" }),
	totalParts: z
		.string()
		.min(1, { message: "Total parts is required" })
		.transform((val) => Number.parseInt(val, 10))
		.refine((val) => !isNaN(val) && val > 0, {
			message: "Total parts must be a positive number",
		}),
	type: mimeTypeValidator,
});

const completeUploadSchema = z.object({
	key: z.string().min(1, { message: "Storage key is required" }),
	uploadId: z.string().min(1, { message: "Upload ID is required" }),
	parts: z.preprocess(
		(arg) => {
			if (typeof arg === "string") {
				try {
					return JSON.parse(arg);
				} catch (e) {
					return arg;
				}
			}
			return arg;
		},
		z.array(
			z.object({
				ETag: z.string(),
				PartNumber: z.number(),
			}),
		),
	),
	assetId: z.string().uuid({ message: "Invalid asset ID format" }),
	type: mimeTypeValidator,
	filename: z.string().min(1, { message: "Filename is required" }),
});

const validateFormData = async <T extends z.ZodSchema>(
	formData: FormData,
	schema: T,
): Promise<
	{ success: true; data: z.infer<T> } | { success: false; error: z.ZodError }
> => {
	try {
		const data = Object.fromEntries(formData);
		const validatedData = await schema.parseAsync(data);
		return { success: true, data: validatedData };
	} catch (error) {
		if (error instanceof z.ZodError) {
			return { success: false, error };
		}
		throw error;
	}
};

type CreateUploadInput = z.infer<typeof createUploadSchema>;
type CompleteUploadInput = z.infer<typeof completeUploadSchema>;

function getAssetType(mimeType: string): "IMAGE" | "VIDEO" {
	if (mimeType.startsWith("image/")) return "IMAGE";
	if (mimeType.startsWith("video/")) return "VIDEO";
	throw new Error("Invalid asset type");
}

export const load: PageServerLoad = async ({ locals }) => {
	const getDeleted = false;

	function getThumbnailFromProxies(proxies: AssetProxy[]): AssetProxy | null {
		if (!proxies) return null;
		const thumbnails = proxies.filter((proxy) => proxy.type === "THUMBNAIL");
		if (thumbnails.length === 0) return null;
		const selectedThumbnail = thumbnails.find(
			(thumbnail) => thumbnail.isDefault,
		);
		if (!selectedThumbnail) return thumbnails[0];
		return selectedThumbnail;
	}

	const assetsList = await db.query.assets.findMany({
		orderBy: (assets, { desc }) => [desc(assets.createdAt)],
		with: {
			proxies: {
				orderBy: (proxies, { desc }) => [desc(proxies.status)],
			},
		},
		where: (assets, { eq }) =>
			eq(assets.ownerId, locals.user.id) && eq(assets.deleted, getDeleted),
	});

	const enrichedAssets = await Promise.all(
		assetsList.map(async (asset) => {
			const thumbnail = getThumbnailFromProxies(asset.proxies);
			const thumbnailUrl = thumbnail
				? await getPresignedUrl({
						bucket: thumbnail.storageBucket,
						key: thumbnail.storageKey,
					})
				: null;
			return {
				...asset,
				thumbnail: {
					url: thumbnailUrl,
					...thumbnail,
				},
			};
		}),
	);

	return { assets: enrichedAssets };
};

export const actions = {
	deleteAssets: async ({ request, locals }) => {
		if (!locals.user) throw fail(401);
		const data = await request.formData();
		const assetIds = data.get("assetIds")?.toString();
		if (!assetIds) return { success: false };
		const ids = assetIds.split(",").map((id) => id.trim());

		await db
			.update(assets)
			.set({ deleted: true })
			.where(and(inArray(assets.id, ids), eq(assets.ownerId, locals.user.id)));

		await dispatchAssetNotification(
			"assets",
			"ASSET_DELETED",
			ids.map((id) => ({ id })),
		);

		return { success: true };
	},
	createUpload: async ({ request, locals }) => {
		if (!locals.user) throw fail(401);
		const formData = await request.formData();

		const validation = await validateFormData(formData, createUploadSchema);
		if (!validation.success) {
			return fail(400, {
				error: true,
				message: "Invalid form data",
				issues: validation.error.issues,
			});
		}

		const { filename, totalParts, type } = validation.data;
		const assetId = uuidv4();
		const storageKey = `${ASSET_STORAGE_PREFIX}/${assetId}/${assetId}`;

		const createCommand = new CreateMultipartUploadCommand({
			Key: storageKey,
			ContentType: type,
			Bucket: env.ALCOVES_OBJECT_STORE_DEFAULT_BUCKET,
		});
		const { UploadId } = await S3AWSClient.send(createCommand);

		const uploadUrls = await Promise.all(
			Array.from({ length: totalParts }, (_, i) => i + 1).map(
				async (partNumber) => {
					const command = new UploadPartCommand({
						UploadId,
						Key: storageKey,
						PartNumber: partNumber,
						Bucket: env.ALCOVES_OBJECT_STORE_DEFAULT_BUCKET,
					});
					const signedUrl = await getSignedUrl(S3AWSClient, command, {
						expiresIn: 3600 * 24, // 24 hours
					});
					return { signedUrl, partNumber };
				},
			),
		);

		return { assetId, storageKey, uploadId: UploadId, uploadUrls };
	},

	completeUpload: async ({ request, locals }) => {
		if (!locals.user) throw fail(401);
		const formData = await request.formData();

		const validation = await validateFormData(formData, completeUploadSchema);
		if (!validation.success) {
			return fail(400, {
				error: true,
				message: "Invalid form data",
				issues: validation.error.issues,
			});
		}

		const { key, uploadId, parts, assetId, type, filename } = validation.data;

		const command = new CompleteMultipartUploadCommand({
			Bucket: env.ALCOVES_OBJECT_STORE_DEFAULT_BUCKET,
			Key: key,
			UploadId: uploadId,
			MultipartUpload: {
				Parts: parts.map((p: { ETag: string; PartNumber: number }) => ({
					ETag: p.ETag,
					PartNumber: p.PartNumber,
				})),
			},
		});
		await S3AWSClient.send(command);

		const assetStoragePrefix = `${ASSET_STORAGE_PREFIX}/${assetId}`;
		const [asset] = await db
			.insert(assets)
			.values({
				id: assetId,
				ownerId: locals.user.id,
				type: getAssetType(type),
				status: "UPLOADED",
				title: path.parse(filename).name,
				filename,
				mimeType: type,
				storagePrefix: assetStoragePrefix,
				storageKey: `${assetStoragePrefix}/${assetId}`,
				storageBucket: process.env.ALCOVES_OBJECT_STORE_DEFAULT_BUCKET!,
			})
			.returning();

		await dispatchAssetNotification("assets", "ASSET_CREATED", [asset]);
		await assetProcessingQueue.add(AssetTasks.INGEST_ASSET, { assetId });
		return { success: true };
	},
} satisfies Actions;
