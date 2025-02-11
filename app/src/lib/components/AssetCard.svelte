<script lang="ts">
import { Check } from "lucide-svelte";
import type { Asset } from "../../stores/assets";

let props = $props<{
	asset: Asset;
	isSelected?: boolean;
	onSelect?: (id: string) => void;
	onPreview?: (asset: Asset) => void;
}>();

const hasReadyHLSProxy = $derived(
	props.asset?.proxies?.some(
		(proxy: any) =>
			proxy?.type === "HLS" && proxy?.status === "READY" && proxy.isDefault,
	),
);

const inProgressHLSProxy = $derived(
	props.asset?.proxies?.find(
		(proxy: any) => proxy?.type === "HLS" && proxy?.status === "PROCESSING",
	),
);

const thumbnailReadyProxy = $derived(
	props.asset?.proxies?.find(
		(proxy: any) =>
			proxy?.type === "THUMBNAIL" &&
			proxy?.status === "READY" &&
			proxy.isDefault,
	),
);

const thumbnailUrl = $derived(
	thumbnailReadyProxy
		? `http://localhost:5173/api/proxy/${thumbnailReadyProxy?.storageKey}`
		: null,
);

function formatDuration(seconds: number): string {
	const sec =
		typeof seconds === "string" ? Number.parseFloat(seconds) : seconds;
	const hours = Math.floor(sec / 3600);
	const minutes = Math.floor((sec % 3600) / 60);
	const remainingSeconds = Math.floor(sec % 60);

	if (hours > 0) {
		return `${hours}:${minutes.toString().padStart(2, "0")}:${remainingSeconds
			.toString()
			.padStart(2, "0")}`;
	}
	return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

function handleSelect(event: MouseEvent) {
	event.stopPropagation();
	props.onSelect?.(props.asset.id);
}

function handleClick() {
	if (hasReadyHLSProxy) {
		props.onPreview?.(props.asset);
	}
}

function handleKeydown(event: KeyboardEvent) {
	if (event.key === "Enter") {
		handleClick();
	}
}
</script>

<div
  class="card bg-base-200 w-full md:w-96 shadow-md {props.isSelected
    ? 'border border-primary'
    : 'border border-base-300'}"
>
  <figure class="relative h-40 w-full group">
    {#if props.asset?.status !== "READY"}
      {#if thumbnailUrl}
        <img
          src={thumbnailUrl}
          alt={props.asset?.title}
          class="absolute object-cover w-full h-full"
        />
      {:else}
        <div class="absolute object-cover w-full h-full bg-black"></div>
      {/if}
      <div
        class="flex flex-col w-full h-full justify-center items-center bg-black/50 z-10"
      >
        <span class="text-white">
          {props.asset?.status === "UPLOADING"
            ? "Uploading..."
            : "Processing..."}
        </span>
        <progress
          class="progress progress-info w-56 bg-neutral h-3 rounded-sm"
          value={inProgressHLSProxy?.progress || 0}
          max="100"
        ></progress>
      </div>
    {:else}
      {#if thumbnailUrl}
        <img
          alt={props.asset?.title}
          src={thumbnailUrl}
          class="absolute object-cover w-full h-full"
        />
        {#if props.asset?.metadata?.format?.duration}
          <div
            class="absolute bottom-1 right-1 bg-black/75 px-2 py-0.5 rounded font-semibold text-xs text-white z-20"
          >
            {formatDuration(props.asset.metadata.format.duration)}
          </div>
        {/if}
      {:else}
        <div class="absolute object-cover w-full h-full bg-black"></div>
      {/if}
      <div
        class="flex flex-col w-full h-full transition duration-200 z-10 {hasReadyHLSProxy
          ? 'group-hover:bg-black/50 cursor-pointer'
          : ''}"
        onclick={hasReadyHLSProxy ? handleClick : undefined}
        onkeydown={hasReadyHLSProxy ? handleKeydown : undefined}
        role="button"
        tabindex="0"
      >
        <div class="flex w-full justify-end p-2">
          <button
            type="button"
            class="cursor-pointer rounded-md p-1"
            class:selected={props.isSelected}
            onclick={handleSelect}
          >
            <Check strokeWidth="4" class="w-5 h-5" />
          </button>
        </div>
      </div>
    {/if}
  </figure>

  <div class="card-body p-4">
    <h2 class="card-title text-sm">{props.asset?.title}</h2>
    <div class="card-actions justify-end">
      <span class="text-xs opacity-70">
        {(props.asset?.size / 1024 / 1024).toFixed(1)} MB
      </span>
    </div>
  </div>
</div>
