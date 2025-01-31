<script lang="ts">
  import { clientApi, queryClient } from "$lib/api";
  // import { createQuery } from "@tanstack/svelte-query";
  import { Check } from "lucide-svelte";
  import { onDestroy, onMount } from "svelte";
  import Preview from "./Preview.svelte";

  import wsStore, { WebSocketMessageType } from "$lib/stores/ws";

  onDestroy(() => {
    if (wsStore) {
      // I don't know if we should do this because other components might be using the same store?
      // wsStore.close();
    }
  });

  onMount(() => {
    // TODO :: Types for wsStore
    wsStore.subscribe((message) => {
      console.info("Asset component received websocket message:", message);
      // Do something with the message

      if (message?.type === WebSocketMessageType.PROXY_UPDATED) {
        console.info(`${message?.type}: hydrating asset proxy with ws message`);
        queryClient.setQueryData(["assets"], (data: any) => {
          return data.map((a: any) => {
            if (a.id === message.payload?.assetId) {
              return {
                ...a,
                // TODO :: This is quite brittle
                proxies: [
                  {
                    ...a.proxies[0],
                    ...message.payload,
                  },
                ],
              };
            }
            return a;
          });
        });
      } else if (message?.type === WebSocketMessageType.ASSET_UPDATED) {
        console.info(`${message?.type}: hydrating asset with ws message`);
        queryClient.setQueryData(["assets"], (data: any) => {
          return data.map((a: any) => {
            if (a.id === message.payload?.id) {
              return {
                ...a,
                ...message.payload,
              };
            }
            return a;
          });
        });
      }
    });
  });

  let selectedAsset = $state<any>(null);
  let selectedAssets = $state<string[]>([]);
  let lastSelectedIndex = $state<number>(-1);

  // const assets = createQuery({
  //   queryKey: ["assets"],
  //   queryFn: async () => {
  //     const response = await clientApi.get("/api/assets");
  //     return response.data.assets;
  //   },
  // });

  async function deleteSelectedAssets() {
    try {
      await clientApi.delete("/api/assets", {
        data: { ids: selectedAssets },
      });
      await queryClient.invalidateQueries({ queryKey: ["assets"] });
      selectedAssets = [];
    } catch (error) {
      console.error("Failed to delete assets:", error);
    }
  }

  function toggleSelect(assetId: string, index: number, event: MouseEvent) {
    event.stopPropagation();
    if (event.shiftKey && lastSelectedIndex >= 0) {
      const start = Math.min(lastSelectedIndex, index);
      const end = Math.max(lastSelectedIndex, index);
      const assetsInRange = $assets.data
        .slice(start, end + 1)
        .map((a: any) => a.id);

      const allSelected = assetsInRange.every((id: string) =>
        selectedAssets.includes(id),
      );
      if (allSelected) {
        selectedAssets = selectedAssets.filter(
          (id) => !assetsInRange.includes(id),
        );
      } else {
        selectedAssets = [...new Set([...selectedAssets, ...assetsInRange])];
      }
    } else {
      if (selectedAssets.includes(assetId)) {
        selectedAssets = selectedAssets.filter((id) => id !== assetId);
      } else {
        selectedAssets = [...selectedAssets, assetId];
      }
    }
    lastSelectedIndex = index;
  }

  function openPreview(asset: any) {
    selectedAsset = asset;
  }

  function selectAll() {
    selectedAssets = $assets.data.map((asset: any) => asset?.id);
  }

  function deselectAll() {
    selectedAssets = [];
  }

  function formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, "0")}:${remainingSeconds.toString().padStart(2, "0")}`;
    }
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  }
</script>

<div>
  {#if $assets.isSuccess && $assets.data.length > 0}
    <div class="flex items-center gap-2 mb-4">
      <button class="btn btn-sm" onclick={selectAll}>Select All</button>
      {#if selectedAssets.length > 0}
        <button class="btn btn-sm btn-ghost" onclick={deselectAll}
          >Deselect All</button
        >
        <span class="text-sm opacity-70">
          {selectedAssets.length} of {$assets.data.length} selected
        </span>
        <button class="btn btn-sm btn-error" onclick={deleteSelectedAssets}
          >Delete</button
        >
      {/if}
    </div>

    <div class="flex flex-wrap gap-2">
      {#each $assets.data as asset, index}
        <div
          class={`card bg-base-200 w-full md:w-96 shadow-md  ${selectedAssets.includes(asset?.id) ? "border border-primary" : "border border-base-300"}`}
        >
          <figure class="relative h-40 w-full group">
            {#if asset?.status !== "READY"}
              {#if asset?.thumbnails?.[0]?.url}
                <img
                  alt={asset?.title}
                  src={asset?.thumbnails?.[0]?.url}
                  class="absolute object-cover w-full h-full"
                />
              {:else}
                <div class="absolute object-cover w-full h-full bg-black"></div>
              {/if}
              <div
                class="flex flex-col w-full h-full justify-center items-center bg-black/50 z-10"
              >
                <span class="text-white"
                  >{asset?.status === "UPLOADING"
                    ? "Uploading..."
                    : "Processing..."}</span
                >
                <progress
                  class="progress progress-info w-56 bg-neutral h-3 rounded-sm"
                  value={asset?.proxies?.[0]?.progress}
                  max="100"
                ></progress>
              </div>
            {:else}
              {#if asset?.thumbnails?.[0]?.url}
                {#if asset?.duration}
                  <div
                    class="absolute bottom-1 right-1 bg-black/75 px-2 py-0.5 rounded font-semibold text-xs text-white z-20"
                  >
                    {formatDuration(parseFloat(asset.metadata.format.duration))}
                  </div>
                {/if}
                <img
                  alt={asset?.title}
                  src={asset?.thumbnails?.[0]?.url}
                  class="absolute object-cover w-full h-full"
                />
              {:else}
                <div class="absolute object-cover w-full h-full bg-black"></div>
              {/if}
              <div
                class="flex flex-col w-full h-full group-hover:bg-black/50 transition-background duration-200 z-10"
                role="button"
                tabindex="0"
                onclick={() => openPreview(asset)}
                onkeydown={(e) => e.key === "Enter" && openPreview(asset)}
              >
                <div class="flex w-full justify-end p-2">
                  <button
                    class={`rounded-md p-1 ${
                      selectedAssets.includes(asset?.id)
                        ? "bg-primary text-neutral"
                        : "bg-neutral text-neutral-content"
                    }`}
                    onclick={(e) => toggleSelect(asset?.id, index, e)}
                  >
                    <Check strokeWidth="4" class="w-5 h-5" />
                  </button>
                </div>
              </div>
            {/if}
          </figure>

          <div class="card-body p-4">
            <h2 class="card-title text-sm">{asset?.title}</h2>
            <div class="card-actions justify-end">
              <span class="text-xs opacity-70"
                >{(asset?.size / 1024 / 1024).toFixed(1)} MB</span
              >
            </div>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

{#if selectedAsset}
  <Preview asset={selectedAsset} onClose={() => (selectedAsset = null)} />
{/if}
