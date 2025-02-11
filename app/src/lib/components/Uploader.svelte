<script lang="ts">
import { deserialize } from "$app/forms";
import type { ActionResult } from "@sveltejs/kit";
import { UploadIcon } from "lucide-svelte";
import pLimit from "p-limit";
import PQueue from "p-queue";
import { v5 as uuidv5 } from "uuid";

interface Upload {
	file: File;
	id: string;
	chunkSize: number;
	progress: number;
	urlProgress: {
		[key: string]: number;
	};
	status: "queued" | "uploading" | "completed" | "failed";
}

interface CreateUploadFormResponseData {
	assetId: string;
	storageKey: string;
	uploadId: string;
	uploadUrls: { signedUrl: string; partNumber: number }[];
}

function getChunkSize(totalSize: number): number {
	const _25mb = 25 * 1024 * 1024;
	const _50mb = 50 * 1024 * 1024;
	const _100mb = 100 * 1024 * 1024;
	const _250mb = 250 * 1024 * 1024;
	const _500mb = 500 * 1024 * 1024;
	const _3gb = 3000 * 1024 * 1024;
	const _10gb = 10000 * 1024 * 1024;

	const DEFAULT_CHUNK_SIZE = _25mb;

	if (totalSize <= DEFAULT_CHUNK_SIZE) {
		return DEFAULT_CHUNK_SIZE;
	} else if (totalSize <= _500mb) {
		return _50mb;
	} else if (totalSize <= _3gb) {
		return _100mb;
	} else if (totalSize <= _10gb) {
		return _250mb;
	} else {
		return _500mb;
	}
}

const GB = 20;
const MAX_FILE_SIZE = GB * 1024 * 1024 * 1024;
const authorizedMimeTypes = ["image/*", "video/*"];
let modalOpen = $state(false);
let files: FileList | undefined = $state();
let uploads = $state<Upload[]>([]);
const uploadQueue = new PQueue({ concurrency: 2 });

import.meta?.hot?.dispose(() => {
	console.log("hot reload detected, clearing uploads");
	uploads = [];
	files = undefined;
	modalOpen = false;
});

function validateFile(file: File): { valid: boolean; error: string } {
	if (
		!authorizedMimeTypes.some((type) =>
			type.endsWith("/*")
				? file.type.startsWith(type.slice(0, -2))
				: file.type === type,
		)
	) {
		return { valid: false, error: "File type not supported" };
	}
	if (file.size > MAX_FILE_SIZE) {
		return { valid: false, error: `File too large (max ${GB})` };
	}
	return { valid: true, error: "" };
}

async function startUpload(upload: Upload) {
	const chunks: Blob[] = [];
	const multipartUploadLimit = pLimit(4);

	for (let start = 0; start < upload.file.size; start += upload.chunkSize) {
		const chunk = upload.file.slice(start, start + upload.chunkSize);
		chunks.push(chunk);
	}

	const totalParts = chunks.length;

	function updateUpload(updates: Partial<Upload>) {
		const idx = uploads.findIndex((u) => u.id === upload.id);
		if (idx !== -1) {
			Object.assign(uploads[idx], updates);
		}
	}

	function recalculateTotalProgress(upload: Upload, totalParts: number) {
		const totalProgress = Object.values(upload.urlProgress).reduce(
			(a, b) => a + b,
			0,
		);
		updateUpload({ progress: Math.round(totalProgress / totalParts) });
	}

	async function uploadPart(url: string, chunk: Blob, upload: Upload) {
		return new Promise((resolve, reject) => {
			const xhr = new XMLHttpRequest();
			xhr.open("PUT", url, true);
			xhr.setRequestHeader("Content-Type", "application/octet-stream");

			xhr.upload.onprogress = (e) => {
				if (!e.total || !e.loaded) return;
				const progress = Math.round((e.loaded * 100) / e.total);
				upload.urlProgress[url] = progress;
				recalculateTotalProgress(upload, totalParts);
			};

			xhr.onload = () => {
				if (xhr.status >= 200 && xhr.status < 300) {
					resolve(xhr.getResponseHeader("etag"));
				} else {
					reject(new Error(`HTTP Error: ${xhr.status}`));
				}
			};

			xhr.onerror = () => {
				reject(new Error("Network Error"));
			};

			xhr.send(chunk);
		});
	}

	const createUploadFormData = new FormData();
	createUploadFormData.append("filename", upload.file.name);
	createUploadFormData.append("totalParts", totalParts.toString());
	createUploadFormData.append("type", upload.file.type);

	const createUploadResponse = await fetch("?/createUpload", {
		method: "POST",
		body: createUploadFormData,
	});

	// Get form response
	updateUpload({ status: "uploading" });
	const result: ActionResult = deserialize(await createUploadResponse.text());
	const createUploadResponseData: CreateUploadFormResponseData = result.data;

	if (result.type === "success") {
		console.log("Success", result);
	} else {
		console.error("Error", result);
		return;
	}

	const { assetId, storageKey, uploadId, uploadUrls } =
		createUploadResponseData;
	console.log({ assetId, storageKey, uploadId, uploadUrls });

	const completedParts = await Promise.all(
		chunks.map((chunk, index) =>
			multipartUploadLimit(async () => {
				const { signedUrl, partNumber } = uploadUrls[index];
				const etag = await uploadPart(signedUrl, chunk, upload);
				if (!etag) {
					throw new Error("ETag is null");
				}
				return { ETag: etag, PartNumber: partNumber };
			}),
		),
	);

	console.log("completedParts", completedParts.length);
	console.log("createUploadResponse", createUploadResponse);

	const completeUploadFormData = new FormData();
	completeUploadFormData.append("key", storageKey);
	completeUploadFormData.append("uploadId", uploadId);
	completeUploadFormData.append("assetId", assetId);
	completeUploadFormData.append("type", upload.file.type);
	completeUploadFormData.append("filename", upload.file.name);
	completeUploadFormData.append("parts", JSON.stringify(completedParts));

	const completeUploadResponse = await fetch("?/completeUpload", {
		method: "POST",
		body: completeUploadFormData,
	});

	console.log("completeUploadResponse", completeUploadResponse);
	updateUpload({ progress: 100, status: "completed" });

	// Remove upload from the queue
	const idx = uploads.findIndex((u) => u.id === upload.id);
	if (idx !== -1) {
		uploads.splice(idx, 1);
	}
}

