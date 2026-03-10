import { readFileSync, statSync } from "node:fs";
import { basename } from "node:path";
import { type Cli, z } from "incur";
import { createPaymentFetch, getServerUrl } from "../fetch.ts";

export function registerUpload(cli: ReturnType<typeof Cli.create>) {
	cli.command("upload", {
		description: "Upload a file to Web3 Storage Agent (x402 payment required)",
		args: z.object({
			file: z.string().describe("Path to file to upload"),
		}),
		options: z.object({
			metadata: z.string().optional().describe("JSON metadata to attach to the file"),
			tags: z.string().optional().describe("Comma-separated tags for the file"),
		}),
		alias: { metadata: "m", tags: "t" },
		output: z.object({
			cid: z.string(),
			status: z.string(),
			size: z.number(),
			filename: z.string(),
		}),
		examples: [
			{
				args: { file: "photo.jpg" },
				description: "Upload a file",
			},
			{
				args: { file: "data.csv" },
				options: { tags: "dataset,public" },
				description: "Upload with tags",
			},
			{
				args: { file: "report.pdf" },
				options: { metadata: '{"project":"alpha"}' },
				description: "Upload with metadata",
			},
		],
		hint: "Upload requires USDC on Base Sepolia for x402 payment. The payment is handled automatically by the CLI.",
		async run(c) {
			const { file: filePath } = c.args;
			const { metadata, tags } = c.options;

			// Validate file exists
			let stat: ReturnType<typeof statSync>;
			try {
				stat = statSync(filePath);
			} catch {
				return c.error({
					code: "FILE_NOT_FOUND",
					message: `File not found: ${filePath}`,
					retryable: false,
				});
			}

			if (!stat.isFile()) {
				return c.error({
					code: "NOT_A_FILE",
					message: `Path is not a file: ${filePath}`,
					retryable: false,
				});
			}

			// Build metadata object
			let metadataObj: Record<string, unknown> = {};
			if (metadata) {
				try {
					metadataObj = JSON.parse(metadata);
				} catch {
					return c.error({
						code: "INVALID_METADATA",
						message: "Metadata must be valid JSON",
						retryable: true,
					});
				}
			}
			if (tags) {
				metadataObj.tags = tags.split(",").map((t) => t.trim());
			}

			// Read file and create FormData
			const fileBuffer = readFileSync(filePath);
			const fileName = basename(filePath);
			const blob = new Blob([fileBuffer]);
			const fileObj = new File([blob], fileName);

			const form = new FormData();
			form.append("file", fileObj);
			if (Object.keys(metadataObj).length > 0) {
				form.append("metadata", JSON.stringify(metadataObj));
			}

			// Upload with x402 payment
			const payFetch = createPaymentFetch();
			const serverUrl = getServerUrl();

			const res = await payFetch(`${serverUrl}/upload`, {
				method: "POST",
				body: form,
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
				cid: string;
				status: string;
				size: number;
				filename: string;
			};

			return c.ok(data, {
				cta: {
					description: "Next steps:",
					commands: [
						{
							command: "status",
							args: { cid: data.cid },
							description: "Check replication status",
						},
						{ command: "files", description: "List all your files" },
					],
				},
			});
		},
	});
}
