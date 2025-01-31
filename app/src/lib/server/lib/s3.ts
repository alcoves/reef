import { env } from "./env";
import { join, relative } from "path";
import { promisify } from "util";
import { pipeline } from "node:stream";
import { Upload } from "@aws-sdk/lib-storage";
import { createReadStream, createWriteStream } from "node:fs";
import { readdir } from "node:fs/promises";
import { getMimeType } from "hono/utils/mime";

import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
	S3Client,
	UploadPartCommand,
	CreateMultipartUploadCommand,
	CompleteMultipartUploadCommand,
	type CreateMultipartUploadCommandInput,
	ListObjectsV2Command,
	DeleteObjectsCommand,
	GetObjectCommand,
	PutObjectCommand,
	type GetObjectCommandOutput,
} from "@aws-sdk/client-s3";

const pipelineAsync = promisify(pipeline);

export const s3InternalClient = new S3Client({
	region: env.ALCOVES_OBJECT_STORE_REGION,
	endpoint: env.ALCOVES_OBJECT_STORE_ENDPOINT,
	credentials: {
		accessKeyId: env.ALCOVES_OBJECT_STORE_ACCESS_KEY_ID,
		secretAccessKey: env.ALCOVES_OBJECT_STORE_SECRET_ACCESS_KEY,
	},
	forcePathStyle: true,
});

export const s3PublicClient = new S3Client({
	region: env.ALCOVES_OBJECT_STORE_REGION,
	endpoint: process.env.ALCOVES_OBJECT_STORE_PUBLIC_ENDPOINT || env.ALCOVES_OBJECT_STORE_ENDPOINT,
	credentials: {
		accessKeyId: env.ALCOVES_OBJECT_STORE_ACCESS_KEY_ID,
		secretAccessKey: env.ALCOVES_OBJECT_STORE_SECRET_ACCESS_KEY,
	},
	forcePathStyle: true,
});

export async function createMultipartUpload(data: CreateMultipartUploadCommandInput) {
	const response = await s3InternalClient.send(new CreateMultipartUploadCommand(data));

	if (!response.UploadId) throw new Error("UploadId not found");
	return response.UploadId;
}

export async function getUploadPartUrl({
	uploadId,
	partNumber,
	bucket,
	key,
}: {
	key: string;
	bucket: string;
	uploadId: string;
	partNumber: number;
}) {
	const uploadParams = {
		Key: key,
		Bucket: bucket,
		UploadId: uploadId,
		PartNumber: partNumber,
	};

	const command = new UploadPartCommand(uploadParams);
	const signedUrl = await getSignedUrl(s3InternalClient, command, { expiresIn: 3600 });

	return signedUrl;
}

export async function completeMultipartUpload({
	uploadId,
	bucket,
	key,
	parts,
}: {
	key: string;
	bucket: string;
	uploadId: string;
	parts: { ETag: string | undefined; PartNumber: number | undefined }[] | undefined;
}) {
	const completeParams = {
		Key: key,
		Bucket: bucket,
		UploadId: uploadId,
		MultipartUpload: {
			Parts: parts?.map((part, index) => ({
				ETag: part.ETag,
				PartNumber: index + 1,
			})),
		},
	};

	const command = new CompleteMultipartUploadCommand(completeParams);
	await s3InternalClient.send(command);
}

export async function deleteS3ObjectsByPrefix({
	bucket,
	prefix,
}: {
	bucket: string;
	prefix: string;
}) {
	const listObjectsResponse = await s3InternalClient.send(
		new ListObjectsV2Command({
			Prefix: prefix,
			Bucket: bucket,
		}),
	);

	if (!listObjectsResponse) return;

	if ((listObjectsResponse?.Contents?.length ?? 0) > 0) {
		const deleteParams = {
			Bucket: bucket,
			Delete: {
				Objects: listObjectsResponse?.Contents?.map(({ Key }) => ({
					Key,
				})),
			},
		};

		await s3InternalClient.send(new DeleteObjectsCommand(deleteParams));
	}
}

