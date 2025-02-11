import { eq } from "drizzle-orm";
import { db } from "../db/db";
import { type AssetProxy, assets } from "../db/schema";
import { getPresignedUrl } from "../utilities/s3";

function getThumbnailFromProxies(proxies: AssetProxy[]): AssetProxy | null {
	if (!proxies) return null;
	const thumbnails = proxies.filter((proxy) => proxy.type === "THUMBNAIL");
	if (thumbnails.length === 0) return null;
	const selectedThumbnail = thumbnails.find((thumbnail) => thumbnail.isDefault);
	if (!selectedThumbnail) return thumbnails[0];
	return selectedThumbnail;
}

export async function getAsset(id: string): Promise<any | null> {
	const asset = await db.query.assets.findFirst({
		orderBy: (assets, { desc }) => [desc(assets.createdAt)],
		with: {
			proxies: {
				orderBy: (proxies, { desc }) => [desc(proxies.status)],
			},
		},
		where: eq(assets.id, id),
	});

	if (!asset) return null;
	return asset;
}

export async function getAssets() {
	const assetsList = await db.query.assets.findMany({
		orderBy: (assets, { desc }) => [desc(assets.createdAt)],
		with: {
			proxies: {
				orderBy: (proxies, { desc }) => [desc(proxies.status)],
			},
		},
		where: (assets, { eq }) =>
			eq(assets.ownerId, locals.user.id) && eq(assets.deleted, getDeleted),
	});

	const enrichedAssets = await Promise.all(
		assetsList.map(async (asset) => {
			const thumbnail = getThumbnailFromProxies(asset.proxies);
			const thumbnailUrl = thumbnail
				? await getPresignedUrl({
						bucket: thumbnail.storageBucket,
						key: thumbnail.storageKey,
					})
				: null;
			return {
				...asset,
				thumbnail: {
					url: thumbnailUrl,
					...thumbnail,
				},
			};
		}),
	);
}
