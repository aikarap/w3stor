/**
 * Shared API client configuration for all integration modules.
 *
 * For paid endpoints (upload, attest), provide either a `privateKey` or
 * a viem `account` and the SDK handles x402 payment signing automatically.
 */

export interface W3StorConfig {
	/** Base URL for the w3stor API. Defaults to W3S_API_URL env var or https://api.w3s.storage */
	apiUrl?: string;

	/** EVM private key (hex string with 0x prefix) for x402 payment signing on Base Sepolia. */
	privateKey?: string;

	/** A viem LocalAccount (from privateKeyToAccount). Takes precedence over privateKey. */
	account?: { address: string; signMessage?: unknown; signTransaction?: unknown };

	/** Fully custom fetch function. Overrides privateKey/account-based x402 handling if provided. */
	fetch?: typeof fetch;
}

export function getApiUrl(config?: W3StorConfig): string {
	return (
		config?.apiUrl ??
		(typeof process !== "undefined" ? process.env?.W3S_API_URL : undefined) ??
		"https://api.w3s.storage"
	);
}

/**
 * Returns a fetch function with automatic x402 payment signing when
 * `account`, `privateKey`, or W3S_PRIVATE_KEY env var is available.
 */
export async function createFetch(config?: W3StorConfig): Promise<typeof fetch> {
	if (config?.fetch) return config.fetch;

	// Resolve account: direct account > privateKey config > env var
	let account = config?.account;

	if (!account) {
		const pk =
			config?.privateKey ??
			(typeof process !== "undefined" ? process.env?.W3S_PRIVATE_KEY : undefined);

		if (pk) {
			const { privateKeyToAccount } = await import("viem/accounts");
			account = privateKeyToAccount(pk as `0x${string}`);
		}
	}

	if (!account) return globalThis.fetch;

	const { toClientEvmSigner } = await import("@x402/evm");
	const { ExactEvmScheme } = await import("@x402/evm/exact/client");
	const { wrapFetchWithPayment, x402Client } = await import("@x402/fetch");
	const { createPublicClient, http } = await import("viem");
	const { baseSepolia } = await import("viem/chains");

	const publicClient = createPublicClient({ chain: baseSepolia, transport: http() });

	const client = new x402Client();
	client.register("eip155:*", new ExactEvmScheme(toClientEvmSigner(account, publicClient)));

	return wrapFetchWithPayment(globalThis.fetch, client);
}
