import { type Cli, z } from "incur";
import type { Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { privateKeyFromConfig } from "../client.ts";
import { createPaymentFetch, getServerUrl } from "../fetch.ts";

/**
 * Resolve the wallet address from config or env fallback.
 */
function resolveWallet(): string {
	try {
		const pk = privateKeyFromConfig();
		return privateKeyToAccount(pk as Hex).address.toLowerCase();
	} catch {
		const envWallet = process.env.W3STOR_WALLET;
		if (envWallet) return envWallet.toLowerCase();
		throw new Error("Wallet not configured. Run `w3stor init` to set up your wallet.");
	}
}

/**
 * Parse a JSON error body and return a human-readable message.
 */
async function parseErrorMessage(res: Response): Promise<string> {
	const body = await res.text();
	try {
		const err = JSON.parse(body);
		return err.message || err.error || body;
	} catch {
		return body;
	}
}

export function registerGraph(cli: ReturnType<typeof Cli.create>) {
	// ── graph add ────────────────────────────────────────────────────────────
	cli.command("graph add", {
		description: "Add a file to the knowledge graph (x402 payment required)",
		args: z.object({
			cid: z.string().describe("IPFS CID of the file to index"),
		}),
		output: z.object({
			cid: z.string(),
			nodeId: z.string(),
			status: z.string(),
		}),
		examples: [
			{
				args: { cid: "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi" },
				description: "Add a file to the knowledge graph",
			},
		],
		hint: "Requires USDC on Base Sepolia for x402 payment.",
		async run(c) {
			const { cid } = c.args;
			const payFetch = createPaymentFetch();
			const serverUrl = getServerUrl();

			const res = await payFetch(`${serverUrl}/graph/files`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ cid }),
			});

			if (!res.ok) {
				return c.error({
					code: `HTTP_${res.status}`,
					message: await parseErrorMessage(res),
					retryable: res.status >= 500,
				});
			}

			const data = (await res.json()) as { cid: string; nodeId: string; status: string };

			return c.ok(data, {
				cta: {
					description: "Next steps:",
					commands: [
						{
							command: "graph traverse",
							args: { cid },
							description: "Traverse the graph from this file",
						},
						{
							command: "graph search",
							args: { query: "<topic>" },
							description: "Search for related files",
						},
					],
				},
			});
		},
	});

	// ── graph connect ─────────────────────────────────────────────────────────
	cli.command("graph connect", {
		description: "Create a relationship between two files (x402 payment required)",
		args: z.object({
			fromCid: z.string().describe("Source file CID"),
			toCid: z.string().describe("Target file CID"),
		}),
		options: z.object({
			rel: z.string().optional().describe("Relationship label (default: RELATED_TO)"),
		}),
		alias: { rel: "r" },
		output: z.object({
			fromCid: z.string(),
			toCid: z.string(),
			relationship: z.string(),
			edgeId: z.string(),
		}),
		examples: [
			{
				args: {
					fromCid: "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi",
					toCid: "bafkreihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenxquvyku",
				},
				options: { rel: "REFERENCES" },
				description: "Link two files with a REFERENCES relationship",
			},
		],
		hint: "Requires USDC on Base Sepolia for x402 payment.",
		async run(c) {
			const { fromCid, toCid } = c.args;
			const { rel = "RELATED_TO" } = c.options;

			const payFetch = createPaymentFetch();
			const serverUrl = getServerUrl();

			const res = await payFetch(`${serverUrl}/graph/connections`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ fromCid, toCid, relationship: rel }),
			});

			if (!res.ok) {
				return c.error({
					code: `HTTP_${res.status}`,
					message: await parseErrorMessage(res),
					retryable: res.status >= 500,
				});
			}

			const data = (await res.json()) as {
				fromCid: string;
				toCid: string;
				relationship: string;
				edgeId: string;
			};

			return c.ok(data, {
				cta: {
					description: "Next steps:",
					commands: [
						{
							command: "graph traverse",
							args: { cid: fromCid },
							description: "Traverse the graph from the source file",
						},
					],
				},
			});
		},
	});

	// ── graph search ──────────────────────────────────────────────────────────
	cli.command("graph search", {
		description: "Search the knowledge graph by semantic query",
		args: z.object({
			query: z.string().describe("Search query"),
		}),
		options: z.object({
			wallet: z.string().optional().describe("Wallet address (defaults to configured wallet)"),
			limit: z.number().optional().describe("Maximum results to return"),
		}),
		alias: { wallet: "w", limit: "l" },
		output: z.object({
			results: z.array(
				z.object({
					cid: z.string(),
					score: z.number(),
					filename: z.string().optional(),
				}),
			),
			total: z.number(),
		}),
		examples: [
			{
				args: { query: "machine learning datasets" },
				description: "Search for files related to machine learning",
			},
			{
				args: { query: "quarterly report" },
				options: { limit: 5 },
				description: "Find top 5 quarterly reports",
			},
		],
		async run(c) {
			const { query } = c.args;

			let wallet = c.options.wallet;
			if (!wallet) {
				try {
					wallet = resolveWallet();
				} catch (e) {
					return c.error({
						code: "NO_WALLET",
						message: (e as Error).message,
						retryable: true,
						cta: {
							description: "Set up your wallet first:",
							commands: [
								{
									command: "init",
									options: { auto: true },
									description: "Initialize from env var",
								},
							],
						},
					});
				}
			}

			const serverUrl = getServerUrl();
			const params = new URLSearchParams({ wallet, q: query });
			if (c.options.limit) params.set("limit", String(c.options.limit));

			const res = await fetch(`${serverUrl}/graph/search?${params}`);

			if (!res.ok) {
				return c.error({
					code: `HTTP_${res.status}`,
					message: await parseErrorMessage(res),
					retryable: res.status >= 500,
				});
			}

			const data = (await res.json()) as {
				results: Array<{ cid: string; score: number; filename?: string }>;
				total: number;
			};

			return c.ok(data, {
				cta: {
					description: "Actions:",
					commands: [
						{
							command: "graph traverse",
							args: { cid: "<cid>" },
							description: "Traverse the graph from a result",
						},
					],
				},
			});
		},
	});

	// ── graph traverse ────────────────────────────────────────────────────────
	cli.command("graph traverse", {
		description: "Traverse the knowledge graph from a file node",
		args: z.object({
			cid: z.string().describe("Starting file CID"),
		}),
		options: z.object({
			wallet: z.string().optional().describe("Wallet address (defaults to configured wallet)"),
			depth: z.number().optional().describe("Traversal depth (default: 2)"),
		}),
		alias: { wallet: "w", depth: "d" },
		output: z.object({
			nodes: z.array(
				z.object({
					cid: z.string(),
					filename: z.string().optional(),
					depth: z.number(),
				}),
			),
			edges: z.array(
				z.object({
					fromCid: z.string(),
					toCid: z.string(),
					relationship: z.string(),
				}),
			),
		}),
		examples: [
			{
				args: { cid: "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi" },
				description: "Traverse up to depth 2 from a file",
			},
			{
				args: { cid: "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi" },
				options: { depth: 3 },
				description: "Traverse up to depth 3",
			},
		],
		async run(c) {
			const { cid } = c.args;

			let wallet = c.options.wallet;
			if (!wallet) {
				try {
					wallet = resolveWallet();
				} catch (e) {
					return c.error({
						code: "NO_WALLET",
						message: (e as Error).message,
						retryable: true,
						cta: {
							description: "Set up your wallet first:",
							commands: [
								{
									command: "init",
									options: { auto: true },
									description: "Initialize from env var",
								},
							],
						},
					});
				}
			}

			const serverUrl = getServerUrl();
			const params = new URLSearchParams({ wallet });
			if (c.options.depth) params.set("depth", String(c.options.depth));

			const res = await fetch(`${serverUrl}/graph/traverse/${encodeURIComponent(cid)}?${params}`);

			if (!res.ok) {
				return c.error({
					code: `HTTP_${res.status}`,
					message: await parseErrorMessage(res),
					retryable: res.status >= 500,
				});
			}

			const data = (await res.json()) as {
				nodes: Array<{ cid: string; filename?: string; depth: number }>;
				edges: Array<{ fromCid: string; toCid: string; relationship: string }>;
			};

			return c.ok(data, {
				cta: {
					description: "Actions:",
					commands: [
						{
							command: "graph connect",
							args: { fromCid: cid, toCid: "<cid>" },
							description: "Connect this file to another",
						},
						{
							command: "graph search",
							args: { query: "<topic>" },
							description: "Search for related files",
						},
					],
				},
			});
		},
	});

	// ── graph remove ──────────────────────────────────────────────────────────
	cli.command("graph remove", {
		description: "Remove a file from the knowledge graph (x402 payment required)",
		args: z.object({
			cid: z.string().describe("IPFS CID of the file to remove"),
		}),
		output: z.object({
			cid: z.string(),
			removed: z.boolean(),
		}),
		examples: [
			{
				args: { cid: "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi" },
				description: "Remove a file node from the knowledge graph",
			},
		],
		hint: "Requires USDC on Base Sepolia for x402 payment. This removes the node and all its edges.",
		async run(c) {
			const { cid } = c.args;
			const payFetch = createPaymentFetch();
			const serverUrl = getServerUrl();

			const res = await payFetch(`${serverUrl}/graph/files/${encodeURIComponent(cid)}`, {
				method: "DELETE",
			});

			if (!res.ok) {
				return c.error({
					code: `HTTP_${res.status}`,
					message: await parseErrorMessage(res),
					retryable: res.status >= 500,
				});
			}

			const data = (await res.json()) as { cid: string; removed: boolean };

			return c.ok(data, {
				cta: {
					description: "Actions:",
					commands: [
						{
							command: "graph search",
							args: { query: "<topic>" },
							description: "Search remaining graph nodes",
						},
					],
				},
			});
		},
	});
}
