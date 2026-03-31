/**
 * @w3stor/sdk/ai-sdk — Vercel AI SDK integration
 *
 * Standalone tools for generateText / streamText.
 * Pass a `privateKey` and the SDK handles x402 payments automatically.
 *
 * @example
 * ```ts
 * import { createTools } from "@w3stor/sdk/ai-sdk";
 *
 * const { storeFile, listFiles, checkStatus, attestFile, graphSearch, graphAddFile } = await createTools({
 *   privateKey: process.env.PRIVATE_KEY,
 * });
 * ```
 */

import { tool } from "ai";
import { z } from "zod";
import { type W3StorConfig, createFetch, getApiUrl } from "./client";

async function assertOk(res: Response, label: string): Promise<void> {
	if (!res.ok) {
		const body = await res.text().catch(() => "");
		throw new Error(`w3stor ${label} failed (${res.status}): ${body}`);
	}
}

export async function createTools(config?: W3StorConfig) {
	const apiUrl = getApiUrl(config);
	const f = await createFetch(config);

	const storeFile = tool({
		description: "Upload a file to decentralized storage (IPFS + Filecoin)",
		parameters: z.object({
			filePath: z.string().describe("Path or URL to the file to upload"),
			tags: z.string().optional().describe("Comma-separated tags"),
			replicationTarget: z.number().default(3).describe("Number of SP replicas"),
		}),
		execute: async ({ filePath, tags, replicationTarget }) => {
			const formData = new FormData();
			const file = await f(filePath).then((r) => r.blob());
			formData.append("file", file);
			if (tags) formData.append("tags", tags);
			if (replicationTarget) formData.append("replicationTarget", String(replicationTarget));

			const res = await f(`${apiUrl}/upload`, { method: "POST", body: formData });
			await assertOk(res, "upload");
			return res.json();
		},
	});

	const listFiles = tool({
		description: "List files stored in decentralized storage",
		parameters: z.object({
			status: z.enum(["pinned", "storing", "stored"]).optional(),
			limit: z.number().default(50),
		}),
		execute: async ({ status, limit }) => {
			const params = new URLSearchParams();
			if (status) params.set("status", status);
			params.set("limit", String(limit));

			const res = await f(`${apiUrl}/files?${params}`);
			await assertOk(res, "list files");
			return res.json();
		},
	});

	const checkStatus = tool({
		description: "Check replication status for a CID",
		parameters: z.object({
			cid: z.string().describe("Content identifier to check"),
		}),
		execute: async ({ cid }) => {
			const res = await f(`${apiUrl}/status/${cid}`);
			await assertOk(res, "check status");
			return res.json();
		},
	});

	const attestFile = tool({
		description: "Create an on-chain attestation for a stored file",
		parameters: z.object({
			cid: z.string().describe("CID to attest"),
		}),
		execute: async ({ cid }) => {
			const res = await f(`${apiUrl}/attest/${cid}`, { method: "POST" });
			await assertOk(res, "attest");
			return res.json();
		},
	});

	const graphAddFile = tool({
		description: "Add a file to your knowledge graph for semantic search and connections",
		parameters: z.object({
			cid: z.string().describe("CID of the file to add"),
			description: z.string().optional().describe("Description of the file"),
			tags: z.string().optional().describe("Comma-separated tags"),
		}),
		execute: async ({ cid, description, tags }) => {
			const res = await f(`${apiUrl}/graph/files`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					cid,
					description,
					tags: tags?.split(",").map((t) => t.trim()),
				}),
			});
			await assertOk(res, "graph add file");
			return res.json();
		},
	});

	const graphConnectFiles = tool({
		description: "Create a relationship between two files in your knowledge graph",
		parameters: z.object({
			fromCid: z.string().describe("Source file CID"),
			toCid: z.string().describe("Target file CID"),
			relationship: z.string().describe("Relationship label (e.g., references, derived_from)"),
		}),
		execute: async ({ fromCid, toCid, relationship }) => {
			const res = await f(`${apiUrl}/graph/connections`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ fromCid, toCid, relationship }),
			});
			await assertOk(res, "graph connect files");
			return res.json();
		},
	});

	const graphSearch = tool({
		description: "Semantic search across your stored files using natural language",
		parameters: z.object({
			query: z.string().describe("Natural language search query"),
			limit: z.number().default(10).describe("Max results"),
			threshold: z.number().default(0.5).describe("Minimum similarity score (0-1)"),
		}),
		execute: async ({ query, limit, threshold }) => {
			const params = new URLSearchParams({
				q: query,
				limit: String(limit),
				threshold: String(threshold),
			});
			const res = await f(`${apiUrl}/graph/search?${params}`);
			await assertOk(res, "graph search");
			return res.json();
		},
	});

	const graphTraverse = tool({
		description: "Explore files connected to a given file in your knowledge graph",
		parameters: z.object({
			cid: z.string().describe("Starting file CID"),
			depth: z.number().default(2).describe("How many hops to traverse"),
			relationship: z.string().optional().describe("Filter by relationship type"),
		}),
		execute: async ({ cid, depth, relationship }) => {
			const params = new URLSearchParams({ depth: String(depth) });
			if (relationship) params.set("relationship", relationship);
			const res = await f(`${apiUrl}/graph/traverse/${cid}?${params}`);
			await assertOk(res, "graph traverse");
			return res.json();
		},
	});

	const graphRemoveFile = tool({
		description: "Remove a file from your knowledge graph",
		parameters: z.object({
			cid: z.string().describe("CID of the file to remove"),
		}),
		execute: async ({ cid }) => {
			const res = await f(`${apiUrl}/graph/files/${cid}`, { method: "DELETE" });
			await assertOk(res, "graph remove file");
			return res.json();
		},
	});

	const graphDisconnectFiles = tool({
		description: "Remove a relationship between two files in your knowledge graph",
		parameters: z.object({
			fromCid: z.string().describe("Source file CID"),
			toCid: z.string().describe("Target file CID"),
			relationship: z.string().describe("Relationship label to remove"),
		}),
		execute: async ({ fromCid, toCid, relationship }) => {
			const res = await f(`${apiUrl}/graph/connections`, {
				method: "DELETE",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ fromCid, toCid, relationship }),
			});
			await assertOk(res, "graph disconnect files");
			return res.json();
		},
	});

	const graphConnectAgent = tool({
		description: "Connect to another agent in your knowledge graph",
		parameters: z.object({
			targetWallet: z.string().describe("Wallet address of the agent to connect to"),
		}),
		execute: async ({ targetWallet }) => {
			const res = await f(`${apiUrl}/graph/agents`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ targetWallet }),
			});
			await assertOk(res, "graph connect agent");
			return res.json();
		},
	});

	return {
		storeFile, listFiles, checkStatus, attestFile,
		graphAddFile, graphConnectFiles, graphSearch, graphTraverse,
		graphRemoveFile, graphDisconnectFiles, graphConnectAgent,
	};
}

export type { W3StorConfig };
