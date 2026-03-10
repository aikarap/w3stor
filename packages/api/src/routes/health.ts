import { healthCheck as dbHealth } from "@w3stor/db";
import { Hono } from "hono";

export const healthRoute = new Hono();

healthRoute.get("/health", async (c) => {
	try {
		const db = await dbHealth();
		const healthy = db;
		return c.json(
			{
				status: healthy ? "healthy" : "unhealthy",
				timestamp: new Date().toISOString(),
				services: { database: db },
			},
			healthy ? 200 : 503,
		);
	} catch {
		return c.json(
			{
				status: "unhealthy",
				timestamp: new Date().toISOString(),
				services: { database: false },
			},
			503,
		);
	}
});

healthRoute.get("/ready", (c) => {
	return c.json({ ready: true });
});
