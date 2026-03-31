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

	const x402Fetch = wrapFetchWithPayment(fetch, client);

	// Wrap to handle FormData body re-send on 402 retry.
	// x402 wrapFetch does: first request (gets 402) → retry with payment header.
	// But FormData/stream bodies are consumed on the first attempt, so the retry
	// sends an empty body. Fix: intercept fetch to re-create FormData on each call.
	return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
		if (init?.body instanceof FormData) {
			const originalFormData = init.body;
			// Serialize all FormData entries so we can rebuild it on retry
			const entries: Array<[string, FormDataEntryValue]> = [];
			for (const [key, value] of originalFormData.entries()) {
				entries.push([key, value]);
			}

			// Override the underlying fetch to rebuild FormData each time
			const replayableFetch: typeof fetch = async (reqInput, reqInit) => {
				const freshForm = new FormData();
				for (const [key, value] of entries) {
					freshForm.append(key, value);
				}
				return fetch(reqInput, { ...reqInit, body: freshForm });
			};

			const replayableX402Fetch = wrapFetchWithPayment(replayableFetch, client);
			return replayableX402Fetch(input, { ...init, body: originalFormData });
		}
		return x402Fetch(input, init);
	};
}

/**
 * Returns the server base URL from config.
 */
export function getServerUrl(): string {
	return config.get("serverUrl") || "http://localhost:4000";
}
