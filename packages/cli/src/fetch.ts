import { toClientEvmSigner } from "@x402/evm";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { wrapFetchWithPayment, x402Client } from "@x402/fetch";
import { createPublicClient, type Hex, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import { privateKeyFromConfig } from "./client.ts";
import config from "./config.ts";

/**
 * Creates a fetch function that automatically handles x402 payment challenges.
 * Uses the stored private key to sign payments on Base Sepolia.
 */
export function createPaymentFetch(): (
	input: RequestInfo | URL,
	init?: RequestInit,
) => Promise<Response> {
	const privateKey = privateKeyFromConfig();

	const account = privateKeyToAccount(privateKey as Hex);
	const publicClient = createPublicClient({
		chain: baseSepolia,
		transport: http(),
	});

	const client = new x402Client();
	client.register("eip155:*", new ExactEvmScheme(toClientEvmSigner(account, publicClient)));

	// x402 wrapFetchWithPayment converts input to a Request, which consumes
	// FormData/stream bodies. On the 402 retry, the body is empty (already read).
	// Fix: wrap the underlying fetch to capture and replay the body from the Request.
	let capturedBody: ArrayBuffer | null = null;
	let capturedContentType: string | null = null;

	const replayableFetch: typeof fetch = async (input, init) => {
		// x402 passes Request objects — extract body on first call, replay on retry
		if (input instanceof Request) {
			if (capturedBody === null && input.body) {
				capturedContentType = input.headers.get("content-type");
				capturedBody = await input.clone().arrayBuffer();
			}
			if (capturedBody && (!input.body || input.bodyUsed)) {
				// Body was consumed — rebuild the request with captured body
				const headers = new Headers(input.headers);
				if (capturedContentType) headers.set("content-type", capturedContentType);
				return fetch(new Request(input.url, {
					method: input.method,
					headers,
					body: capturedBody,
				}));
			}
		}
		return fetch(input, init);
	};

	const x402Fetch = wrapFetchWithPayment(replayableFetch, client);

	return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
		// Reset capture state for each top-level call
		capturedBody = null;
		capturedContentType = null;
		return x402Fetch(input, init);
	};
}

/**
 * Returns the server base URL from config.
 */
export function getServerUrl(): string {
	return config.get("serverUrl") || "http://localhost:4000";
}
