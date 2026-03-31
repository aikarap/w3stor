import { toClientEvmSigner } from "@x402/evm";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { wrapFetchWithPayment, x402Client } from "@x402/fetch";
import { createPublicClient, type Hex, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import { privateKeyFromConfig } from "./client.ts";
import { API_URL } from "./config.ts";

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

	// Workaround for Bun.serve() bug: the second large request (>1.5MB body)
	// to the same Bun server returns HTTP 431. Since x402 does two fetches
	// (first gets 402, second retries with payment), large uploads always fail.
	//
	// Fix: for large POST bodies (>1MB), use curl subprocess for the initial
	// 402 challenge request, then let x402 sign against that response, and
	// use curl again for the final payment request. This avoids Bun's fetch()
	// entirely for large bodies.
	const x402Fetch = wrapFetchWithPayment(fetch, client);

	return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
		const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : (input as Request).url;
		const method = init?.method ?? (input instanceof Request ? input.method : "GET");

		// Only apply workaround for large POST bodies
		if (method === "POST" && init?.body instanceof FormData) {
			// Serialize FormData to a temp file to send via curl
			const tempReq = new Request("http://x", { method: "POST", body: init.body });
			const realContentType = tempReq.headers.get("content-type") ?? "";
			const realBody = Buffer.from(await tempReq.arrayBuffer());

			// Skip workaround for small bodies (<1.5MB)
			if (realBody.byteLength < 1.5 * 1024 * 1024) {
				return x402Fetch(input, init);
			}

			const x402FetchModule = await import("@x402/fetch");
			const x402HTTPClient = (x402FetchModule as any).x402HTTPClient ?? (x402FetchModule as any).default?.x402HTTPClient;
			const httpClient = new x402HTTPClient(client);

			// Step 1: Get 402 challenge via curl (bypasses Bun's HTTP client)
			const { writeFileSync, unlinkSync } = await import("node:fs");
			const tmpFile = `/tmp/w3stor-upload-${Date.now()}.bin`;
			writeFileSync(tmpFile, realBody);

			const { spawnSync } = await import("node:child_process");
			const curlProbe = spawnSync("curl", [
				"-s", "-D", "-", "-o", "/dev/null",
				"-X", "POST",
				"-H", `Content-Type: ${realContentType}`,
				"--data-binary", `@${tmpFile}`,
				url,
			]);
			const probeOutput = curlProbe.stdout.toString();
			const paymentRequiredMatch = probeOutput.match(/payment-required:\s*(.+)/i);

			if (!paymentRequiredMatch) {
				// No 402 challenge — try sending directly
				const curlDirect = spawnSync("curl", [
					"-s",
					"-X", "POST",
					"-H", `Content-Type: ${realContentType}`,
					"--data-binary", `@${tmpFile}`,
					url,
				]);
				unlinkSync(tmpFile);
				return new Response(curlDirect.stdout.toString(), { status: 200 });
			}

			// Step 2: Parse 402 and sign payment
			const paymentRequiredHeader = paymentRequiredMatch[1].trim();
			const payReq = httpClient.getPaymentRequiredResponse(
				(name: string) => name.toLowerCase() === "payment-required" ? paymentRequiredHeader : null,
			);
			const payPayload = await (client as any).createPaymentPayload(payReq);
			const payHeaders = httpClient.encodePaymentSignatureHeader(payPayload);

			// Step 3: Send real request via curl with payment header
			const curlArgs = [
				"curl", "-s", "-w", "\n%{http_code}",
				"-X", "POST",
				"-H", `Content-Type: ${realContentType}`,
			];
			for (const [k, v] of Object.entries(payHeaders)) {
				curlArgs.push("-H", `${k}: ${v}`);
			}
			if (init.headers) {
				for (const [k, v] of new Headers(init.headers as HeadersInit).entries()) {
					if (k !== "content-type") curlArgs.push("-H", `${k}: ${v}`);
				}
			}
			curlArgs.push("--data-binary", `@${tmpFile}`, url);

			const curlResult = spawnSync(curlArgs[0], curlArgs.slice(1));
			unlinkSync(tmpFile);

			const output = curlResult.stdout.toString();
			const lastNewline = output.lastIndexOf("\n");
			const statusCode = parseInt(output.slice(lastNewline + 1), 10) || 200;
			const body = output.slice(0, lastNewline);

			return new Response(body, {
				status: statusCode,
				headers: { "content-type": "application/json" },
			});
		}

		return x402Fetch(input, init);
	};
}

/**
 * Returns the server base URL (hardcoded to production).
 */
export function getServerUrl(): string {
	return API_URL;
}
