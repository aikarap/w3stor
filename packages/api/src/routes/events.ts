import { getWorkerRedisConnection } from "@w3stor/modules/queue";
import { logger } from "@w3stor/shared";
import { Hono } from "hono";

export const eventsRoute = new Hono();

/** Send an SSE-formatted comment as keepalive (invisible to EventSource API) */
function sendKeepalive(controller: ReadableStreamDefaultController, encoder: TextEncoder) {
	try {
		controller.enqueue(encoder.encode(": keepalive\n\n"));
	} catch {
		// Controller already closed
	}
}

/**
 * GET /events/files/:cid — SSE stream for a specific file's status updates.
 */
eventsRoute.get("/events/files/:cid", async (c) => {
	const cid = c.req.param("cid");

	const stream = new ReadableStream({
		start(controller) {
			const encoder = new TextEncoder();

			function send(event: string, data: unknown) {
				controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
			}

			send("connected", { cid });

			// Send keepalive every 15s to prevent Bun idle timeout
			const keepaliveInterval = setInterval(() => sendKeepalive(controller, encoder), 15_000);

			let subscriber: ReturnType<typeof getWorkerRedisConnection> | null = null;

			function cleanup() {
				clearInterval(keepaliveInterval);
				subscriber?.unsubscribe();
				subscriber?.quit();
			}

			try {
				subscriber = getWorkerRedisConnection().duplicate();

				subscriber.subscribe(`file:${cid}:status`, (err) => {
					if (err) {
						logger.error("SSE: Failed to subscribe", { cid, error: err.message });
						cleanup();
						controller.close();
						return;
					}
					logger.info("SSE: Subscribed to file status", { cid });
				});

				subscriber.on("message", (_channel: string, message: string) => {
					try {
						const data = JSON.parse(message);
						send("file-status", data);

						if (data.status === "fully_replicated" || data.status === "failed") {
							send("done", { status: data.status });
							cleanup();
							controller.close();
						}
					} catch (error) {
						logger.error("SSE: Failed to parse message", { cid, error });
					}
				});
			} catch (error) {
				logger.error("SSE: Redis connection failed", { cid, error });
				cleanup();
				controller.close();
			}

			c.req.raw.signal.addEventListener("abort", () => {
				cleanup();
				logger.info("SSE: Client disconnected", { cid });
			});
		},
	});

	return new Response(stream, {
		headers: {
			"Content-Type": "text/event-stream",
			"Cache-Control": "no-cache",
			Connection: "keep-alive",
			"Access-Control-Allow-Origin": process.env.CORS_ORIGIN ?? "*",
		},
	});
});

/**
 * GET /events/platform — SSE stream for platform-wide file events.
 */
eventsRoute.get("/events/platform", async (c) => {
	const stream = new ReadableStream({
		start(controller) {
			const encoder = new TextEncoder();

			function send(event: string, data: unknown) {
				controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
			}

			send("connected", { ts: Date.now() });

			const keepaliveInterval = setInterval(() => sendKeepalive(controller, encoder), 15_000);

			let subscriber: ReturnType<typeof getWorkerRedisConnection> | null = null;

			function cleanup() {
				clearInterval(keepaliveInterval);
				subscriber?.punsubscribe();
				subscriber?.quit();
			}

			try {
				subscriber = getWorkerRedisConnection().duplicate();

				subscriber.psubscribe("file:*:status", (err) => {
					if (err) {
						logger.error("SSE: Platform subscribe failed", { error: err.message });
						cleanup();
						controller.close();
						return;
					}
				});

				subscriber.on("pmessage", (_pattern: string, _channel: string, message: string) => {
					try {
						const data = JSON.parse(message);
						send("file-status", data);
					} catch (error) {
						logger.error("SSE: Platform parse failed", { error });
					}
				});
			} catch (error) {
				logger.error("SSE: Platform Redis connection failed", { error });
				cleanup();
				controller.close();
			}

			c.req.raw.signal.addEventListener("abort", () => {
				cleanup();
			});
		},
	});

	return new Response(stream, {
		headers: {
			"Content-Type": "text/event-stream",
			"Cache-Control": "no-cache",
			Connection: "keep-alive",
			"Access-Control-Allow-Origin": process.env.CORS_ORIGIN ?? "*",
		},
	});
});
