import { getStuckFiles } from "@w3stor/db";
import { getFilecoinQueue, enqueueFilecoinUpload } from "@w3stor/modules/queue";
import { logger } from "@w3stor/shared";
import { Hono } from "hono";

export const adminRoute = new Hono();

/**
 * POST /admin/retry-stuck
 *
 * Re-enqueue all files stuck in "uploading" or "failed" state back into the
 * BullMQ queue for Filecoin replication. Protected by ADMIN_SECRET header.
 *
 * Query params:
 *   ?status=uploading,failed   (comma-separated, default: uploading,failed)
 *   ?limit=50                  (max files to retry, default: 50)
 *   ?dry_run=true              (just list files, don't enqueue)
 */
adminRoute.post("/admin/retry-stuck", async (c) => {
	const adminSecret = process.env.ADMIN_SECRET;
	if (!adminSecret) {
		return c.json({ error: "ADMIN_SECRET not configured on server" }, 500);
	}

	const providedSecret = c.req.header("X-Admin-Secret") || c.req.header("Authorization")?.replace("Bearer ", "");
	if (providedSecret !== adminSecret) {
		return c.json({ error: "Unauthorized" }, 401);
	}

	const statusParam = c.req.query("status") || "uploading,failed,stored,partial";
	const statuses = statusParam.split(",").map((s) => s.trim());
	const limit = parseInt(c.req.query("limit") || "50", 10);
	const dryRun = c.req.query("dry_run") === "true";

	try {
		const fileList = await getStuckFiles(statuses, limit);

		if (dryRun) {
			return c.json({
				dryRun: true,
				count: fileList.length,
				statuses,
				files: fileList,
			});
		}

		const results: { cid: string; status: string; jobId?: string; error?: string }[] = [];

		for (const file of fileList) {
			if (!file.walletAddress) {
				results.push({ cid: file.cid, status: "skipped", error: "no wallet_address found" });
				continue;
			}

			try {
				// Remove old BullMQ job if it exists (completed/failed/stalled)
				// BullMQ deduplicates by jobId — old jobs block new ones with the same ID
				const queue = getFilecoinQueue();
				const oldJobId = `upload-${file.cid}`;
				const oldJob = await queue.getJob(oldJobId);
				if (oldJob) {
					await oldJob.remove().catch(() => {});
					logger.info("Admin: removed old BullMQ job", { cid: file.cid, oldJobId, oldState: await oldJob.getState().catch(() => "unknown") });
				}

				const jobId = await enqueueFilecoinUpload({
					cid: file.cid,
					sizeBytes: file.sizeBytes,
					walletAddress: file.walletAddress,
					pinataCid: file.cid,
					filename: file.filename || `file-${file.cid}`,
				});

				results.push({ cid: file.cid, status: "enqueued", jobId });

				logger.info("Admin: re-enqueued stuck file", {
					cid: file.cid,
					sizeBytes: file.sizeBytes,
					originalStatus: file.status,
					jobId,
				});
			} catch (error) {
				const errorMsg = error instanceof Error ? error.message : String(error);
				results.push({ cid: file.cid, status: "error", error: errorMsg });

				logger.error("Admin: failed to re-enqueue file", {
					cid: file.cid,
					error: errorMsg,
				});
			}
		}

		const enqueued = results.filter((r) => r.status === "enqueued").length;
		const skipped = results.filter((r) => r.status === "skipped").length;
		const errors = results.filter((r) => r.status === "error").length;

		logger.info("Admin: retry-stuck completed", { total: fileList.length, enqueued, skipped, errors });

		return c.json({ total: fileList.length, enqueued, skipped, errors, results });
	} catch (error) {
		logger.error("Admin: retry-stuck failed", {
			error: error instanceof Error ? error.message : String(error),
		});
		return c.json(
			{ error: error instanceof Error ? error.message : "Internal error" },
			500,
		);
	}
});
