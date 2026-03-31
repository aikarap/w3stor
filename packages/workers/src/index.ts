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
	loadSPProvidersConfig,
	uploadCarToAllProviders,
	verifyFilecoinFile,
} from "@w3stor/modules/filecoin";
import { fetchFromIPFS, unpinFile } from "@w3stor/modules/pinata";
import { enqueuePinataUnpin, getWorkerRedisConnection, setupRetrySchedule } from "@w3stor/modules/queue";
import type { FilecoinUploadJob, PinataUnpinJob, RetrievalVerifyJob, SPRetryCheckJob } from "@w3stor/shared";
import {
	config,
	logger,
	VerificationNetworkError,
	VerificationNotFoundError,
	VerificationValidationError,
	validateConfig,
} from "@w3stor/shared";
import { type Job, Worker } from "bullmq";
import { initializeIndexes } from "@w3stor/graph";
import { processSPRetryCheck } from "./sp-retry";

validateConfig();

initializeIndexes().catch((err) => {
	logger.warn("Neo4j index initialization failed", { error: err instanceof Error ? err.message : String(err) });
});

setupRetrySchedule().catch((err) => {
	logger.warn("Failed to setup SP retry schedule", {
		error: err instanceof Error ? err.message : String(err),
	});
});

async function processFilecoinUpload(job: Job<FilecoinUploadJob>): Promise<void> {
	const { cid, sizeBytes, pinataCid, filename } = job.data;

	logger.info("Starting Filecoin CAR upload", {
		jobId: job.id,
		cid,
		pinataCid,
		sizeBytes,
	});

	await updateFileStatus(cid, "uploading");

	// Create pending SP rows immediately so the UI can show assigned providers
	const redis = getWorkerRedisConnection();
	const spConfig = loadSPProvidersConfig();
	for (const provider of spConfig.providers) {
		await updateSPStatus({
			cid,
			spId: provider.name,
			status: "pending",
			url: provider.url,
		});
	}

	// Publish initial status so frontend sees providers right away
	await redis.publish(
		`file:${cid}:status`,
		JSON.stringify({
			cid,
			status: "uploading",
			confirmedSPs: 0,
			totalProviders: spConfig.providers.length,
			providers: spConfig.providers.map((p) => ({
				spId: p.name,
				status: "pending",
			})),
		}),
	);

	try {
		const fileData = await fetchFromIPFS(pinataCid);

		logger.info("Fetched file from IPFS gateway", {
			jobId: job.id,
			cid,
			pinataCid,
			fetchedBytes: fileData.length,
		});

		const filecoinClient = getClientFromEnv();
		let confirmedSPCount = 0;
		const { replicationMinProviders, replicationTotalProviders } = config.filecoin;

		const { succeeded, failed, totalProviders } = await uploadCarToAllProviders(
			filecoinClient,
			fileData,
			{
				filename: filename || `file-${cid}`,
				sizeBytes,
				waitForIPNI: true,
				// Set pieceCid on the file as soon as it's computed (before any SP upload)
				async onPieceCidComputed(pieceCid) {
					await updateFilePieceCid(cid, pieceCid);
					logger.info("PieceCID set early", { jobId: job.id, cid, pieceCid });
					await redis.publish(
						`file:${cid}:status`,
						JSON.stringify({ cid, status: "uploading", event: "piece-cid-computed", pieceCid }),
					);
				},
				onProgress: (stage, data) => {
					logger.info("Upload progress", { jobId: job.id, cid, stage, data });
				},
				// Called at each phase transition per provider — update DB + Redis in real-time
				async onProviderProgress({ configId, name, status: spStatus, txHash }) {
					await updateSPStatus({
						cid,
						spId: name,
						status: spStatus,
						txHash,
					});

					logger.info("SP progress", { jobId: job.id, cid, sp: name, status: spStatus, txHash });

					await redis.publish(
						`file:${cid}:status`,
						JSON.stringify({
							cid,
							status: "uploading",
							event: "provider-progress",
							provider: { spId: name, status: spStatus, txHash },
						}),
					);
				},
				// Called for each SP as it commits on-chain
				async onProviderCommit(result) {
					const sp = spConfig.providers.find((p) => p.id === result.configId);
					const spName = sp?.name ?? result.configId;
					confirmedSPCount++;

					await updateSPStatus({
						cid,
						spId: spName,
						status: "stored",
						url: result.provider.endpoint,
						verifiedAt: new Date(),
						pieceCid: result.pieceCid,
						txHash: result.txHash,
					});

					// Update file status incrementally as SPs confirm
					const fileStatus =
						confirmedSPCount >= replicationTotalProviders
							? "fully_replicated"
							: confirmedSPCount >= replicationMinProviders
								? "stored"
								: "uploading";
					await updateFileStatus(cid, fileStatus);

					logger.info("SP stored", {
						jobId: job.id,
						cid,
						sp: spName,
						confirmedSPs: confirmedSPCount,
						fileStatus,
						txHash: result.txHash,
					});

					await redis.publish(
						`file:${cid}:status`,
						JSON.stringify(
							{
								cid,
								status: fileStatus,
								event: "provider-committed",
								confirmedSPs: confirmedSPCount,
								totalProviders: spConfig.providers.length,
								provider: { spId: spName, status: "stored", txHash: result.txHash, pieceCid: result.pieceCid },
							},
							(_, v) => (typeof v === "bigint" ? v.toString() : v),
						),
					);
				},
				async onProviderFail(failure) {
					const sp = spConfig.providers.find((p) => p.id === failure.configId);
					const spName = sp?.name ?? failure.configId;

					await updateSPStatus({ cid, spId: spName, status: "failed" });

					await redis.publish(
						`file:${cid}:status`,
						JSON.stringify({
							cid,
							status: "uploading",
							event: "provider-failed",
							provider: { spId: spName, status: "failed", error: failure.error },
						}),
					);
				},
			},
		);

		// File status was already updated incrementally in onProviderCommit.
		// Handle edge case: all SPs failed (confirmedSPCount is still 0).
		if (confirmedSPCount === 0) {
			await updateFileStatus(cid, "failed");
			throw new Error(`All ${totalProviders} SP uploads failed`);
		}

		// Unpin from Pinata once we have enough confirmations
		if (confirmedSPCount >= replicationMinProviders) {
			const file = await findFileByCID(cid);
			if (file?.pinataPinId) {
				await enqueuePinataUnpin({ cid, pinataPinId: file.pinataPinId });
				logger.info("Pinata unpin job queued", { cid, confirmedSPs: confirmedSPCount });
			}
		}

		// Publish final completion notification via Redis pub/sub
		const finalStatus =
			confirmedSPCount >= replicationTotalProviders ? "fully_replicated"
				: confirmedSPCount >= replicationMinProviders ? "stored"
				: "partial";
		try {
			await redis.publish(
				`file:${cid}:status`,
				JSON.stringify(
					{
						cid,
						status: finalStatus,
						confirmedSPs: confirmedSPCount,
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
			confirmedSPs: confirmedSPCount,
			failedSPs: failed.length,
			finalStatus,
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

				case "sp-retry-check":
					await processSPRetryCheck(job as Job<SPRetryCheckJob>);
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
