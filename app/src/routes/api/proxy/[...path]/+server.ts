import { Readable } from "stream";
import { env } from "$lib/server/utilities/env.js";
import { S3AWSClient, getPresignedUrl } from "$lib/server/utilities/s3";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { error } from "@sveltejs/kit";

const shouldRedirect = false;

export async function GET({ url, params, request }) {
	try {
		// Get the path from the URL
		const key = url.pathname.replace(/^\/api\/proxy\//, "");

		if (shouldRedirect) {
			const signedUrl = await getPresignedUrl({
				bucket: env.ALCOVES_OBJECT_STORE_DEFAULT_BUCKET,
				key,
			});
			return new Response(null, {
				status: 302,
				headers: { Location: signedUrl },
			});
		}

		// Parse range header
		const range = request.headers.get("range");
		let rangeParams = {};

		if (range) {
			const parts = range.replace(/bytes=/, "").split("-");
			const start = Number.parseInt(parts[0], 10);
			const end = parts[1] ? Number.parseInt(parts[1], 10) : undefined;

			rangeParams = {
				Range: range,
			};
		}

		// Create GetObject command with optional range
		const command = new GetObjectCommand({
			Bucket: env.ALCOVES_OBJECT_STORE_DEFAULT_BUCKET,
			Key: key,
			...rangeParams,
		});

		// Get object from S3
		const s3Response = await S3AWSClient.send(command);

		// Ensure s3Response.Body is defined and cast it to an AsyncIterable if needed
		if (!s3Response.Body) {
			throw error(500, "S3 response body is undefined");
		}

		const readable = Readable.from(s3Response.Body as AsyncIterable<any>);
		const stream = new ReadableStream({
			start(controller) {
				readable.on("data", (chunk) => controller.enqueue(chunk));
				readable.on("end", () => controller.close());
				readable.on("error", (err) => controller.error(err));
			},
		});

		// Prepare response headers
		const headers = new Headers();
		if (s3Response.ContentType)
			headers.set("Content-Type", s3Response.ContentType);
		headers.set("Accept-Ranges", "bytes");
		if (s3Response.ETag) headers.set("ETag", s3Response.ETag);
		if (s3Response.LastModified)
			headers.set("Last-Modified", s3Response.LastModified.toUTCString());

		// Set appropriate headers for range request
		if (s3Response.ContentRange) {
			headers.set("Content-Range", s3Response.ContentRange);
			return new Response(stream, {
				status: 206,
				headers,
			});
		}

		// Set Content-Length for full response
		if (s3Response.ContentLength) {
			headers.set("Content-Length", s3Response.ContentLength.toString());
		}

		// Return the response
		return new Response(stream, {
			headers,
		});
	} catch (err) {
		// Handle S3 errors
		if (err.$metadata?.httpStatusCode === 404) {
			throw error(404, "File not found");
		}

		console.error("Error proxying S3 request:", err);
		throw error(500, "Internal server error");
	}
}

// Handle HEAD requests
export async function HEAD(event) {
	return GET(event);
}

// Configure CORS
export function OPTIONS() {
	return new Response(null, {
		headers: {
			"Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
			"Access-Control-Allow-Origin": "*",
			"Access-Control-Allow-Headers": "Range, Accept-Ranges, Content-Range, *",
		},
	});
}
