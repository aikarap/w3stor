import {
	calculateBatchPrice,
	calculateOperationPrice,
	calculateUploadCost,
	getResourceServer,
} from "@w3stor/modules/x402";
import { config, logger } from "@w3stor/shared";
import { updateUserFilePayment } from "@w3stor/db";
import type { Context, Next } from "hono";
import { createMiddleware } from "hono/factory";

import type { HTTPAdapter, RouteConfig } from "@x402/core/server";
import { x402HTTPResourceServer } from "@x402/core/server";

let httpResourceServer: x402HTTPResourceServer | null = null;

/**
 * Get or create the x402HTTPResourceServer singleton with route pricing.
 */
async function getHTTPResourceServer(): Promise<x402HTTPResourceServer> {
	if (httpResourceServer) return httpResourceServer;

	const resourceServer = getResourceServer();
	const payTo = config.x402.evmPayToAddress ?? "";
	const network = "eip155:84532";

	const routes: Record<string, RouteConfig> = {
		"POST /upload": {
			accepts: {
				scheme: "exact",
				network,
				payTo,
				price: (ctx: { adapter: HTTPAdapter }) => {
					const contentLength = Number.parseInt(
						ctx.adapter.getHeader("content-length") ?? "0",
						10,
					);
					return calculateUploadCost(contentLength);
				},
			},
			description: "Upload a file to decentralized storage",
		},
		"POST /attest/:cid": {
			accepts: {
				scheme: "exact",
				network,
				payTo,
				price: calculateOperationPrice("attestation"),
			},
			description: "Attest a file on-chain",
		},
		"POST /workflows/execute": {
			accepts: {
				scheme: "exact",
				network,
				payTo,
				price: calculateOperationPrice("workflow-execute"),
			},
			description: "Execute a storage workflow",
		},
		"POST /graph/files": {
			accepts: {
				scheme: "exact",
				network,
				payTo,
				price: calculateOperationPrice("graph-add-file"),
			},
			description: "Add file to knowledge graph",
		},
		"POST /graph/connections": {
			accepts: {
				scheme: "exact",
				network,
				payTo,
				price: calculateOperationPrice("graph-connect"),
			},
			description: "Connect files in knowledge graph",
		},
		"POST /graph/agents": {
			accepts: {
				scheme: "exact",
				network,
				payTo,
				price: calculateOperationPrice("graph-connect"),
			},
			description: "Connect to another agent",
		},
		"POST /upload/batch": {
			accepts: {
				scheme: "exact",
				network,
				payTo,
				price: (ctx: { adapter: HTTPAdapter }) => {
					const fileCount = parseInt(ctx.adapter.getHeader("x-batch-files") ?? "1", 10);
					const sizeBytes = parseInt(ctx.adapter.getHeader("x-batch-size") ?? "0", 10);
					const connectionCount = parseInt(ctx.adapter.getHeader("x-batch-connections") ?? "0", 10);
					return calculateBatchPrice(fileCount, sizeBytes, connectionCount);
				},
			},
			description: "Batch file upload with graph integration",
		},
	};

	httpResourceServer = new x402HTTPResourceServer(resourceServer, routes);
	await httpResourceServer.initialize();
	logger.info("x402 HTTP resource server initialized with route pricing");
	return httpResourceServer;
}

/**
 * Create an HTTPAdapter from a Hono context.
 */
function createHonoAdapter(c: Context): HTTPAdapter {
	return {
		getHeader: (name: string) => c.req.header(name),
		getMethod: () => c.req.method,
		getPath: () => new URL(c.req.url).pathname,
		getUrl: () => c.req.url,
		getAcceptHeader: () => c.req.header("accept") ?? "",
		getUserAgent: () => c.req.header("user-agent") ?? "",
	};
}

/**
 * Extract payer wallet from x402 payment header.
 * Supports v2 (payment-signature) and v1 (x-payment) headers.
 */
