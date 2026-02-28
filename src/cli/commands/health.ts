import { type Cli, z } from "incur";
import { getServerUrl } from "../fetch.ts";

export function registerHealth(cli: ReturnType<typeof Cli.create>) {
	cli.command("health", {
		description: "Check Web3 Storage Agent server health",
		output: z.object({
			status: z.enum(["healthy", "unhealthy"]),
			timestamp: z.string(),
			services: z.object({
				database: z.boolean(),
				redis: z.boolean(),
				pinata: z.boolean(),
			}),
		}),
		examples: [{ description: "Check if the server is healthy" }],
		async run(c) {
			const serverUrl = getServerUrl();

			let res: Response;
			try {
				res = await fetch(`${serverUrl}/health`);
			} catch (e) {
				return c.error({
					code: "CONNECTION_FAILED",
					message: `Cannot reach server at ${serverUrl}: ${(e as Error).message}`,
					retryable: true,
					cta: {
						description: "Troubleshoot:",
						commands: [
							{
								command: "init",
								options: { serverUrl: "http://localhost:4000" },
								description: "Update server URL",
							},
						],
					},
				});
			}

			const data = await res.json();

			if (data.status === "unhealthy") {
				return c.error({
					code: "UNHEALTHY",
					message: `Server is unhealthy. Services: database=${data.services.database}, redis=${data.services.redis}, pinata=${data.services.pinata}`,
					retryable: true,
				});
			}

			return c.ok(data, {
				cta: {
					description: "Server is healthy! Try:",
					commands: [
						{
							command: "upload",
							args: { file: "<path>" },
							description: "Upload a file",
						},
						{ command: "files", description: "List your files" },
					],
				},
			});
		},
	});
}
