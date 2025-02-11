<script lang="ts">
import { invalidateAll } from "$app/navigation";
import { source } from "sveltekit-sse";
import { type Asset, assets } from "../../stores/assets";
import { type AssetNotification } from "../../types/ambient";
import AssetCard from "./AssetCard.svelte";
import Preview from "./Preview.svelte";

let { initialAssets, onDeleteAssets } = $props<{
	initialAssets?: Asset[];
	onDeleteAssets?: (assetIds: string[]) => void;
}>();

let selectedAssets = $state<string[]>([]);
let selectedAsset = $state<Asset | null>(null);

$effect(() => {
	if (initialAssets) {
		assets.set(initialAssets);
	}
});

const connection = source(`/api/sse/f4907488-2f77-402e-b4f5-92398ac5b698`, {
	close({ connect }) {
		console.log("SSE connection failed, reconnecting...");
		connect();
	},
});

$effect(() => {
	const unsubscribe = connection.select("assets").subscribe((message) => {
		try {
			const parsedMessage: AssetNotification = JSON.parse(message);
			console.log(`Received message: ${parsedMessage.type}`);

			if (parsedMessage.assets.length === 0) {
				return;
			} else if (parsedMessage.type === "ASSET_CREATED") {
				assets.update((currentAssets: Asset[]) => {
					const newAssets = parsedMessage.assets.filter(
						(newAsset: Asset) =>
							!currentAssets.some((asset) => asset.id === newAsset.id),
					);
					return [...newAssets, ...currentAssets];
				});
			} else if (parsedMessage.type === "ASSET_UPDATED") {
				assets.update((currentAssets: Asset[]) =>
					currentAssets.map((asset: Asset) => {
						const found = parsedMessage.assets.find((a) => a.id === asset.id);
						return found ? { ...asset, ...found } : asset;
					}),
				);
			} else if (parsedMessage.type === "ASSET_DELETED") {
				assets.update((currentAssets: Asset[]) =>
					currentAssets.filter(
						(asset: Asset) => !parsedMessage.assets.includes(asset.id),
					),
				);
			}
		} catch (error) {
			// Ignore json parse error
			// invalidateAll();
		}
	});

	return () => {
		unsubscribe();
		connection.close();
	};
});

function selectAll() {
	$assets.forEach((asset) => {
		if (!selectedAssets.includes(asset.id)) {
			selectedAssets = [...selectedAssets, asset.id];
		}
	});
}

function deselectAll() {
	selectedAssets = [];
}

function handleSelect(id: string) {
	if (selectedAssets.includes(id)) {
		selectedAssets = selectedAssets.filter((assetId) => assetId !== id);
	} else {
		selectedAssets = [...selectedAssets, id];
	}
}

function handlePreview(asset: Asset) {
	selectedAsset = asset;
}

function closePreview() {
	selectedAsset = null;
}

async function handleDelete(event: SubmitEvent) {
	event.preventDefault();
	const form = event.currentTarget as HTMLFormElement;
	const formData = new FormData(form);
	const response = await fetch(form.action, {
		method: form.method,
		body: formData,
	});
	if (response.ok) {
		invalidateAll();
		assets.update((currentAssets) =>
			currentAssets.filter((asset) => !selectedAssets.includes(asset.id)),
		);
		selectedAssets = [];
	} else {
		console.error("Failed to delete assets");
	}
}
</script>

<div>
  {#if $assets.length > 0}
    <div class="flex items-center gap-2 mb-4">
      <button class="btn btn-sm" onclick={selectAll}>Select All</button>
      {#if selectedAssets.length > 0}
        <button class="btn btn-sm btn-ghost" onclick={deselectAll}>
          Deselect All
        </button>
        <span class="text-sm opacity-70">
          {selectedAssets.length} of {$assets.length} selected
        </span>
        <!-- Delete form that submits to the deleteAssets action -->
        <form method="post" action="?/deleteAssets" onsubmit={handleDelete}>
          <!-- Pass the selected asset ids as a comma‐separated string -->
          <input
            type="hidden"
            name="assetIds"
            value={selectedAssets.join(",")}
          />
          <button type="submit" class="btn btn-sm btn-error">Delete</button>
        </form>
      {/if}
    </div>

    <div class="flex flex-wrap gap-2">
      {#each $assets as asset (asset.id)}
        <AssetCard
          {asset}
          isSelected={selectedAssets.includes(asset.id)}
          onSelect={handleSelect}
          onPreview={handlePreview}
        />
      {/each}
    </div>
  {:else}
    <p>No assets found.</p>
  {/if}
</div>

{#if selectedAsset}
  <Preview asset={selectedAsset} onClose={closePreview} />
{/if}
