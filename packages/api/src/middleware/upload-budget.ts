import { logger } from "@w3stor/shared";
import type { Context, Next } from "hono";

/**
 * In-process upload memory budget.
 *
 * Tracks total bytes being buffered by concurrent upload handlers.
 * Uses Content-Length to pre-check BEFORE formData() reads the body.
 * When budget is exhausted, returns 503 + Retry-After instead of OOMing.
 *
 * With API at 3GB: ~2.5GB budget leaves ~500MB for Bun runtime,
 * connection pools, SSE streams, and other routes.
 */

const MAX_UPLOAD_BUDGET_BYTES = parseInt(
	process.env.UPLOAD_BUDGET_BYTES || String(2.5 * 1024 * 1024 * 1024),
	10,
);

const MAX_SINGLE_UPLOAD_BYTES = parseInt(
	process.env.UPLOAD_MAX_BODY_BYTES || String(512 * 1024 * 1024),
	10,
);

let activeBytes = 0;

export function getActiveUploadBytes(): number {
	return activeBytes;
}

export async function uploadBudgetMiddleware(c: Context, next: Next): Promise<Response | void> {
	const contentLength = parseInt(c.req.header("content-length") || "0", 10);

	if (contentLength > MAX_SINGLE_UPLOAD_BYTES) {
		logger.warn("Upload rejected: body too large", { contentLength, max: MAX_SINGLE_UPLOAD_BYTES });
		return c.json(
			{ error: "Request body too large", maxBytes: MAX_SINGLE_UPLOAD_BYTES, yourBytes: contentLength },
			413,
		);
	}

	if (contentLength > 0 && activeBytes + contentLength > MAX_UPLOAD_BUDGET_BYTES) {
		logger.warn("Upload rejected: memory budget full", { activeBytes, contentLength, budget: MAX_UPLOAD_BUDGET_BYTES });
		c.header("Retry-After", "10");
		return c.json({ error: "Server busy processing uploads, please retry", retryAfter: 10 }, 503);
	}

	activeBytes += contentLength;

	try {
		await next();
	} finally {
		activeBytes -= contentLength;
		if (activeBytes < 0) activeBytes = 0;
	}
}