export async function downloadObject({
	localDir,
	bucket,
	key,
}: {
	localDir: string;
	bucket: string;
	key: string;
}): Promise<string> {
	const downloadPath = join(localDir, "downloadedFile");

	console.log("Downloading object", key, "from", bucket, "to", downloadPath);

	try {
		const command = new GetObjectCommand({ Bucket: bucket, Key: key });
		const response = await s3InternalClient.send(command);
		await pipelineAsync(response.Body as ReadableStream, createWriteStream(downloadPath));
		console.log(`Successfully downloaded ${key} from ${bucket} to ${downloadPath}`);
	} catch (error) {
		throw error;
	}

	return downloadPath;
}

export async function uploadBufferToS3({
	imageBuffer,
	bucket,
	key,
	contentType = "image/jpeg",
}: {
	imageBuffer: Buffer;
	bucket: string;
	key: string;
	contentType?: string;
}): Promise<string> {
	try {
		await s3InternalClient.send(
			new PutObjectCommand({
				Bucket: bucket,
				Key: key,
				Body: imageBuffer,
				ContentType: contentType,
			}),
		);

		// Assuming the S3 bucket is public, construct the URL
		// For private buckets, you might want to generate a signed URL instead
		const imageUrl = `${env.ALCOVES_OBJECT_STORE_ENDPOINT}/${bucket}/${key}`;
		console.log(`Image successfully uploaded to ${imageUrl}`);
		return imageUrl;
	} catch (error) {
		console.error("Failed to upload image to S3:", error);
		throw error;
	}
}

export async function getPresignedUrl({
	client = s3PublicClient,
	bucket,
	key,
	expiration = 3600,
}: {
	client?: S3Client;
	bucket: string;
	key: string;
	expiration?: number;
}): Promise<string> {
	const command = new GetObjectCommand({
		Bucket: bucket,
		Key: key,
	});

	return getSignedUrl(client, command, {
		expiresIn: expiration,
	});
}

export async function getObjectFromS3({
	bucket,
	key,
}: {
	bucket: string;
	key: string;
}): Promise<GetObjectCommandOutput> {
	try {
		const command = new GetObjectCommand({ Bucket: bucket, Key: key });
		return s3InternalClient.send(command);
	} catch (error) {
		console.error("Failed to get object from S3:", error);
		throw error;
	}
}

export async function uploadFileToS3({
	filePath,
	bucket,
	key,
	contentType,
}: {
	filePath: string;
	bucket: string;
	key: string;
	contentType: string;
}): Promise<{ location: string; key: string }> {
	try {
		const fileStream = createReadStream(filePath);
		const upload = new Upload({
			client: s3InternalClient,
			params: {
				Key: key,
				Bucket: bucket,
				Body: fileStream,
				ContentType: contentType,
			},
		});

		const result = await upload.done();
		return {
			location: result.Location!,
			key: result.Key!,
		};
	} catch (error) {
		console.error("Upload failed:", error);
		throw error;
	}
}

async function* getFilesRecursively(dir: string): AsyncGenerator<string> {
	const entries = await readdir(dir, { withFileTypes: true });
	for (const entry of entries) {
		const fullPath = join(dir, entry.name);
		if (entry.isDirectory()) {
			yield* getFilesRecursively(fullPath);
		} else {
			yield fullPath;
		}
	}
}

export async function uploadDirectoryToS3({
	dirPath,
	bucket,
	prefix = "",
}: {
	dirPath: string;
	bucket: string;
	prefix?: string;
}): Promise<Array<{ location: string; key: string }>> {
	const uploads: Promise<{ location: string; key: string }>[] = [];

	try {
		for await (const filePath of getFilesRecursively(dirPath)) {
			// Create S3 key preserving directory structure
			const relativePath = relative(dirPath, filePath);
			const key = prefix ? join(prefix, relativePath) : relativePath;

			// Queue upload
			uploads.push(
				uploadFileToS3({
					filePath,
					bucket,
					key,
					contentType: getMimeType(filePath) || "application/octet-stream",
				}),
			);
		}

		// Upload all files concurrently
		const results = await Promise.all(uploads);
		return results;
	} catch (error) {
		console.error("Directory upload failed:", error);
		throw error;
	}
}
