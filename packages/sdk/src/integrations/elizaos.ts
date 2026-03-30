/**
 * @w3stor/sdk/elizaos — ElizaOS plugin integration
 *
 * Ready-to-use plugin with three action handlers.
 * Pass a `privateKey` and the SDK handles x402 payments automatically.
 *
 * @example
 * ```ts
 * import { createW3StorPlugin } from "@w3stor/sdk/elizaos";
 *
 * const plugin = await createW3StorPlugin({
 *   privateKey: process.env.PRIVATE_KEY,
 * });
 * ```
 */

import { createFetch, getApiUrl, type W3StorConfig } from "./client";

// ---- ElizaOS-compatible type definitions ----

export interface Memory {
	content: {
		text?: string;
		attachments?: Array<{
			name: string;
			data: Uint8Array | ArrayBuffer;
			mimeType: string;
		}>;
	};
}

export interface Action {
	name: string;
	similes: string[];
	description: string;
	validate: (runtime: unknown, message: Memory) => Promise<boolean>;
	handler: (
		runtime: unknown,
		message: Memory,
		state?: unknown,
	) => Promise<{ text: string; data?: unknown }>;
	examples: Array<Array<{ user: string; content: { text: string; action?: string } }>>;
}

export interface Plugin {
	name: string;
	description: string;
	actions: Action[];
	evaluators: unknown[];
	providers: unknown[];
}

// ---- Actions ----

function createStoreAction(apiUrl: string, f: typeof fetch): Action {
	return {
		name: "STORE_ON_FILECOIN",
		similes: ["UPLOAD_FILE", "SAVE_TO_IPFS", "STORE_DATA", "PIN_FILE"],
		description: "Upload a file to IPFS and replicate across Filecoin SPs",

		validate: async (_runtime: unknown, message: Memory) => {
			const text = message.content.text?.toLowerCase() ?? "";
			return (
				text.includes("upload") ||
				text.includes("store") ||
				text.includes("save") ||
				text.includes("pin") ||
				!!message.content.attachments?.length
			);
		},

		handler: async (_runtime: unknown, message: Memory) => {
			const attachments = message.content.attachments ?? [];
			if (attachments.length === 0) {
				return { text: "Please attach a file to upload to decentralized storage." };
			}

			const results = [];
			for (const attachment of attachments) {
				const formData = new FormData();
				const blob = new Blob([attachment.data as ArrayBuffer], { type: attachment.mimeType });
				formData.append("file", blob, attachment.name);

				const res = await f(`${apiUrl}/upload`, { method: "POST", body: formData });
				if (!res.ok) {
					const body = await res.text().catch(() => "");
					throw new Error(`w3stor upload failed (${res.status}): ${body}`);
				}
				results.push(await res.json());
			}

			const summary = results.map((r) => `- ${r.cid} (${r.size} bytes)`).join("\n");
			return {
				text: `Uploaded ${results.length} file(s):\n${summary}\n\nPinned on IPFS, replicating to Filecoin SPs.`,
				data: results,
			};
		},

		examples: [
			[
				{ user: "user", content: { text: "Store this research data on Filecoin" } },
				{
					user: "agent",
					content: {
						text: "Uploaded 1 file. CID: bafkrei... Replicating to 3 SPs.",
						action: "STORE_ON_FILECOIN",
					},
				},
			],
		],
	};
}

function createListAction(apiUrl: string, f: typeof fetch): Action {
	return {
		name: "LIST_STORED_FILES",
		similes: ["SHOW_FILES", "MY_FILES", "LIST_UPLOADS"],
		description: "List files stored in decentralized storage",

		validate: async (_runtime: unknown, message: Memory) => {
			const text = message.content.text?.toLowerCase() ?? "";
			return text.includes("list") || text.includes("files") || text.includes("show");
		},

		handler: async () => {
			const res = await f(`${apiUrl}/files?limit=20`);
			if (!res.ok) {
				const body = await res.text().catch(() => "");
				throw new Error(`w3stor list failed (${res.status}): ${body}`);
			}
			const data = await res.json();
			const table = data.files
				.map(
					(file: { cid: string; status: string; size: number }) =>
						`- ${file.cid.slice(0, 20)}... | ${file.status} | ${file.size} bytes`,
				)
				.join("\n");

			return { text: `${data.total} stored files:\n${table}`, data: data.files };
		},

		examples: [
			[
				{ user: "user", content: { text: "Show me my stored files" } },
				{ user: "agent", content: { text: "4 stored files:...", action: "LIST_STORED_FILES" } },
			],
		],
	};
}

function createStatusAction(apiUrl: string, f: typeof fetch): Action {
	return {
		name: "CHECK_STORAGE_STATUS",
		similes: ["FILE_STATUS", "CHECK_CID", "REPLICATION_STATUS"],
		description: "Check replication status for a specific CID",

		validate: async (_runtime: unknown, message: Memory) => {
			const text = message.content.text ?? "";
			return text.includes("status") || text.includes("bafk") || text.includes("check");
		},

		handler: async (_runtime: unknown, message: Memory) => {
			const cidMatch = message.content.text?.match(/bafk[a-z0-9]+/);
			if (!cidMatch) {
				return { text: "Please provide a CID to check. Example: check status of bafkrei..." };
			}

			const res = await f(`${apiUrl}/status/${cidMatch[0]}`);
			if (!res.ok) {
				const body = await res.text().catch(() => "");
				throw new Error(`w3stor status failed (${res.status}): ${body}`);
			}
			const data = await res.json();

			return {
				text: `CID: ${data.cid}\nStatus: ${data.status}\nReplicas: ${data.replicationCount}/3\nProviders: ${data.providers?.join(", ") ?? "pending"}`,
				data,
			};
		},

		examples: [
			[
				{ user: "user", content: { text: "Check status of bafkreihdwdcefgh..." } },
				{
					user: "agent",
					content: { text: "CID: bafkrei... Status: stored, 3/3 replicas", action: "CHECK_STORAGE_STATUS" },
				},
			],
		],
	};
}

// ---- Plugin factory ----

export async function createW3StorPlugin(config?: W3StorConfig): Promise<Plugin> {
	const apiUrl = getApiUrl(config);
	const f = await createFetch(config);

	return {
		name: "w3stor",
		description: "Decentralized storage via IPFS + Filecoin with x402 micropayments",
		actions: [createStoreAction(apiUrl, f), createListAction(apiUrl, f), createStatusAction(apiUrl, f)],
		evaluators: [],
		providers: [],
	};
}

export type { W3StorConfig };
