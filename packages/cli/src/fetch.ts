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

	// Workaround for Bun bug: Request.clone() + fetch() returns 431 for bodies >1.5MB.
	// x402's wrapFetchWithPayment internally clones the Request for the retry, which
	// triggers this bug. Fix: intercept fetch to reconstruct the Request from buffered
	// body instead of relying on clone().
	let bufferedBody: ArrayBuffer | null = null;
	let bufferedHeaders: Record<string, string> | null = null;
	let bufferedUrl: string | null = null;
	let bufferedMethod: string | null = null;

	const safeFetch: typeof fetch = async (input: any, init?: any) => {
		if (input instanceof Request) {
			if (!bufferedBody && input.body && !input.bodyUsed) {
				// First call — buffer the body for potential retry
				bufferedUrl = input.url;
				bufferedMethod = input.method;
				bufferedHeaders = Object.fromEntries(input.headers.entries());
				const cloned = input.clone();
				bufferedBody = await cloned.arrayBuffer();
			}

			if (input.bodyUsed && bufferedBody) {
				// Retry — reconstruct instead of using clone
				return fetch(bufferedUrl!, {
					method: bufferedMethod!,
					headers: { ...bufferedHeaders!, ...Object.fromEntries(input.headers.entries()) },
					body: bufferedBody,
				});
			}
		}
		return fetch(input, init);
	};

	const x402Fetch = wrapFetchWithPayment(safeFetch, client);

	return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
		// Reset buffer state per top-level call
		bufferedBody = null;
		bufferedHeaders = null;
		bufferedUrl = null;
		bufferedMethod = null;
		return x402Fetch(input, init);
	};
}

/**
 * Returns the server base URL from config.
 */
export function getServerUrl(): string {
	return config.get("serverUrl") || "http://localhost:4000";
}
