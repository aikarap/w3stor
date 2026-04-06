import type { FilecoinUploadJob, PinataUnpinJob } from "@w3stor/shared";
import { logger, QueueError } from "@w3stor/shared";
import { getFilecoinQueue } from "./client";

/**
 * Compute BullMQ priority from file size.
 * Lower number = higher priority. Small files process first so they
 * don't get stuck behind large uploads during spikes.
 */
function getUploadPriority(sizeBytes: number): number {
	if (sizeBytes < 10 * 1024 * 1024) return 1; // < 10 MB
	if (sizeBytes < 64 * 1024 * 1024) return 5; // 10–64 MB
	if (sizeBytes < 256 * 1024 * 1024) return 10; // 64–256 MB
	return 20; // > 256 MB
}

export async function enqueueFilecoinUpload(job: FilecoinUploadJob): Promise<string> {
	try {
		const queue = getFilecoinQueue();
		const priority = getUploadPriority(job.sizeBytes);

		const queuedJob = await queue.add("filecoin-upload", job, {
			jobId: `upload-${job.cid}`,
			priority,
		});

		logger.info("Filecoin upload job enqueued", {
			jobId: queuedJob.id,
			cid: job.cid,
			sizeBytes: job.sizeBytes,
			priority,
		});

		return queuedJob.id || "";
	} catch (error) {
		logger.error("Failed to enqueue Filecoin upload job", {
			cid: job.cid,
			error: error instanceof Error ? error.message : String(error),
		});
		throw new QueueError("Failed to enqueue upload job");
	}
}

/**
 * Enqueue a repair job for an under-replicated file.
 * Uses the same handler as fresh uploads but at lowest priority (100)
 * and with a separate jobId namespace to avoid conflicts.
 */
export async function enqueueRepairUpload(job: Omit<FilecoinUploadJob, "isRepair">): Promise<string | null> {
	try {
		const queue = getFilecoinQueue();

		const queuedJob = await queue.add(
			"filecoin-upload",
			{ ...job, isRepair: true },
			{
				jobId: `repair-${job.cid}`,
				priority: 100,
			},
		);

		return queuedJob.id || "";
	} catch (error) {
		// jobId conflict = already queued, not an error
		const msg = error instanceof Error ? error.message : String(error);
		if (msg.includes("duplicate") || msg.includes("exists")) {
			return null;
		}
		logger.warn("Failed to enqueue repair job", {
			cid: job.cid,
			error: msg,
		});
		return null;
	}
}

export async function enqueuePinataUnpin(job: PinataUnpinJob): Promise<string> {
	try {
		const queue = getFilecoinQueue();

		const queuedJob = await queue.add("pinata-unpin", job, {
			jobId: `unpin-${job.cid}`,
		});

		logger.info("Pinata unpin job enqueued", {
			jobId: queuedJob.id,
			cid: job.cid,
		});

		return queuedJob.id || "";
	} catch (error) {
		logger.error("Failed to enqueue Pinata unpin job", {
			cid: job.cid,
			error: error instanceof Error ? error.message : String(error),
		});
		throw new QueueError("Failed to enqueue unpin job");
	}
}
