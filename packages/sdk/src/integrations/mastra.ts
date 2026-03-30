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
 * const { uploadTool, listTool, statusTool, attestTool } = await createTools({
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

	return { uploadTool, listTool, statusTool, attestTool };
}

export type { W3StorConfig };
