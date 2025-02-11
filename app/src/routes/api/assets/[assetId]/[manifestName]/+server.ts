import { db } from "$lib/server/db/db";
import { getObjectFromS3 } from "$lib/server/utilities/s3";
import { error } from "@sveltejs/kit";

export async function GET({ params, locals, request }) {
	const { user } = locals;
	const { assetId, manifestName } = params;

	const asset = await db.query.assets.findFirst({
		with: { proxies: true },
		where: (assets, { eq, and }) =>
			and(eq(assets.id, assetId), eq(assets.deleted, false)),
	});

	if (!asset) throw error(404, { message: "Asset not found" });
	if (asset.ownerId !== user.id) throw error(403, { message: "Forbidden" });

	const mainProxy = asset.proxies.find(
		(proxy) =>
			proxy.status === "READY" && proxy.type === "HLS" && proxy.isDefault,
	);

	if (!mainProxy) {
		throw error(404, { message: "Stream not found" });
	}

	let fetchParams = {
		bucket: mainProxy.storageBucket,
		key: mainProxy.storageKey,
	};

	if (manifestName !== "main.m3u8") {
		fetchParams = {
			bucket: mainProxy.storageBucket,
			key: mainProxy.storageKey.replace("main.m3u8", manifestName),
		};
	}

	try {
		const file = await getObjectFromS3(fetchParams);
		const body = await file.text();

		const manifestWithApiUrls = body
			? await Promise.all(
					body.split("\n").map(async (line) => {
						// Replaces the .m3u8 file with the API endpoint
						if (line.includes(".m3u8")) {
							const url = new URL(request.url);
							return url.origin + url.pathname.replace(manifestName, line);
						}

						// #EXT-X-MAP:URI="stream_video_init.mp4"
						if (line.includes("EXT-X-MAP:URI=")) {
							const initFile = line.split("URI=")[1].replace(/"/g, "");
							// const signedUrl = await getPresignedUrl({
							// 	bucket: mainProxy.storageBucket,
							// 	key: mainProxy.storageKey.replace("main.m3u8", initFile),
							// 	expiration: 3600,
							// });

							const proxyUrl = `http://localhost:5173/api/proxy/${mainProxy.storageKey.replace("main.m3u8", initFile)}`;
							return line.replace(initFile, proxyUrl);
						}

						// Replaces .m4s files with signed urls
						if (line.includes(".m4s") || line.includes(".mp4")) {
							// const signedUrl = await getPresignedUrl({
							// 	bucket: mainProxy.storageBucket,
							// 	key: mainProxy.storageKey.replace("main.m3u8", line),
							// 	expiration: 3600,
							// });

							const proxyUrl = `http://localhost:5173/api/proxy/${mainProxy.storageKey.replace("main.m3u8", line)}`;
							return proxyUrl;
						}

						return line;
					}),
				)
			: [];

		if (!manifestWithApiUrls) {
			throw error(500, { message: "Failed to parse manifest" });
		}

		return new Response(manifestWithApiUrls.join("\n"), {
			headers: {
				"Content-Type": "application/vnd.apple.mpegurl",
			},
		});
	} catch (err) {
		throw error(400, { message: "Bad manifest name" });
	}
}
