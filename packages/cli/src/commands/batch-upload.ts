import { readFileSync, statSync } from "node:fs";
import { basename } from "node:path";
import { type Cli, z } from "incur";
import { createPaymentFetch, getServerUrl } from "../fetch.ts";

export function registerBatchUpload(cli: ReturnType<typeof Cli.create>) {
	cli.command("batch", {
		description: "Upload multiple files with graph connections in one operation (x402 payment required)",
		args: z.object({
			files: z.string().describe("Comma-separated paths to files to upload"),
		}),
		options: z.object({
			metadata: z.string().optional().describe("JSON metadata for files and connections"),
		}),
		alias: { metadata: "m" },
		output: z.object({
			files: z.array(z.object({ cid: z.string().optional() }).passthrough()),
			connections: z.array(z.object({ success: z.boolean().optional() }).passthrough()),
			total: z.number(),
			totalConnections: z.number(),
		}),
		examples: [
			{
				args: { files: "a.csv,b.csv" },
				description: "Upload two files with default metadata",
			},
		],
		hint: "Pass file metadata and connections as JSON via --metadata. Each file entry uses index (0-based) matching the order of file arguments. Connections can reference other files by toIndex or existing CIDs by toCid.",
		async run(c) {
			const filePaths = c.args.files.split(",").map((p) => p.trim());
			const { metadata: metadataStr } = c.options;

			// Validate all files exist
			for (const filePath of filePaths) {
				try {
					const stat = statSync(filePath);
					if (!stat.isFile()) {
						return c.error({
							code: "NOT_A_FILE",
							message: `Not a file: ${filePath}`,
							retryable: false,
						});
					}
				} catch {
					return c.error({
						code: "FILE_NOT_FOUND",
						message: `File not found: ${filePath}`,
						retryable: false,
					});
				}
			}

			if (filePaths.length > 10) {
				return c.error({
					code: "TOO_MANY_FILES",
					message: "Maximum 10 files per batch",
					retryable: false,
				});
			}

			// Parse metadata
			let metadata: {
				files: Array<{
					index: number;
					description?: string;
					tags?: string[];
					connections?: Array<{
						toCid?: string;
						toIndex?: number;
						relationship: string;
					}>;
				}>;
			};

			if (metadataStr) {
				try {
					metadata = JSON.parse(metadataStr);
				} catch {
					return c.error({
						code: "INVALID_METADATA",
						message: "Metadata must be valid JSON",
						retryable: true,
					});
				}
			} else {
				// Default: no descriptions, tags, or connections
				metadata = {
					files: filePaths.map((_, i) => ({ index: i })),
				};
			}

			// Build FormData
			const form = new FormData();
			let totalSize = 0;
			let totalConnections = 0;

			for (let i = 0; i < filePaths.length; i++) {
				const fileBuffer = readFileSync(filePaths[i]);
				const fileName = basename(filePaths[i]);
				const blob = new Blob([fileBuffer]);
				const fileObj = new File([blob], fileName);
				form.append(`file_${i}`, fileObj);
				totalSize += fileBuffer.length;
			}

			for (const f of metadata.files) {
				totalConnections += f.connections?.length || 0;
			}

			form.append("metadata", JSON.stringify(metadata));

			// Upload with x402 payment
			const payFetch = createPaymentFetch();
			const serverUrl = getServerUrl();

			const res = await payFetch(`${serverUrl}/batch-upload`, {
				method: "POST",
				body: form,
				headers: {
					"x-batch-files": String(filePaths.length),
					"x-batch-size": String(totalSize),
					"x-batch-connections": String(totalConnections),
				},
			});

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

			const data = (await res.json()) as {
				files: any[];
				connections: any[];
				total: number;
				totalConnections: number;
			};

			return c.ok(data, {
				cta: {
					description: "Next steps:",
					commands: [
						{ command: "graph search", args: { query: "<topic>" }, description: "Search the knowledge graph" },
						{ command: "files", description: "List all your files" },
					],
				},
			});
		},
	});
}
