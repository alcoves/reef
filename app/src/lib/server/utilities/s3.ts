import { readdir } from "node:fs/promises";
import { join, relative } from "node:path";
import {
	ListObjectsV2Command,
	type ListObjectsV2CommandInput,
	S3Client as S3AWSClientMethod,
} from "@aws-sdk/client-s3";
import { S3Client as S3BunClientMethod, type S3File } from "bun";
import mime from "mime";
import { env } from "./env";

export const ASSET_STORAGE_PREFIX = "assets";

export const S3AWSClient = new S3AWSClientMethod({
	region: env.ALCOVES_OBJECT_STORE_REGION!,
	endpoint: env.ALCOVES_OBJECT_STORE_ENDPOINT!,
	forcePathStyle: true,
	credentials: {
		accessKeyId: env.ALCOVES_OBJECT_STORE_ACCESS_KEY_ID!,
		secretAccessKey: env.ALCOVES_OBJECT_STORE_SECRET_ACCESS_KEY!,
	},
});

export const S3BunClient = new S3BunClientMethod({
	region: env.ALCOVES_OBJECT_STORE_REGION!,
	endpoint: env.ALCOVES_OBJECT_STORE_ENDPOINT!,
	bucket: env.ALCOVES_OBJECT_STORE_DEFAULT_BUCKET!,
	accessKeyId: env.ALCOVES_OBJECT_STORE_ACCESS_KEY_ID!,
	secretAccessKey: env.ALCOVES_OBJECT_STORE_SECRET_ACCESS_KEY!,
});

export async function getPresignedUrl({
	client = S3BunClient,
	bucket,
	key,
	expiresIn = 3600,
}: {
	client?: S3BunClientMethod;
	bucket: string;
	key: string;
	expiresIn?: number;
}): Promise<string> {
	const file = client.file(key, { bucket });
	return file.presign({ expiresIn });
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

	const file = S3BunClient.file(key, { bucket });
	const content = await file.arrayBuffer();
	await Bun.write(downloadPath, content);

	console.log(
		`Successfully downloaded ${key} from ${bucket} to ${downloadPath}`,
	);

	return downloadPath;
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
			const relativePath = relative(dirPath, filePath);
			const key = prefix ? join(prefix, relativePath) : relativePath;

			uploads.push(
				uploadFileToS3({
					filePath,
					bucket,
					key,
					contentType: mime.getType(filePath) || "application/octet-stream",
				}),
			);
		}

		return await Promise.all(uploads);
	} catch (error) {
		console.error("Directory upload failed:", error);
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
		const file = S3BunClient.file(key, { bucket });
		const fileContent = await Bun.file(filePath).arrayBuffer();
		await file.write(fileContent, { type: contentType });

		// Create signed URL for location
		const location = file.presign();

		return {
			location,
			key,
		};
	} catch (error) {
		console.error("Upload failed:", error);
		throw error;
	}
}

export async function getObjectFromS3({
	bucket,
	key,
}: {
	bucket: string;
	key: string;
}): Promise<S3File> {
	try {
		return S3BunClient.file(key, { bucket });
	} catch (error) {
		console.error("Failed to get object from S3:", error);
		throw error;
	}
}

const listAllKeys = async (
	params: ListObjectsV2CommandInput,
	out: any[] = [],
): Promise<any[]> => {
	const command = new ListObjectsV2Command(params);
	const response = await S3AWSClient.send(command);

	if (response.Contents) {
		out.push(...response.Contents);
	}

	if (response.IsTruncated) {
		const newParams: ListObjectsV2CommandInput = {
			...params,
			ContinuationToken: response.NextContinuationToken,
		};
		return listAllKeys(newParams, out);
	}

	return out;
};

export async function deletePrefixFromS3({
	bucket,
	prefix,
}: {
	bucket: string;
	prefix: string;
}): Promise<void> {
	try {
		// Validate the prefix format
		const uuidPattern = new RegExp(
			`^${env.ALCOVES_OBJECT_STORE_ASSETS_PREFIX}/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`,
			"i",
		);
		console.assert(
			prefix && uuidPattern.test(prefix),
			`Invalid prefix: ${prefix}`,
		);
		console.log("Deleting prefix", prefix, "from bucket", bucket);

		const files = await listAllKeys({ Bucket: bucket, Prefix: prefix }, []);

		await Promise.all(
			files.map(async ({ Key }) => {
				return S3BunClient.delete(Key);
			}),
		);

		console.log(`Successfully deleted objects with prefix ${prefix}`);
	} catch (error) {
		console.error(
			`Failed to delete prefix: s3://${bucket}/${prefix} from S3:`,
			error,
		);
		throw error;
	}
}
