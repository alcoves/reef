import { type Actions, fail } from "@sveltejs/kit";
import { S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";

const internalS3Client = new S3Client({
  region: process.env.ALCOVES_OBJECT_STORE_REGION!,
  endpoint: process.env.ALCOVES_OBJECT_STORE_ENDPOINT!,
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.ALCOVES_OBJECT_STORE_ACCESS_KEY_ID!,
    secretAccessKey: process.env.ALCOVES_OBJECT_STORE_SECRET_ACCESS_KEY!
  }
});

export const actions = {
  upload: async ({ request }) => {
    try {
      const contentType = request.headers.get('content-type');
      if (!contentType?.includes('multipart/form-data')) {
        return fail(400, { error: true, message: "Invalid content type" });
      }

      const boundary = contentType.split('boundary=')[1];
      if (!boundary) {
        return fail(400, { error: true, message: "No boundary found" });
      }

      const key = `uploads/${Date.now()}-${getFilenameFromHeader(request.headers)}`;

      const parallelUpload = new Upload({
        client: internalS3Client,
        queueSize: 4,
        partSize: 25 * 1024 * 1024,
        leavePartsOnError: false,
        params: {
          Bucket: process.env.ALCOVES_OBJECT_STORE_DEFAULT_BUCKET!,
          Key: key,
          Body: request.body ?? undefined,
          ContentType: getContentTypeFromHeader(request.headers)
        }
      });

      await parallelUpload.done();

      return {
        success: true,
        key
      };

    } catch (error) {
      console.error("Upload error:", error);
      return fail(500, { error: true, message: "Upload failed" });
    }
  }
} satisfies Actions;

function getFilenameFromHeader(headers: Headers): string {
  const contentDisposition = headers.get('content-disposition');
  if (!contentDisposition) return 'unknown';
  
  const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
  return filenameMatch ? filenameMatch[1] : 'unknown';
}

function getContentTypeFromHeader(headers: Headers): string {
  const contentType = headers.get('content-disposition');
  if (!contentType) return 'application/octet-stream';
  
  const contentTypeMatch = contentType.match(/content-type="?([^"]+)"?/);
  return contentTypeMatch ? contentTypeMatch[1] : 'application/octet-strea';
}