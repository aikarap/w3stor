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
	const page = Math.max(1, Number(c.req.query("page") ?? "1"));
	const limit = Math.min(100, Math.max(1, Number(c.req.query("limit") ?? "50")));
	const { files, total, hasMore } = await listAllFiles({ page, limit });
	return c.json({ activity: files, total, page, limit, hasMore });
});

/** GET /platform/metrics */
platformRoute.get("/platform/metrics", async (c) => {
	const metrics = await getPlatformMetrics();
	return c.json(metrics);
});
