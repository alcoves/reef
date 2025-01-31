<script lang="ts">
  import { UploadIcon } from "lucide-svelte";
  import pLimit from "p-limit";
  import { v5 as uuidv5 } from "uuid";

  interface Upload {
    file: File;
    id: string;
    progress: number;
    status: "queued" | "uploading" | "completed" | "failed";
  }

  const uploadLimiter = pLimit(4);
  const GB = 20;
  const MAX_FILE_SIZE = GB * 1024 * 1024 * 1024;
  const authorizedMimeTypes = ["image/*", "video/*"];
  let modalOpen = $state(false);
  let files: FileList | undefined = $state();
  let uploads = $state<Upload[]>([]);

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
    uploads.push(upload);

    const formData = new FormData();
    formData.append("file", upload.file);

    const updateUpload = (updates: Partial<Upload>) => {
      const idx = uploads.findIndex((u) => u.id === upload.id);
      if (idx !== -1) {
        Object.assign(uploads[idx], updates);
      }
    };

    try {
      updateUpload({ status: "uploading" });

      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            updateUpload({
              progress: Math.round((event.loaded / event.total) * 100),
            });
          }
        };

        xhr.onload = () =>
          xhr.status === 200
            ? resolve(xhr.response)
            : reject(new Error("Upload failed"));
        xhr.onerror = () => reject(new Error("Upload failed"));
        xhr.open("POST", "?/upload");

        const safeFileName = encodeURIComponent(upload.file.name);
        xhr.setRequestHeader(
          "Content-Disposition",
          `form-data; content-type="${upload.file.type}"; filename="${safeFileName}"`,
        );

        xhr.send(formData);
      });

      updateUpload({ progress: 100, status: "completed" });
      uploads = uploads.filter((u) => u.id !== upload.id);
    } catch (error) {
      updateUpload({ status: "failed" });
      console.error(error);
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

        uploadLimiter(() => {
          modalOpen = true;
          startUpload({
            file,
            progress: 0,
            status: "queued",
            id: uuidv5(file.name, uuidv5.URL),
          });
        });
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
        {`There are ${Object.keys(uploads).length} files in the upload queue`}
      </p>
      {#if Object.keys(uploads).length}
        <div class="flex flex-col w-full gap-4">
          {#each Object.values(uploads) as upload}
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
