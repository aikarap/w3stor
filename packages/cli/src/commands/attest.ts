import { type Cli, z } from "incur";
import { createPaymentFetch, getServerUrl } from "../fetch.ts";

export function registerAttest(cli: ReturnType<typeof Cli.create>) {
	cli.command("attest", {
		description: "Get a storage attestation for a file (x402 payment required)",
		args: z.object({
			cid: z.string().describe("Content identifier (CID) of the file"),
		}),
		output: z.object({
			success: z.boolean(),
			attestation: z.object({
				cid: z.string(),
				pieceCid: z.string().nullable(),
				sizeBytes: z.number(),
				status: z.string(),
				providers: z.array(
					z.object({
						id: z.string(),
						url: z.string().nullable(),
						status: z.string().nullable(),
						verifiedAt: z.string().nullable(),
						pieceCid: z.string().nullable(),
					}),
				),
				replicationStatus: z.object({
					confirmed: z.number(),
					total: z.number(),
					fullyReplicated: z.boolean(),
				}),
				verification: z.object({
					attestationHash: z.string(),
					verificationHash: z.string(),
					timestamp: z.string(),
					verifier: z.string(),
				}),
			}),
		}),
		examples: [
			{
				args: { cid: "bafkrei..." },
				description: "Get attestation for a stored file",
			},
		],
		hint: "Attestation requires the file to have sufficient SP replication. x402 payment is required.",
		async run(c) {
			const { cid } = c.args;
			const payFetch = createPaymentFetch();
			const serverUrl = getServerUrl();

			const res = await payFetch(`${serverUrl}/attest/${cid}`, {
				method: "POST",
			});

			if (!res.ok) {
				const body = await res.text();
				let errorMsg: string;
				let code = `HTTP_${res.status}`;
				try {
					const err = JSON.parse(body);
					errorMsg = err.message || err.error || body;
					if (err.error === "Insufficient replication") {
						code = "INSUFFICIENT_REPLICATION";
					}
				} catch {
					errorMsg = body;
				}
				return c.error({
					code,
					message: errorMsg,
					retryable: res.status >= 500,
					cta: {
						description: "Try:",
						commands: [
							{
								command: "status",
								args: { cid },
								description: "Check current replication status",
							},
						],
					},
				});
			}

			const data = await res.json();

			return c.ok(data, {
				cta: {
					description: "Attestation retrieved:",
					commands: [
						{
							command: "status",
							args: { cid },
							description: "View full replication details",
						},
						{ command: "files", description: "List all files" },
					],
				},
			});
		},
	});
}
