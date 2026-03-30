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
 * const { storeFile, listFiles, checkStatus, attestFile } = await createTools({
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

	return { storeFile, listFiles, checkStatus, attestFile };
}

export type { W3StorConfig };
