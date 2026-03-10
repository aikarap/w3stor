import { type Cli, z } from "incur";
import config from "../config.ts";

export function registerInit(cli: ReturnType<typeof Cli.create>) {
	cli.command("init", {
		description: "Initialize w3stor with your wallet and server configuration",
		options: z.object({
			privateKey: z.string().optional().describe("EVM private key (hex, 0x-prefixed)"),
			keystore: z.string().optional().describe("Path to cast keystore file"),
			serverUrl: z.string().optional().describe("Web3 Storage Agent server URL"),
			auto: z.boolean().optional().describe("Use environment variable PRIVATE_KEY if set"),
		}),
		alias: { privateKey: "k", keystore: "K", serverUrl: "s" },
		output: z.object({
			configured: z.boolean(),
			serverUrl: z.string(),
			wallet: z.string().optional(),
		}),
		examples: [
			{
				options: { privateKey: "0xabc...def" },
				description: "Initialize with a private key",
			},
			{
				options: { keystore: "~/.foundry/keystores/default" },
				description: "Initialize with a cast keystore",
			},
			{
				options: { auto: true },
				description: "Initialize from PRIVATE_KEY env var",
			},
		],
		hint: "Your private key is stored locally in an encrypted config file managed by the `conf` package. It never leaves your machine.",
		run(c) {
			const { privateKey, keystore, serverUrl, auto } = c.options;

			if (auto) {
				const envKey = process.env.PRIVATE_KEY;
				if (!envKey) {
					return c.error({
						code: "ENV_NOT_SET",
						message:
							"PRIVATE_KEY environment variable is not set. Pass --privateKey or --keystore instead.",
						retryable: true,
						cta: {
							description: "Try one of:",
							commands: [
								{
									command: "init",
									options: { privateKey: "0x..." },
									description: "Set key directly",
								},
								{
									command: "init",
									options: { keystore: "~/.foundry/keystores/default" },
									description: "Use cast keystore",
								},
							],
						},
					});
				}
				config.set("privateKey", envKey);
			} else if (privateKey) {
				if (!privateKey.startsWith("0x") || privateKey.length !== 66) {
					return c.error({
						code: "INVALID_KEY",
						message: "Private key must be a 0x-prefixed 64-character hex string (66 chars total).",
						retryable: true,
					});
				}
				config.set("privateKey", privateKey);
			} else if (keystore) {
				config.set("keystore", keystore);
			} else {
				return c.error({
					code: "NO_KEY_PROVIDED",
					message:
						"Provide a private key, keystore path, or use --auto to read from PRIVATE_KEY env var.",
					retryable: true,
					cta: {
						description: "Provide credentials:",
						commands: [
							{
								command: "init",
								options: { auto: true },
								description: "Read from PRIVATE_KEY env var",
							},
							{
								command: "init",
								options: { privateKey: "0x..." },
								description: "Provide private key directly",
							},
						],
					},
				});
			}

			if (serverUrl) {
				config.set("serverUrl", serverUrl);
			}

			// Derive wallet address for confirmation
			let wallet: string | undefined;
			try {
				const { privateKeyToAccount } = require("viem/accounts");
				const key = config.get("privateKey");
				if (key) {
					wallet = privateKeyToAccount(key as `0x${string}`).address;
				}
			} catch {
				// keystore mode — can't derive without password prompt
			}

			const currentUrl = config.get("serverUrl") || "http://localhost:4000";

			return c.ok(
				{ configured: true, serverUrl: currentUrl, wallet },
				{
					cta: {
						description: "You're ready! Try:",
						commands: [
							{ command: "health", description: "Check server connectivity" },
							{
								command: "upload",
								args: { file: "myfile.txt" },
								description: "Upload a file",
							},
							{
								command: "wallet balance",
								description: "Check your USDC balance",
							},
						],
					},
				},
			);
		},
	});
}
