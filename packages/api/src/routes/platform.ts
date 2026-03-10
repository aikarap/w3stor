import { getPlatformMetrics, listAllFiles } from "@w3stor/db";
import { Hono } from "hono";

export const platformRoute = new Hono();

/** GET /platform/stats */
platformRoute.get("/platform/stats", async (c) => {
	const metrics = await getPlatformMetrics();
	return c.json(metrics);
});

/** GET /platform/activity — recent files for activity feed */
platformRoute.get("/platform/activity", async (c) => {
	const { files } = await listAllFiles({ page: 1, limit: 10 });
	return c.json({ activity: files });
});

/** GET /platform/metrics */
platformRoute.get("/platform/metrics", async (c) => {
	const metrics = await getPlatformMetrics();
	return c.json(metrics);
});
