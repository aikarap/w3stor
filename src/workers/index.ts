import {
	findFileByCID,
	getSPStatuses,
	updateFilePieceCid,
	updateFileStatus,
	updatePinataStatus,
	updateSPStatus,
} from "@w3stor/db";
import {
	getClientFromEnv,
	uploadCarToAllProviders,
	verifyFilecoinFile,
} from "@w3stor/modules/filecoin";
import { fetchFromIPFS, unpinFile } from "@w3stor/modules/pinata";
import { enqueuePinataUnpin, getWorkerRedisConnection } from "@w3stor/modules/queue";
import type { FilecoinUploadJob, PinataUnpinJob, RetrievalVerifyJob } from "@w3stor/shared";
import {
	config,
	logger,
	VerificationNetworkError,
	VerificationNotFoundError,
	VerificationValidationError,
	validateConfig,
} from "@w3stor/shared";
import { type Job, Worker } from "bullmq";

validateConfig();

async function processFilecoinUpload(job: Job<FilecoinUploadJob>): Promise<void> {
	const { cid, sizeBytes, pinataCid, filename } = job.data;

	logger.info("Starting Filecoin CAR upload", {
		jobId: job.id,
		cid,
		pinataCid,
		sizeBytes,
	});

	await updateFileStatus(cid, "uploading");

	try {
		const fileData = await fetchFromIPFS(pinataCid);

		logger.info("Fetched file from IPFS gateway", {
			jobId: job.id,
			cid,
			pinataCid,
			fetchedBytes: fileData.length,
		});

		const filecoinClient = getClientFromEnv();

		const { succeeded, failed, totalProviders } = await uploadCarToAllProviders(
			filecoinClient,
			fileData,
			{
				filename: filename || `file-${cid}`,
				sizeBytes,
				waitForIPNI: true,
				onProgress: (stage, data) => {
					logger.info("Upload progress", { jobId: job.id, cid, stage, data });
				},
			},
		);

		// Update piece_cid on the file from the first successful upload
		if (succeeded.length > 0 && succeeded[0].pieceCid) {
			await updateFilePieceCid(cid, succeeded[0].pieceCid);
		}

		for (const result of succeeded) {
			const spId = result.configId || `sp-${result.provider.id}`;

			await updateSPStatus({
				cid,
				spId,
				status: "stored",
				url: result.provider.endpoint,
				verifiedAt: new Date(),
				pieceCid: result.pieceCid,
			});

			logger.info("SP upload completed", {
				jobId: job.id,
				cid,
				spId,
				pieceCid: result.pieceCid,
				providerId: result.provider.id,
				ipfsRootCid: result.ipfsRootCid,
			});
		}

		for (const failure of failed) {
			await updateSPStatus({ cid, spId: failure.configId, status: "failed" });
		}

		const confirmedSPs = succeeded.length;
		const { replicationMinProviders, replicationTotalProviders } = config.filecoin;

		if (confirmedSPs >= replicationMinProviders) {
			await updateFileStatus(
				cid,
				confirmedSPs >= replicationTotalProviders ? "fully_replicated" : "stored",
			);

			const file = await findFileByCID(cid);
			if (file?.pinataPinId) {
				await enqueuePinataUnpin({
					cid,
					pinataPinId: file.pinataPinId,
				});

				logger.info("Pinata unpin job queued after SP confirmations met threshold", {
					cid,
					confirmedSPs,
					requiredMin: replicationMinProviders,
				});
			}
		} else if (confirmedSPs >= 1) {
			logger.warn("Only partial SP confirmation - keeping Pinata pin active", {
				cid,
				confirmedSPs,
				requiredMin: replicationMinProviders,
				failedProviders: failed.map((f) => f.configId),
			});
			await updateFileStatus(cid, "stored");
		} else {
			logger.error("All SP uploads failed", {
				jobId: job.id,
				cid,
				failures: failed,
			});
			await updateFileStatus(cid, "failed");
			throw new Error(`All ${totalProviders} SP uploads failed`);
		}

		// Publish completion notification via Redis pub/sub
		try {
			const redis = getWorkerRedisConnection();
			await redis.publish(
				`file:${cid}:status`,
				JSON.stringify(
					{
						cid,
						status:
							confirmedSPs >= replicationTotalProviders
								? "fully_replicated"
								: confirmedSPs >= replicationMinProviders
									? "stored"
									: "partial",
						confirmedSPs,
						totalProviders,
						failedProviders: failed.map((f) => f.configId),
					},
					(_, v) => (typeof v === "bigint" ? v.toString() : v),
				),
			);
		} catch (pubError) {
			logger.warn("Failed to publish status notification", {
				cid,
				error: pubError instanceof Error ? pubError.message : String(pubError),
			});
		}

		logger.info("Filecoin upload completed", {
			jobId: job.id,
			cid,
			confirmedSPs,
			failedSPs: failed.length,
			providers: succeeded.map((r) => r.configId || r.provider.id),
		});
	} catch (error) {
		logger.error("Filecoin upload failed", {
			jobId: job.id,
			cid,
			error: error instanceof Error ? error.message : String(error),
		});

		await updateFileStatus(cid, "failed");
		throw error;
	}
}

