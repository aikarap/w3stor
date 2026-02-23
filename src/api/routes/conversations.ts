import { createConversation, findOrCreateUser, listConversationsByWallet } from "@w3stor/db";
import { Hono } from "hono";

export const conversationsRoute = new Hono();

/** GET /conversations?wallet=0x...&page=1&limit=20 */
conversationsRoute.get("/conversations", async (c) => {
	const raw = c.req.query("wallet");
	if (!raw) return c.json({ error: "wallet query parameter required" }, 400);
	const wallet = raw.toLowerCase();

	const page = Math.max(1, Number(c.req.query("page") ?? "1"));
	const limit = Math.min(100, Math.max(1, Number(c.req.query("limit") ?? "20")));
	const offset = (page - 1) * limit;

	const result = await listConversationsByWallet(wallet, { limit, offset });
	return c.json(result);
});

/** POST /conversations { wallet: "0x..." } */
conversationsRoute.post("/conversations", async (c) => {
	const body = await c.req.json();
	if (!body.wallet) return c.json({ error: "wallet required" }, 400);
	const wallet = body.wallet.toLowerCase();

	await findOrCreateUser(wallet);
	const contextId = `ws:${wallet}:${crypto.randomUUID()}`;
	const conversation = await createConversation({
		contextId,
		sessionType: "http",
		walletAddress: wallet,
	});

	return c.json({ contextId, conversationId: conversation.id });
});
