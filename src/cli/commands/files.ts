import { type Cli, z } from "incur";
import type { Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { privateKeyFromConfig } from "../client.ts";
import { getServerUrl } from "../fetch.ts";

export function registerFiles(cli: ReturnType<typeof Cli.create>) {
	cli.command("files", {
		description: "List your uploaded files",
		options: z.object({
			wallet: z.string().optional().describe("Wallet address (defaults to configured wallet)"),
			page: z.number().optional().describe("Page number"),
			limit: z.number().optional().describe("Results per page"),
			status: z
				.enum(["pinata_pinned", "uploading", "stored", "fully_replicated", "failed"])
				.optional()
				.describe("Filter by file status"),
			search: z.string().optional().describe("Search filenames"),
			tags: z.string().optional().describe("Comma-separated tag filter"),
		}),
		alias: { wallet: "w", page: "p", limit: "l", status: "s" },
		output: z.object({
			files: z.array(
				z.object({
					cid: z.string(),
					filename: z.string(),
					size: z.number(),
					status: z.string(),
					createdAt: z.string(),
					spCount: z.number(),
				}),
			),
			total: z.number(),
			page: z.number(),
			limit: z.number(),
			hasMore: z.boolean(),
		}),
		examples: [
			{ description: "List all your files" },
			{
				options: { status: "stored" },
				description: "Show only stored files",
			},
			{
				options: { search: "report", limit: 5 },
				description: "Search for files matching 'report'",
			},
		],
		async run(c) {
			// Resolve wallet address
			let wallet = c.options.wallet;
			if (!wallet) {
				try {
					const pk = privateKeyFromConfig();
					wallet = privateKeyToAccount(pk as Hex).address.toLowerCase();
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
			if (c.options.page) params.set("page", String(c.options.page));
			if (c.options.limit) params.set("limit", String(c.options.limit));
			if (c.options.status) params.set("status", c.options.status);
			if (c.options.search) params.set("search", c.options.search);
			if (c.options.tags) params.set("tags", c.options.tags);

			const res = await fetch(`${serverUrl}/files?${params}`);

			if (!res.ok) {
				const body = await res.text();
				let errorMsg: string;
				try {
					const err = JSON.parse(body);
					errorMsg = err.message || err.error || body;
				} catch {
					errorMsg = body;
				}
				return c.error({
					code: `HTTP_${res.status}`,
					message: errorMsg,
					retryable: res.status >= 500,
				});
			}

			const data = await res.json();

			return c.ok(data, {
				cta: {
					description: "Actions:",
					commands: [
						{
							command: "status",
							args: { cid: "<cid>" },
							description: "Check replication status of a file",
						},
						{
							command: "upload",
							args: { file: "<path>" },
							description: "Upload a new file",
						},
					],
				},
			});
		},
	});
}
