import { initializeResourceServer, loadX402Networks } from "@w3stor/modules/x402";
import { config, logger } from "@w3stor/shared";
import { app } from "./hono";

// Initialize x402 resource server (non-fatal — runs without payments if not configured)
try {
	config.x402.networks = loadX402Networks();
	logger.info("x402 networks loaded", { count: config.x402.networks.length });
	await initializeResourceServer();
	logger.info("x402 resource server initialized");
} catch (e) {
	logger.warn("x402 resource server not initialized — payments disabled", {
		reason: e instanceof Error ? e.message : String(e),
	});
}

const port = parseInt(process.env.PORT ?? "4000", 10);

const server = Bun.serve({
	port,
	fetch: app.fetch,
	maxRequestBodySize: 1024 * 1024 * 1024, // 1 GiB
	idleTimeout: 255, // Max value (seconds) — keeps SSE connections alive
});

logger.info(`@w3stor/api listening on http://localhost:${server.port}`);

export { app };
