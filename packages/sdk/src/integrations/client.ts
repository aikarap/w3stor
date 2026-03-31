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

/**
 * Manages SIWE (Sign-In With Ethereum) authentication for the W3Stor API.
 * Caches the JWT token in memory and handles re-authentication when needed.
 */
export class SiweAuthManager {
	private apiUrl: string;
	private sign: (message: string) => Promise<string>;
	private address: string;
	private token: string | null = null;
	private tokenExpiry: number | null = null;

	constructor(apiUrl: string, address: string, sign: (message: string) => Promise<string>) {
		this.apiUrl = apiUrl;
		this.address = address;
		this.sign = sign;
	}

	async authenticate(): Promise<void> {
		// Fetch nonce
		const nonceRes = await globalThis.fetch(`${this.apiUrl}/auth/siwe/nonce`);
		if (!nonceRes.ok) {
			const body = await nonceRes.text().catch(() => "");
			throw new Error(`w3stor SIWE nonce failed (${nonceRes.status}): ${body}`);
		}
		const { nonce } = await nonceRes.json();

		// Build SIWE message
		const domain = new URL(this.apiUrl).hostname;
		const issuedAt = new Date().toISOString();
		const message = `${domain} wants you to sign in with your Ethereum account:\n${this.address}\n\nSign in to W3Stor\n\nURI: https://${domain}\nVersion: 1\nChain ID: 84532\nNonce: ${nonce}\nIssued At: ${issuedAt}`;

		// Sign message
		const signature = await this.sign(message);

		// Verify and receive JWT
		const verifyRes = await globalThis.fetch(`${this.apiUrl}/auth/siwe/verify`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ message, signature }),
		});
		if (!verifyRes.ok) {
			const body = await verifyRes.text().catch(() => "");
			throw new Error(`w3stor SIWE verify failed (${verifyRes.status}): ${body}`);
		}
		const { token, expiresIn } = await verifyRes.json();
		this.token = token;
		// Default to 1 hour if expiresIn not provided; store as ms timestamp
		this.tokenExpiry = Date.now() + (expiresIn ? expiresIn * 1000 : 3600 * 1000);
	}

	async getAuthHeaders(): Promise<{ Authorization: string }> {
		if (!this.token || !this.tokenExpiry || Date.now() >= this.tokenExpiry) {
			await this.authenticate();
		}
		return { Authorization: `Bearer ${this.token}` };
	}

	async refresh(): Promise<void> {
		this.token = null;
		this.tokenExpiry = null;
		await this.authenticate();
	}
}

/**
 * Creates a SiweAuthManager from a W3StorConfig.
 * Resolves the account from config.account or config.privateKey / W3S_PRIVATE_KEY env var.
 */
export async function createSiweAuth(config?: W3StorConfig): Promise<SiweAuthManager> {
	const apiUrl = getApiUrl(config);

	let account = config?.account as
		| { address: string; signMessage: (params: { message: string }) => Promise<string> }
		| undefined;

	if (!account) {
		const pk =
			config?.privateKey ??
			(typeof process !== "undefined" ? process.env?.W3S_PRIVATE_KEY : undefined);

		if (pk) {
			const { privateKeyToAccount } = await import("viem/accounts");
			account = privateKeyToAccount(pk as `0x${string}`) as unknown as {
				address: string;
				signMessage: (params: { message: string }) => Promise<string>;
			};
		}
	}

	if (!account) {
		throw new Error("w3stor SIWE auth requires an account (privateKey or account in config)");
	}

	const sign = (message: string) => account!.signMessage({ message });
	return new SiweAuthManager(apiUrl, account.address, sign);
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