// TODO: This handler works correctly but is unreachable — jobs.ts never enqueues 'retrieval-verify' jobs.
// Wire up the enqueue path when SP deal verification is ready.
async function processRetrievalVerify(job: Job<RetrievalVerifyJob>): Promise<void> {
	const { cid, spId, spUrl } = job.data;

	logger.info("Processing retrieval verify job", {
		jobId: job.id,
		cid,
		spId,
	});

	try {
		const spStatuses = await getSPStatuses(cid);
		const spEntry = spStatuses.find((s) => s.spId === spId);

		if (!spEntry?.pieceCid) {
			logger.warn("No piece CID found for SP verification", {
				cid,
				spId,
			});
			return;
		}

		const pieceCid = spEntry.pieceCid;

		const providerAddress = spUrl as `0x${string}`;

		try {
			const verifyResult = await verifyFilecoinFile(pieceCid, spUrl, providerAddress);

			if (verifyResult.verified && verifyResult.exists) {
				await updateSPStatus({
					cid,
					spId,
					status: "verified",
					verifiedAt: new Date(),
				});

				logger.info("SP verification successful", {
					jobId: job.id,
					cid,
					spId,
					pieceCid,
					verified: true,
				});
			}
		} catch (error) {
			if (error instanceof VerificationNetworkError) {
				logger.warn("SP verification network error - will retry", {
					jobId: job.id,
					cid,
					spId,
					error: error.message,
				});
				throw error;
			} else if (error instanceof VerificationNotFoundError) {
				logger.warn("SP verification - piece not found", {
					jobId: job.id,
					cid,
					spId,
					pieceCid,
				});
				await updateSPStatus({
					cid,
					spId,
					status: "failed",
				});
			} else if (error instanceof VerificationValidationError) {
				logger.error("SP verification - validation error", {
					jobId: job.id,
					cid,
					spId,
					error: error.message,
				});
				await updateSPStatus({
					cid,
					spId,
					status: "failed",
				});
				throw error;
			} else {
				throw error;
			}
		}
	} catch (error) {
		logger.error("Retrieval verification error", {
			jobId: job.id,
			cid,
			spId,
			error: error instanceof Error ? error.message : String(error),
		});
		throw error;
	}
}

async function processPinataUnpin(job: Job<PinataUnpinJob>): Promise<void> {
	const { cid } = job.data;

	logger.info("Processing Pinata unpin job", {
		jobId: job.id,
		cid,
	});

	try {
		await unpinFile(cid);
		await updatePinataStatus(cid, false);

		logger.info("File unpinned from Pinata", {
			jobId: job.id,
			cid,
		});
	} catch (error) {
		logger.error("Pinata unpin failed", {
			jobId: job.id,
			cid,
			error: error instanceof Error ? error.message : String(error),
		});
		throw error;
	}
}

const connection = getWorkerRedisConnection();

const worker = new Worker(
	"filecoin-operations",
	async (job: Job) => {
		try {
			switch (job.name) {
				case "filecoin-upload":
					await processFilecoinUpload(job as Job<FilecoinUploadJob>);
					break;

				case "retrieval-verify":
					await processRetrievalVerify(job as Job<RetrievalVerifyJob>);
					break;

				case "pinata-unpin":
					await processPinataUnpin(job as Job<PinataUnpinJob>);
					break;

				default:
					logger.warn("Unknown job type", { jobType: job.name });
			}
		} catch (error) {
			logger.error("Job processing failed", {
				jobId: job.id,
				jobType: job.name,
				error: error instanceof Error ? error.message : String(error),
			});
			throw error;
		}
	},
	{
		connection: connection.options,
		concurrency: config.worker.concurrency,
		limiter: {
			max: config.worker.rateLimitMax,
			duration: config.worker.rateLimitDuration,
		},
	},
);

worker.on("completed", (job) => {
	logger.info("Job completed successfully", {
		jobId: job.id,
		jobType: job.name,
	});
});

worker.on("failed", (job, error) => {
	logger.error("Job failed", {
		jobId: job?.id,
		jobType: job?.name,
		error: error.message,
	});
});

logger.info("Worker started", {
	queue: "filecoin-operations",
	concurrency: config.worker.concurrency,
	env: config.env,
});

async function shutdownWorker(signal: string): Promise<void> {
	logger.info(`${signal} received, shutting down worker`);
	const timeout = setTimeout(() => {
		logger.warn("Worker shutdown timed out, forcing exit");
		process.exit(1);
	}, config.worker.shutdownTimeout);
	await worker.close();
	clearTimeout(timeout);
	process.exit(0);
}

process.on("SIGTERM", () => shutdownWorker("SIGTERM"));
process.on("SIGINT", () => shutdownWorker("SIGINT"));

