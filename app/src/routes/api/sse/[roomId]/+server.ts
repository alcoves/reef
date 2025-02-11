import { getNotifySubscriber } from "$lib/server/services/notify";
import { produce } from "sveltekit-sse";

export function POST({ locals }) {
	return produce(
		async function start({ emit }) {
			try {
				const userId = locals.user.id;
				const subscriber = await getNotifySubscriber();
				await subscriber.listenTo("assets");
				console.log('Successfully listening to "assets" channel');

				subscriber.notifications.on("assets", (payload) => {
					emit("assets", payload);
				});

				return function cleanup() {
					subscriber
						.close()
						.catch((error) =>
							console.error("Error closing connection:", error),
						);
				};
			} catch (error) {
				console.error("Error in SSE setup:", error);
				throw error;
			}
		},
		{
			async stop() {
				console.log("Stopping SSE connection");
				const subscriber = await getNotifySubscriber();
				await subscriber.unlisten("assets");
			},
			ping: 30000,
		},
	);
}
