import {
	createWorkflow,
	createWorkflowExecution,
	deleteWorkflow,
	getWorkflowById,
	listWorkflowExecutionFiles,
	listWorkflowExecutions,
	listWorkflows,
	updateWorkflow,
} from "@w3stor/db";
import { Hono } from "hono";
import { extractPayer } from "../middleware/x402";

export const workflowsRoute = new Hono();

/** GET /workflows?wallet=0x...&page=1&limit=20 */
workflowsRoute.get("/workflows", async (c) => {
	const raw = c.req.query("wallet");
	if (!raw) return c.json({ error: "wallet query parameter required" }, 400);
	const wallet = raw.toLowerCase();

	const page = Math.max(1, Number(c.req.query("page") ?? "1"));
	const limit = Math.min(100, Math.max(1, Number(c.req.query("limit") ?? "20")));

	return c.json(await listWorkflows({ walletAddress: wallet, page, limit }));
});

/** POST /workflows { wallet, name, description?, nodes?, edges?, config? } */
workflowsRoute.post("/workflows", async (c) => {
	const body = await c.req.json();
	const { name, description, nodes, edges } = body;
	if (!body.wallet || !name) return c.json({ error: "wallet and name required" }, 400);
	const wallet = body.wallet.toLowerCase();

	return c.json(
		await createWorkflow({
			walletAddress: wallet,
			name,
			description,
			nodes: nodes ?? [],
			edges: edges ?? [],
		}),
	);
});

/** PUT /workflows/:id { wallet, name?, description?, nodes?, edges?, visibility? } */
workflowsRoute.put("/workflows/:id", async (c) => {
	const id = c.req.param("id");
	const body = await c.req.json();
	if (!body.wallet) return c.json({ error: "wallet required" }, 400);
	const wallet = body.wallet.toLowerCase();
	const { wallet: _, ...updates } = body;

	const existing = await getWorkflowById(id);
	if (!existing || existing.walletAddress !== wallet) {
		return c.json({ error: "Workflow not found" }, 404);
	}

	return c.json(await updateWorkflow(id, updates));
});

/** DELETE /workflows/:id?wallet=0x... */
workflowsRoute.delete("/workflows/:id", async (c) => {
	const id = c.req.param("id");
	const raw = c.req.query("wallet");
	if (!raw) return c.json({ error: "wallet query parameter required" }, 400);
	const wallet = raw.toLowerCase();

	const existing = await getWorkflowById(id);
	if (!existing || existing.walletAddress !== wallet) {
		return c.json({ error: "Workflow not found" }, 404);
	}

	await deleteWorkflow(id);
	return c.json({ success: true });
});

/**
 * POST /workflows/execute
 *
 * x402 payment gate for workflow execution.
 * The actual execution is handled by the Next.js SSE endpoint —
 * this route only validates payment and returns authorization.
 */
workflowsRoute.post("/workflows/execute", async (c) => {
	const walletAddress = c.get("walletAddress" as never) as string | undefined;

	if (!walletAddress) {
		return c.json({ error: "Payment required" }, 402);
	}

	return c.json({ authorized: true, wallet: walletAddress });
});

/** POST /workflows/:id/execute { wallet, input?, estimatedCost? } */
workflowsRoute.post("/workflows/:id/execute", async (c) => {
	const id = c.req.param("id");
	const walletAddress =
		(c.get("walletAddress" as never) as string | undefined) ??
		extractPayer(c.req);

	if (!walletAddress) {
		return c.json({ error: "Payment required" }, 402);
	}

	const workflow = await getWorkflowById(id);
	if (!workflow || workflow.walletAddress !== walletAddress) {
		return c.json({ error: "Workflow not found" }, 404);
	}

	const body = await c.req.json().catch(() => ({}));
	return c.json(
		await createWorkflowExecution({
			workflowId: id,
			input: body.input,
			estimatedCostUsdfc: body.estimatedCost?.toString(),
		}),
	);
});

/** GET /workflows/:id/executions?wallet=0x...&page=1&limit=20 */
workflowsRoute.get("/workflows/:id/executions", async (c) => {
	const workflowId = c.req.param("id");
	const wallet = c.req.query("wallet");
	if (!wallet) return c.json({ error: "wallet query parameter required" }, 400);

	const workflow = await getWorkflowById(workflowId);
	if (!workflow || workflow.walletAddress !== wallet) {
		return c.json({ error: "Workflow not found" }, 404);
	}

	const page = Math.max(1, Number(c.req.query("page") ?? "1"));
	const limit = Math.min(100, Math.max(1, Number(c.req.query("limit") ?? "20")));

	return c.json(await listWorkflowExecutions({ workflowId, page, limit }));
});

/** GET /workflows/executions/:executionId/files?wallet=0x... */
workflowsRoute.get("/workflows/executions/:executionId/files", async (c) => {
	const executionId = c.req.param("executionId");
	return c.json({ files: await listWorkflowExecutionFiles(executionId) });
});
