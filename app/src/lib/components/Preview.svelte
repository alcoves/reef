<script lang="ts">
  import { apiEndpoint } from "$lib/api";
  import { isHLSProvider } from "vidstack";
  import "vidstack/bundle";

  const modalId = "preview-player";
  export let asset: any;
  export let onClose: () => void;
  let modalOpen = true;

  $: if (!modalOpen) {
    onClose();
  }
</script>

<input
  id={modalId}
  type="checkbox"
  class="modal-toggle"
  bind:checked={modalOpen}
/>
<div class="modal" role="dialog">
  <div
    class="modal-box bg-transparent p-2 flex flex-col items-center justify-center gap-2 max-w-7xl"
  >
    <div class="flex w-full justify-between">
      <h3 class="text-lg font-bold text-white self-start">
        {asset?.title}
      </h3>
      <button
        on:click={onClose}
        class="btn btn-sm text-white bg-primary hover:bg-success"
      >
        Close
      </button>
    </div>
    <media-player
      on:provider-change={({ detail }) => {
        if (isHLSProvider(detail)) {
          detail.config = {
            xhrSetup(xhr) {
              xhr.withCredentials = true;
            },
          };
        }
      }}
      autoPlay
      playsInline
      volume={0.5}
      title={asset?.title}
      crossorigin="use-credentials"
      src={`${apiEndpoint}/api/assets/${asset?.id}/manifest/main.m3u8`}
    >
      <media-provider></media-provider>
      <media-video-layout></media-video-layout>
    </media-player>
  </div>
  <label class="modal-backdrop bg-black/70" for={modalId}>Close</label>
</div>
