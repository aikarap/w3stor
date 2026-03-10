import { findFileByCID, getSPStatuses, listUserFiles } from "@w3stor/db";
import { Hono } from "hono";

export const filesRoute = new Hono();

/** GET /files?wallet=0x...&page=1&limit=20&status=...&tags=...&search=... */
filesRoute.get("/files", async (c) => {
	const raw = c.req.query("wallet");
	if (!raw) return c.json({ error: "wallet query parameter required" }, 400);
	const wallet = raw.toLowerCase();

	const page = Math.max(1, Number(c.req.query("page") ?? "1"));
	const limit = Math.min(100, Math.max(1, Number(c.req.query("limit") ?? "20")));
	const offset = (page - 1) * limit;
	const status = c.req.query("status") as string | undefined;
	const tags = c.req.query("tags");
	const search = c.req.query("search");

	const result = await listUserFiles({
		walletAddress: wallet,
		limit,
		offset,
		tags: tags ? tags.split(",") : undefined,
		status,
		search,
	});

	return c.json({ ...result, page, limit, hasMore: result.total > page * limit });
});

/** GET /status/:cid */
filesRoute.get("/status/:cid", async (c) => {
	const cid = c.req.param("cid");
	const file = await findFileByCID(cid);
	if (!file) return c.json({ error: "File not found" }, 404);

	const spStatuses = await getSPStatuses(cid);
	return c.json({
		cid: file.cid,
		status: file.status,
		sizeBytes: file.sizeBytes,
		contentType: file.contentType,
		pinataPinned: file.pinataPinned,
		createdAt: file.createdAt,
		providers: spStatuses.map((sp: any) => ({
			spId: sp.spId,
			status: sp.status,
			url: sp.url,
			verifiedAt: sp.verifiedAt,
		})),
		verifiedSPs: spStatuses.filter(
			(sp: any) => sp.status === "verified" || sp.status === "stored",
		).length,
	});
});