$effect(() => {
	if (files?.length) {
		for (const file of files) {
			const { valid, error } = validateFile(file);
			if (!valid) {
				console.error(`${file.name}: ${error}`);
				continue;
			}

			const upload: Upload = {
				file,
				progress: 0,
				status: "queued",
				id: uuidv5(file.name, uuidv5.URL),
				urlProgress: {},
				chunkSize: getChunkSize(file.size),
			};
			uploads.push(upload);
			uploadQueue.add(() => startUpload(upload));
		}

		files = undefined;
		modalOpen = true;
	}

	if (!files?.length && !uploads.length) modalOpen = false;
});

function beforeunload(e: BeforeUnloadEvent) {
	const hasActiveUploads = uploads.some(
		({ status }) => status === "queued" || status === "uploading",
	);

	if (hasActiveUploads) {
		// Modern approach - just show default browser message
		e.preventDefault();
		// Return undefined to let browser handle the confirmation dialog
		return undefined;
	}
}
</script>

<svelte:window onbeforeunload={beforeunload} />

<div class="flex flex-col gap-4">
  <div>
    <input
      bind:files
      multiple
      type="file"
      id="uploadInput"
      class="hidden"
      accept={authorizedMimeTypes.join(",")}
    />

    {#if Object.keys(uploads).length}
      <button
        class="btn btn-primary min-w-[140px]"
        onclick={() => (modalOpen = true)}
      >
        <span class="loading loading-ring loading-sm"></span>
        {"Uploading"}
      </button>
    {:else}
      <label for="uploadInput" class="btn btn-primary min-w-[140px]">
        <UploadIcon size="1.2rem" />
        {"Upload"}
      </label>
    {/if}
  </div>

  <dialog class="modal" class:modal-open={modalOpen}>
    <div class="modal-box">
      <h3 class="text-lg font-bold">Uploader</h3>
      <p class="py-4">
        {`There are ${uploads.length} files in the upload queue`}
      </p>
      {#if uploads.length}
        <div class="flex flex-col w-full gap-4">
          {#each uploads as upload}
            <div
              class="p-2 flex flex-col w-full rounded-md border-2 border-primary"
            >
              <p class="truncate">
                {upload.file.name} - {upload.progress} - {upload.status}
              </p>
              <progress
                max="100"
                value={upload.progress || 1}
                class="progress w-full"
              ></progress>
            </div>
          {/each}
        </div>
      {/if}
      <div class="modal-action">
        <button class="btn" onclick={() => (modalOpen = false)}>Close</button>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop">
      <button onclick={() => (modalOpen = false)}>Close</button>
    </form>
  </dialog>
</div>
