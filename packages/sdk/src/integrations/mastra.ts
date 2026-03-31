/**
 * @w3stor/sdk/mastra — Mastra framework integration
 *
 * Mastra-compatible tools for agents and workflows.
 * Pass a `privateKey` or `account` and the SDK handles x402 payments.
 *
 * @example
 * ```ts
 * import { createTools } from "@w3stor/sdk/mastra";
 *
 * const { uploadTool, listTool, statusTool, attestTool, graphSearchTool, graphAddFileTool } = await createTools({
 *   privateKey: process.env.PRIVATE_KEY,
 * });
 * ```
 */

import { z } from "zod";
import { type W3StorConfig, createFetch, getApiUrl } from "./client";

export interface MastraTool<TInput extends z.ZodType = z.ZodType, TOutput extends z.ZodType = z.ZodType> {
	id: string;
	description: string;
	inputSchema: TInput;
	outputSchema: TOutput;
	execute: (params: { context: z.infer<TInput> }) => Promise<z.infer<TOutput>>;
}

async function assertOk(res: Response, label: string): Promise<void> {
	if (!res.ok) {
		const body = await res.text().catch(() => "");
		throw new Error(`w3stor ${label} failed (${res.status}): ${body}`);
	}
}

export async function createTools(config?: W3StorConfig) {
	const apiUrl = getApiUrl(config);
	const f = await createFetch(config);

	const uploadTool: MastraTool = {
		id: "w3s-upload",
		description: "Upload a file to IPFS and replicate across Filecoin SPs",
		inputSchema: z.object({
			filePath: z.string().describe("Path to the file to upload"),
			tags: z.string().optional().describe("Comma-separated tags"),
			replicationTarget: z.number().default(3).describe("Number of SP replicas"),
		}),
		outputSchema: z.object({
			cid: z.string(),
			size: z.number(),
			pinataUrl: z.string(),
			status: z.string(),
		}),
		execute: async ({ context }) => {
			const formData = new FormData();
			const file = await f(context.filePath).then((r: Response) => r.blob());
			formData.append("file", file);
			if (context.tags) formData.append("tags", context.tags);
			formData.append("replicationTarget", String(context.replicationTarget));

			const res = await f(`${apiUrl}/upload`, { method: "POST", body: formData });
			await assertOk(res, "upload");
			return res.json();
		},
	};

	const listTool: MastraTool = {
		id: "w3s-list",
		description: "List files stored in decentralized storage",
		inputSchema: z.object({
			status: z.enum(["pinned", "storing", "stored"]).optional(),
			limit: z.number().default(50),
		}),
		outputSchema: z.object({
			files: z.array(z.object({ cid: z.string(), size: z.number(), status: z.string() })),
			total: z.number(),
		}),
		execute: async ({ context }) => {
			const params = new URLSearchParams();
			if (context.status) params.set("status", context.status);
			params.set("limit", String(context.limit));

			const res = await f(`${apiUrl}/files?${params}`);
			await assertOk(res, "list files");
			return res.json();
		},
	};

	const statusTool: MastraTool = {
		id: "w3s-status",
		description: "Check replication status for a CID",
		inputSchema: z.object({
			cid: z.string().describe("Content identifier to check"),
		}),
		outputSchema: z.object({
			cid: z.string(),
			status: z.string(),
			replicationCount: z.number(),
			providers: z.array(z.string()),
		}),
		execute: async ({ context }) => {
			const res = await f(`${apiUrl}/status/${context.cid}`);
			await assertOk(res, "check status");
			return res.json();
		},
	};

	const attestTool: MastraTool = {
		id: "w3s-attest",
		description: "Create an on-chain attestation for a stored file",
		inputSchema: z.object({
			cid: z.string().describe("CID to attest"),
		}),
		outputSchema: z.object({
			attestationId: z.string(),
			txHash: z.string(),
			timestamp: z.number(),
		}),
		execute: async ({ context }) => {
			const res = await f(`${apiUrl}/attest/${context.cid}`, { method: "POST" });
			await assertOk(res, "attest");
			return res.json();
		},
	};

	const graphAddFileTool: MastraTool = {
		id: "w3s-graph-add-file",
		description: "Add a file to your knowledge graph for semantic search and connections",
		inputSchema: z.object({
			cid: z.string().describe("CID of the file to add"),
			description: z.string().optional().describe("Description of the file"),
			tags: z.string().optional().describe("Comma-separated tags"),
		}),
		outputSchema: z.object({
			id: z.string(),
			cid: z.string(),
			description: z.string().optional(),
			tags: z.array(z.string()).optional(),
		}),
		execute: async ({ context }) => {
			const res = await f(`${apiUrl}/graph/files`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					cid: context.cid,
					description: context.description,
					tags: context.tags?.split(",").map((t: string) => t.trim()),
				}),
			});
			await assertOk(res, "graph add file");
			return res.json();
		},
	};

	const graphConnectFilesTool: MastraTool = {
		id: "w3s-graph-connect-files",
		description: "Create a relationship between two files in your knowledge graph",
		inputSchema: z.object({
			fromCid: z.string().describe("Source file CID"),
			toCid: z.string().describe("Target file CID"),
			relationship: z.string().describe("Relationship label (e.g., references, derived_from)"),
		}),
		outputSchema: z.object({
			fromCid: z.string(),
			toCid: z.string(),
			relationship: z.string(),
		}),
		execute: async ({ context }) => {
			const res = await f(`${apiUrl}/graph/connections`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					fromCid: context.fromCid,
					toCid: context.toCid,
					relationship: context.relationship,
				}),
			});
			await assertOk(res, "graph connect files");
			return res.json();
		},
	};

	const graphSearchTool: MastraTool = {
		id: "w3s-graph-search",
		description: "Semantic search across your stored files using natural language",
		inputSchema: z.object({
			query: z.string().describe("Natural language search query"),
			limit: z.number().default(10).describe("Max results"),
			threshold: z.number().default(0.5).describe("Minimum similarity score (0-1)"),
		}),
		outputSchema: z.object({
			results: z.array(
				z.object({
					cid: z.string(),
					score: z.number(),
					description: z.string().optional(),
					tags: z.array(z.string()).optional(),
				}),
			),
			total: z.number(),
		}),
		execute: async ({ context }) => {
			const params = new URLSearchParams({
				q: context.query,
				limit: String(context.limit),
				threshold: String(context.threshold),
			});
			const res = await f(`${apiUrl}/graph/search?${params}`);
			await assertOk(res, "graph search");
			return res.json();
		},
	};

	const graphTraverseTool: MastraTool = {
		id: "w3s-graph-traverse",
		description: "Explore files connected to a given file in your knowledge graph",
		inputSchema: z.object({
			cid: z.string().describe("Starting file CID"),
			depth: z.number().default(2).describe("How many hops to traverse"),
			relationship: z.string().optional().describe("Filter by relationship type"),
		}),
		outputSchema: z.object({
			nodes: z.array(z.object({ cid: z.string(), description: z.string().optional() })),
			edges: z.array(
				z.object({ fromCid: z.string(), toCid: z.string(), relationship: z.string() }),
			),
		}),
		execute: async ({ context }) => {
			const params = new URLSearchParams({ depth: String(context.depth) });
			if (context.relationship) params.set("relationship", context.relationship);
			const res = await f(`${apiUrl}/graph/traverse/${context.cid}?${params}`);
			await assertOk(res, "graph traverse");
			return res.json();
		},
	};

	const graphRemoveFileTool: MastraTool = {
		id: "w3s-graph-remove-file",
		description: "Remove a file from your knowledge graph",
		inputSchema: z.object({
			cid: z.string().describe("CID of the file to remove"),
		}),
		outputSchema: z.object({ success: z.boolean() }),
		execute: async ({ context }) => {
			const res = await f(`${apiUrl}/graph/files/${context.cid}`, { method: "DELETE" });
			await assertOk(res, "graph remove file");
			return res.json();
		},
	};

	const graphDisconnectFilesTool: MastraTool = {
		id: "w3s-graph-disconnect-files",
		description: "Remove a relationship between two files in your knowledge graph",
		inputSchema: z.object({
			fromCid: z.string().describe("Source file CID"),
			toCid: z.string().describe("Target file CID"),
			relationship: z.string().describe("Relationship label to remove"),
		}),
		outputSchema: z.object({ success: z.boolean() }),
		execute: async ({ context }) => {
			const res = await f(`${apiUrl}/graph/connections`, {
				method: "DELETE",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					fromCid: context.fromCid,
					toCid: context.toCid,
					relationship: context.relationship,
				}),
			});
			await assertOk(res, "graph disconnect files");
			return res.json();
		},
	};

	const graphConnectAgentTool: MastraTool = {
		id: "w3s-graph-connect-agent",
		description: "Connect to another agent in your knowledge graph",
		inputSchema: z.object({
			targetWallet: z.string().describe("Wallet address of the agent to connect to"),
		}),
		outputSchema: z.object({
			fromWallet: z.string(),
			toWallet: z.string(),
		}),
		execute: async ({ context }) => {
			const res = await f(`${apiUrl}/graph/agents`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ targetWallet: context.targetWallet }),
			});
			await assertOk(res, "graph connect agent");
			return res.json();
		},
	};

	return {
		uploadTool, listTool, statusTool, attestTool,
		graphAddFileTool, graphConnectFilesTool, graphSearchTool, graphTraverseTool,
		graphRemoveFileTool, graphDisconnectFilesTool, graphConnectAgentTool,
	};
}

export type { W3StorConfig };
