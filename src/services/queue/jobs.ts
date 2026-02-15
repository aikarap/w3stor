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
