import { Hono } from "hono";

export const metricsRoute = new Hono();

const startTime = Date.now();

metricsRoute.get("/metrics", async (c) => {
	return c.json({
		timestamp: new Date().toISOString(),
		uptime: Math.floor((Date.now() - startTime) / 1000),
	});
});
