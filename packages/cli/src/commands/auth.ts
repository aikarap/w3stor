import { type Cli, z } from "incur";
import type { Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { privateKeyFromConfig } from "../client.ts";
import { AUTH_DOMAIN } from "../config.ts";
import { getServerUrl } from "../fetch.ts";

/**
 * Perform the SIWE flow and return a JWT token.
 * Exported so graph commands can call it directly.
 */
export async function siweLogin(): Promise<{ token: string; address: string }> {
	const privateKey = privateKeyFromConfig();
	const account = privateKeyToAccount(privateKey as Hex);
	const address = account.address;
	const serverUrl = getServerUrl();

	// 1. Get nonce
	const nonceRes = await fetch(`${serverUrl}/auth/siwe/nonce`);
	if (!nonceRes.ok) {
		throw new Error(`Failed to fetch SIWE nonce: ${nonceRes.status} ${nonceRes.statusText}`);
	}
	const { nonce } = (await nonceRes.json()) as { nonce: string };

	// 2. Construct SIWE message — domain must match server's SIWE_DOMAIN (w3stor.xyz)
	const issuedAt = new Date().toISOString();
	const message = [
		`${AUTH_DOMAIN} wants you to sign in with your Ethereum account:`,
		address,
		"",
		"Sign in to W3Stor",
		"",
		`URI: ${serverUrl}`,
		"Version: 1",
		"Chain ID: 84532",
		`Nonce: ${nonce}`,
		`Issued At: ${issuedAt}`,
	].join("\n");

	// 3. Sign message
	const signature = await account.signMessage({ message });

	// 4. Verify with server
	const verifyRes = await fetch(`${serverUrl}/auth/siwe/verify`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ message, signature }),
	});

	if (!verifyRes.ok) {
		const body = await verifyRes.text();
		let errMsg: string;
		try {
			const err = JSON.parse(body);
			errMsg = err.message || err.error || body;
		} catch {
			errMsg = body;
		}
		throw new Error(`SIWE verification failed: ${errMsg}`);
	}

	const { token } = (await verifyRes.json()) as { token: string };
	return { token, address };
}

export function registerAuth(cli: ReturnType<typeof Cli.create>) {
	cli.command("auth login", {
		description: "Sign in with your Ethereum wallet using SIWE (Sign-In with Ethereum)",
		args: z.object({}),
		output: z.object({
			address: z.string().describe("Authenticated wallet address"),
			token: z.string().describe("JWT token for authenticated requests"),
		}),
		examples: [
			{
				args: {},
				description: "Sign in with the configured wallet",
			},
		],
		hint: "Uses the private key from your w3stor config to sign the SIWE message.",
		async run(c) {
			let privateKey: string;
			try {
				privateKey = privateKeyFromConfig();
			} catch (e) {
				return c.error({
					code: "NO_PRIVATE_KEY",
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

			// Suppress unused variable warning — we only need it to validate existence above
			void privateKey;

			try {
				const { token, address } = await siweLogin();
				return c.ok(
					{ address, token },
					{
						cta: {
							description: "You are now authenticated. Use the token for graph operations:",
							commands: [
								{
									command: "graph search",
									args: { query: "<topic>" },
									description: "Search the knowledge graph",
								},
								{
									command: "graph traverse",
									args: { cid: "<cid>" },
									description: "Traverse the knowledge graph",
								},
							],
						},
					},
				);
			} catch (e) {
				return c.error({
					code: "AUTH_FAILED",
					message: (e as Error).message,
					retryable: true,
				});
			}
		},
	});
}
