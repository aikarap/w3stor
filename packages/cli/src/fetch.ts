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

	// x402 wrapFetchWithPayment converts input to a Request internally,
	// which consumes the FormData body stream. On the 402→retry cycle,
	// the second fetch sends an empty body because the stream was already read.
	// Fix: intercept every fetch call. On first call, clone the Request and
	// buffer the body. On subsequent calls (retry), rebuild from buffer.
	let bodyBuffer: ArrayBuffer | null = null;
	let bodyContentType: string | null = null;
	let fetchCallCount = 0;

	const replayableFetch: typeof fetch = async (input: any, init?: any) => {
		fetchCallCount++;
		const req: Request = input instanceof Request ? input : new Request(input, init);

		if (fetchCallCount === 1) {
			// First call — clone before x402 consumes the body
			const cloned = req.clone();
			bodyContentType = cloned.headers.get("content-type");
			bodyBuffer = await cloned.arrayBuffer();
			return fetch(req);
		}

		// Retry — body is consumed, rebuild from buffer
		if (bodyBuffer) {
			const headers = new Headers(req.headers);
			if (bodyContentType) headers.set("content-type", bodyContentType);
			const freshReq = new Request(req.url, {
				method: req.method,
				headers,
				body: bodyBuffer,
			});
			return fetch(freshReq);
		}

		return fetch(req);
	};

	const x402Fetch = wrapFetchWithPayment(replayableFetch, client);

	return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
		bodyBuffer = null;
		bodyContentType = null;
		fetchCallCount = 0;
		return x402Fetch(input, init);
	};
}

/**
 * Returns the server base URL from config.
 */
export function getServerUrl(): string {
	return config.get("serverUrl") || "http://localhost:4000";
}
