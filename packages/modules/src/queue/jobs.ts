import type { FilecoinUploadJob, PinataUnpinJob } from "@w3stor/shared";
import { logger, QueueError } from "@w3stor/shared";
import { getFilecoinQueue } from "./client";

export async function enqueueFilecoinUpload(job: FilecoinUploadJob): Promise<string> {
	try {
		const queue = getFilecoinQueue();

		const queuedJob = await queue.add("filecoin-upload", job, {
			jobId: `upload-${job.cid}`,
		});

		logger.info("Filecoin upload job enqueued", {
			jobId: queuedJob.id,
			cid: job.cid,
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

export async function setupRetrySchedule(): Promise<void> {
	try {
		const queue = getFilecoinQueue();

		// Remove any existing repeatable job with this name to avoid duplicates
		const existing = await queue.getRepeatableJobs();
		for (const job of existing) {
			if (job.name === "sp-retry-check") {
				await queue.removeRepeatableByKey(job.key);
			}
		}

		await queue.add(
			"sp-retry-check",
			{ triggeredBy: "schedule" },
			{
				repeat: { every: 2 * 60 * 60 * 1000 }, // every 2 hours
				jobId: "sp-retry-check-repeatable",
			},
		);

		logger.info("SP retry schedule registered (every 2 hours)");
	} catch (error) {
		logger.error("Failed to setup SP retry schedule", {
			error: error instanceof Error ? error.message : String(error),
		});
	}
}
