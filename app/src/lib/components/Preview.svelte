<script lang="ts">
import type { Asset } from "$lib/server/db/schema";
import "vidstack/bundle";

// import { isHLSProvider } from "vidstack";

const { asset, onClose } = $props<{
	asset: Asset;
	onClose: () => void;
}>();

let dialog = $state<HTMLDialogElement | null>(null);

$effect(() => {
	if (dialog) {
		dialog.showModal();
		const handleClose = () => onClose();
		dialog.addEventListener("close", handleClose);
		return () => {
			dialog?.removeEventListener("close", handleClose);
		};
	}
});

function handleBackdropClick(event: MouseEvent | KeyboardEvent) {
	if (event.target === dialog) {
		dialog?.close();
	}
}
</script>

<dialog bind:this={dialog} class="modal">
  <div
    class="backdrop"
    role="button"
    tabindex="0"
    onclick={handleBackdropClick}
    onkeydown={(event) => {
      if (event.key === "Enter" || event.key === " ")
        handleBackdropClick(event);
    }}
  ></div>
  <div
    class="modal-box bg-transparent p-2 flex flex-col items-center justify-center gap-2 max-w-7xl"
  >
    <div class="flex w-full justify-between">
      <h3 class="text-lg font-bold text-white self-start">
        {asset?.title}
      </h3>
      <button
        onclick={() => dialog?.close()}
        class="btn btn-sm text-white bg-primary hover:bg-success"
      >
        Close
      </button>
    </div>

    <!-- 
    <media-player
      onprovider-change={({ detail }) => {
        if (isHLSProvider(detail)) {
          detail.config = {
            xhrSetup(xhr) {
              xhr.withCredentials = true;
            },
          };
        }
      }} -->

    <media-player
      autoPlay
      playsInline
      volume={0.5}
      title={asset?.title}
      crossorigin="use-credentials"
      src={`/api/assets/${asset?.id}/main.m3u8`}
    >
      <media-provider></media-provider>
      <media-video-layout></media-video-layout>
    </media-player>
  </div>
</dialog>

<style>
  dialog {
    /* Reset default dialog styles */
    padding: 0;
    border: none;
    background: transparent;
  }

  dialog::backdrop {
    background: rgba(0, 0, 0, 0.7);
  }
</style>
