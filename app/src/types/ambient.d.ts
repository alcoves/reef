export interface AssetNotification {
	type: "ASSET_CREATED" | "ASSET_UPDATED" | "ASSET_DELETED";
	assets: Partial<Asset>[];
	time: number;
}
