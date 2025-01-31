import { db } from "../db/db";
import { getPresignedUrl } from "../lib/s3";

export async function getAsset(id: string): Promise<any | null> {
	const asset = await db.query.assets.findFirst({
		orderBy: (assets, { desc }) => [desc(assets.createdAt)],
		with: {
			thumbnails: {
				orderBy: (thumbnails, { desc }) => [desc(thumbnails.size)],
			},
			proxies: {
				orderBy: (proxies, { desc }) => [desc(proxies.status)],
			},
		},
	});

	if (!asset) return null;
	const updatedAsset = await assetsWithUrls([asset]);
	return updatedAsset[0];
}

export function assetsWithUrls(a: any[]): Promise<any[]> {
	return Promise.all(
		a.map(async (asset) => {
			if (asset?.thumbnails?.length) {
				const imageProxiesWithUrls = await Promise.all(
					asset?.thumbnails.map(async (proxy: any) => {
						if (proxy?.storageBucket && proxy?.storageKey) {
							const signedProxyUrl = await getPresignedUrl({
								bucket: proxy.storageBucket,
								key: proxy.storageKey,
								expiration: 3600,
							});

							return {
								...proxy,
								url: signedProxyUrl,
							};
						}

						return proxy;
					}),
				);

				return {
					...asset,
					thumbnails: imageProxiesWithUrls,
				};
			}
			return asset;
		}),
	);
}
