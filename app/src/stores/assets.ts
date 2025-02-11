import { writable } from "svelte/store";

export type Asset = {
	id: string;
	title: string;
	status: "UPLOADING" | "PROCESSING" | "READY";
	thumbnail?: {
		url: string;
	};
	proxies?: Array<{
		type: string;
		status: string;
		isDefault: boolean;
		progress?: number;
	}>;
	metadata?: {
		format?: {
			duration: number;
		};
	};
	size: number;
};

export const assets = writable<Asset[]>([]);

export function updateAsset(updatedAsset: Asset) {
	assets.update((currentAssets) =>
		currentAssets.map((asset) =>
			asset.id === updatedAsset.id ? { ...asset, ...updatedAsset } : asset,
		),
	);
}