export function extractPayer(req: {
	header: (name: string) => string | undefined;
}): string | undefined {
	try {
		const v2Header = req.header("payment-signature");
		const v1Header = req.header("x-payment");
		const raw = v2Header ?? v1Header;
		if (!raw) return undefined;

		const decoded = JSON.parse(Buffer.from(raw, "base64").toString("utf-8"));

		// EIP-3009 style
		if (decoded?.payload?.authorization?.from) {
			return decoded.payload.authorization.from.toLowerCase();
		}
		// Permit2 style
		if (decoded?.payload?.from) {
			return decoded.payload.from.toLowerCase();
		}

		return undefined;
	} catch {
		return undefined;
	}
}

/**
 * x402 payment middleware for Hono.
 * Checks if route requires payment, returns 402 if unpaid, verifies and settles if paid.
 * Sets `walletAddress` in Hono context on successful payment.
 */
export const x402PaymentMiddleware = createMiddleware(async (c: Context, next: Next) => {
	let server: x402HTTPResourceServer;
	try {
		server = await getHTTPResourceServer();
	} catch (err) {
		logger.error("x402 middleware: failed to get HTTP resource server", {
			error: err instanceof Error ? err.message : String(err),
			stack: err instanceof Error ? err.stack : undefined,
		});
		// x402 not configured — fall through without payment
		await next();
		return;
	}

	const adapter = createHonoAdapter(c);
	const requestContext = {
		adapter,
		path: new URL(c.req.url).pathname,
		method: c.req.method,
		paymentHeader: adapter.getHeader("payment-signature") ?? adapter.getHeader("x-payment"),
	};

	// Check if this route requires payment
	if (!server.requiresPayment(requestContext)) {
		await next();
		return;
	}

	// Process the payment
	const result = await server.processHTTPRequest(requestContext);

	if (result.type === "no-payment-required") {
		await next();
		return;
	}

	if (result.type === "payment-error") {
		// Return the 402 response with payment requirements headers
		const { status, headers: respHeaders, body, isHtml } = result.response;
		const headerInit: Record<string, string> = {};
		for (const [key, value] of Object.entries(respHeaders)) {
			headerInit[key] = String(value);
		}
		if (isHtml) {
			return new Response(body as string, {
				status,
				headers: { ...headerInit, "content-type": "text/html" },
			});
		}
		return new Response(JSON.stringify(body), {
			status,
			headers: { ...headerInit, "content-type": "application/json" },
		});
	}

	// Payment verified — extract wallet and set it in context
	const payer = extractPayer(c.req);
	if (payer) {
		c.set("walletAddress" as never, payer as never);
	}

	await next();

	// After handler completes, settle the payment
	try {
		const settleResult = await server.processSettlement(
			result.paymentPayload,
			result.paymentRequirements,
			result.declaredExtensions,
		);
		if (settleResult.success) {
			for (const [key, value] of Object.entries(settleResult.headers)) {
				c.res.headers.set(key, String(value));
			}
			logger.info("x402: Payment settled", { transaction: settleResult.transaction });

			// Persist payment tx to user_files if this was an upload
			const payer = c.get("walletAddress" as never) as string | undefined;
			const txHash = settleResult.transaction as string | undefined;
			if (payer && txHash) {
				try {
					const clonedRes = c.res.clone();
					const body = await clonedRes.json() as { cid?: string };
					if (body.cid) {
						await updateUserFilePayment({
							walletAddress: payer,
							cid: body.cid,
							paymentTxHash: txHash,
							paymentNetwork: "eip155:84532",
						});
					}
				} catch {
					// Non-upload routes or parse failure — skip
				}
			}
		} else {
			logger.warn("x402: Settlement failed", { reason: settleResult.errorReason });
		}
	} catch (error) {
		logger.error("x402: Settlement error", {
			error: error instanceof Error ? error.message : String(error),
		});
	}
});

/**
 * Build x402 route pricing configuration (legacy — for reference).
 */
export function buildX402RouteConfig() {
	return {
		"POST /upload": {
			price: (req: Request) => {
				const contentLength = Number.parseInt(req.headers.get("content-length") ?? "0", 10);
				return calculateUploadCost(contentLength);
			},
		},
		"POST /attest/:cid": {
			price: calculateOperationPrice("attestation"),
		},
		"POST /workflows/execute": {
			price: calculateOperationPrice("workflow-execute"),
		},
	};
}
