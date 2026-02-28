import { type Cli, z } from "incur";
import { getServerUrl } from "../fetch.ts";

export function registerStatus(cli: ReturnType<typeof Cli.create>) {
	cli.command("status", {
		description: "Check replication status of a file across Pinata and Filecoin SPs",
		args: z.object({
			cid: z.string().describe("Content identifier (CID) of the file"),
		}),
		output: z.object({
			cid: z.string(),
			status: z.string(),
			pinataStatus: z.boolean(),
			filecoinStatus: z.record(z.string(), z.string().nullable()),
			verifiedSPs: z.number(),
			createdAt: z.string(),
		}),
		examples: [
			{
				args: { cid: "bafkrei..." },
				description: "Check status of a file by CID",
			},
		],
		async run(c) {
			const { cid } = c.args;
			const serverUrl = getServerUrl();

			const res = await fetch(`${serverUrl}/status/${cid}`);

			if (res.status === 404) {
				return c.error({
					code: "NOT_FOUND",
					message: `No file found with CID: ${cid}`,
					retryable: false,
					cta: {
						description: "Try:",
						commands: [
							{ command: "files", description: "List your uploaded files" },
							{
								command: "upload",
								args: { file: "<path>" },
								description: "Upload a file first",
							},
						],
					},
				});
			}

			if (!res.ok) {
				const body = await res.text();
				return c.error({
					code: `HTTP_${res.status}`,
					message: body,
					retryable: res.status >= 500,
				});
			}

			const data = await res.json();

			return c.ok(data, {
				cta: {
					description: "Next:",
					commands: [
						{
							command: "attest",
							args: { cid },
							description: "Get storage attestation",
						},
						{ command: "files", description: "List all files" },
					],
				},
			});
		},
	});
}
