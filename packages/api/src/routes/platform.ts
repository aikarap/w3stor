import { getPlatformMetrics, listAllFiles } from "@w3stor/db";
import { getTotalGraphNodes } from "@w3stor/graph";
import { logger } from "@w3stor/shared";
import { Hono } from "hono";

export const platformRoute = new Hono();

/** GET /platform/stats */
platformRoute.get("/platform/stats", async (c) => {
	const metrics = await getPlatformMetrics();
	return c.json(metrics);
});

/** GET /platform/activity — recent files for activity feed */
platformRoute.get("/platform/activity", async (c) => {
	const page = Math.max(1, Number(c.req.query("page") ?? "1"));
	const limit = Math.min(100, Math.max(1, Number(c.req.query("limit") ?? "50")));
	const { files, total, hasMore } = await listAllFiles({ page, limit });
	return c.json({ activity: files, total, page, limit, hasMore });
});

/** GET /platform/metrics */
platformRoute.get("/platform/metrics", async (c) => {
	const [metrics, graphNodes] = await Promise.all([
		getPlatformMetrics(),
		getTotalGraphNodes().catch((err) => {
			logger.warn("Failed to get graph node count", {
				error: err instanceof Error ? err.message : String(err),
			});
			return 0;
		}),
	]);
	return c.json({ ...metrics, graphNodes });
});
