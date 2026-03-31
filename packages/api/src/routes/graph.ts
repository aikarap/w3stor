import {
  addFile,
  removeFile,
  connectFiles,
  disconnectFiles,
  connectAgent,
  semanticSearch,
  traverse,
  getGraph,
  initializeIndexes,
} from "@w3stor/graph";
import { logger } from "@w3stor/shared";
import { Hono } from "hono";

export const graphRoute = new Hono();

// Initialize Neo4j indexes on import
initializeIndexes().catch((err) => {
  logger.warn("Neo4j index initialization failed — graph features may be unavailable", {
    error: err instanceof Error ? err.message : String(err),
  });
});

// --- Write operations (wallet from x402 payment header) ---

graphRoute.post("/graph/files", async (c) => {
  try {
    const walletAddress = c.get("walletAddress" as never) as string | undefined;
    if (!walletAddress) return c.json({ error: "Payment required" }, 402);

    const body = await c.req.json();
    const result = await addFile({ ...body, walletAddress });
    return c.json({ success: true, node: result });
  } catch (error) {
    logger.error("Graph add file failed", { error: error instanceof Error ? error.message : String(error) });
    return c.json({ error: error instanceof Error ? error.message : "Graph operation failed" }, 500);
  }
});

graphRoute.delete("/graph/files/:cid", async (c) => {
  try {
    const walletAddress = c.get("walletAddress" as never) as string | undefined;
    if (!walletAddress) return c.json({ error: "Payment required" }, 402);

    const cid = c.req.param("cid");
    const result = await removeFile({ walletAddress, cid });
    return c.json(result);
  } catch (error) {
    logger.error("Graph remove file failed", { error: error instanceof Error ? error.message : String(error) });
    return c.json({ error: error instanceof Error ? error.message : "Graph operation failed" }, 500);
  }
});

graphRoute.post("/graph/connections", async (c) => {
  try {
    const walletAddress = c.get("walletAddress" as never) as string | undefined;
    if (!walletAddress) return c.json({ error: "Payment required" }, 402);

    const body = await c.req.json();
    const result = await connectFiles({ ...body, walletAddress });
    return c.json(result);
  } catch (error) {
    logger.error("Graph connect files failed", { error: error instanceof Error ? error.message : String(error) });
    return c.json({ error: error instanceof Error ? error.message : "Graph operation failed" }, 500);
  }
});

graphRoute.delete("/graph/connections", async (c) => {
  try {
    const walletAddress = c.get("walletAddress" as never) as string | undefined;
    if (!walletAddress) return c.json({ error: "Payment required" }, 402);

    const body = await c.req.json();
    const result = await disconnectFiles({ ...body, walletAddress });
    return c.json(result);
  } catch (error) {
    logger.error("Graph disconnect files failed", { error: error instanceof Error ? error.message : String(error) });
    return c.json({ error: error instanceof Error ? error.message : "Graph operation failed" }, 500);
  }
});

graphRoute.post("/graph/agents", async (c) => {
  try {
    const walletAddress = c.get("walletAddress" as never) as string | undefined;
    if (!walletAddress) return c.json({ error: "Payment required" }, 402);

    const body = await c.req.json();
    const result = await connectAgent({ ...body, walletAddress });
    return c.json(result);
  } catch (error) {
    logger.error("Graph connect agent failed", { error: error instanceof Error ? error.message : String(error) });
    return c.json({ error: error instanceof Error ? error.message : "Graph operation failed" }, 500);
  }
});

// --- Read operations (wallet from query param, no payment) ---

graphRoute.get("/graph/search", async (c) => {
  try {
    const walletAddress = c.req.query("wallet");
    if (!walletAddress) return c.json({ error: "Missing wallet query param" }, 400);

    const query = c.req.query("q");
    if (!query) return c.json({ error: "Missing q query param" }, 400);

    const limit = parseInt(c.req.query("limit") || "10", 10);
    const threshold = parseFloat(c.req.query("threshold") || "0.5");

    const results = await semanticSearch({ walletAddress, query, limit, threshold });
    return c.json({ results });
  } catch (error) {
    logger.error("Graph search failed", { error: error instanceof Error ? error.message : String(error) });
    return c.json({ error: error instanceof Error ? error.message : "Graph operation failed" }, 500);
  }
});

graphRoute.get("/graph/traverse/:cid", async (c) => {
  try {
    const walletAddress = c.req.query("wallet");
    if (!walletAddress) return c.json({ error: "Missing wallet query param" }, 400);

    const cid = c.req.param("cid");
    const depth = parseInt(c.req.query("depth") || "2", 10);
    const relationship = c.req.query("relationship") || undefined;

    const result = await traverse({ walletAddress, cid, depth, relationship });
    return c.json(result);
  } catch (error) {
    logger.error("Graph traverse failed", { error: error instanceof Error ? error.message : String(error) });
    return c.json({ error: error instanceof Error ? error.message : "Graph operation failed" }, 500);
  }
});

graphRoute.get("/graph/view", async (c) => {
  try {
    const walletAddress = c.req.query("wallet");
    if (!walletAddress) return c.json({ error: "Missing wallet query param" }, 400);

    const limit = parseInt(c.req.query("limit") || "500", 10);

    const result = await getGraph({ walletAddress, limit: Math.min(limit, 500) });
    return c.json(result);
  } catch (error) {
    logger.error("Graph view failed", { error: error instanceof Error ? error.message : String(error) });
    return c.json({ error: error instanceof Error ? error.message : "Graph operation failed" }, 500);
  }
});
