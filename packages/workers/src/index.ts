import {
	ensurePendingSPRows,
	findFileByCID,
	getConfirmedSPCount,
	getRepairableFiles,
	getSPStatuses,
	resetStaleSPStatuses,
	updateFilePieceCid,
	updateFileStatus,
	updatePinataStatus,
	updateSPStatus,
} from "@w3stor/db";
import {
	getClientFromEnv,
	loadSPProvidersConfig,
	uploadCarToAllProviders,
	uploadCarFromStreamToAllProviders,
} from "@w3stor/modules/filecoin";
import { verifyTransactionOnChain, retryFailedSPs } from "@w3stor/modules/filecoin/sp-retry-utils";
import type { SPProviderConfig } from "@w3stor/modules/filecoin";
import { fetchFromIPFS, fetchFromIPFSStream, unpinFile } from "@w3stor/modules/pinata";
import { enqueuePinataUnpin, enqueueRepairUpload, getWorkerRedisConnection, getFilecoinQueue } from "@w3stor/modules/queue";
import type { FilecoinUploadJob, PinataUnpinJob } from "@w3stor/shared";
import { config, logger, validateConfig } from "@w3stor/shared";
import { type Job, Worker } from "bullmq";
import { initializeIndexes } from "@w3stor/graph";

validateConfig();

initializeIndexes().catch((err) => {
	logger.warn("Neo4j index initialization failed", { error: err instanceof Error ? err.message : String(err) });
});

// ============================================================================
// Active bytes tracking for size-aware autoscaling
// ============================================================================
const ACTIVE_BYTES_KEY = "w3stor:worker:active-bytes";

async function trackActiveBytes(delta: number): Promise<void> {
	try {
		const redis = getWorkerRedisConnection();
		const newVal = await redis.incrby(ACTIVE_BYTES_KEY, delta);
		if (newVal < 0) await redis.set(ACTIVE_BYTES_KEY, "0");
		await redis.expire(ACTIVE_BYTES_KEY, 120);
	} catch {
		// Non-critical — autoscaler will just use queue depth
	}
}

async function resetActiveBytes(): Promise<void> {
	try {
		const redis = getWorkerRedisConnection();
		await redis.set(ACTIVE_BYTES_KEY, "0");
	} catch { /* Non-critical */ }
}

// ============================================================================
// Repair concurrency semaphore
// ============================================================================
const REPAIR_SEMAPHORE_KEY = "w3stor:repair:active-count";
const MAX_PARALLEL_REPAIRS = 2;
const REPAIR_SEMAPHORE_TTL = 600; // 10min — auto-clears if all workers crash

async function acquireRepairSlot(): Promise<boolean> {
	const redis = getWorkerRedisConnection();
	const count = await redis.incr(REPAIR_SEMAPHORE_KEY);
	await redis.expire(REPAIR_SEMAPHORE_KEY, REPAIR_SEMAPHORE_TTL);
	if (count > MAX_PARALLEL_REPAIRS) {
		await redis.decr(REPAIR_SEMAPHORE_KEY);
		return false;
	}
	return true;
}

async function releaseRepairSlot(): Promise<void> {
	try {
		const redis = getWorkerRedisConnection();
		const val = await redis.decr(REPAIR_SEMAPHORE_KEY);
		if (val < 0) await redis.set(REPAIR_SEMAPHORE_KEY, "0");
	} catch { /* Non-critical */ }
}

// ============================================================================
// Unified file replication handler
// ============================================================================

const STREAM_THRESHOLD = 64 * 1024 * 1024; // 64MB

async function processFilecoinUpload(job: Job<FilecoinUploadJob>): Promise<void> {
	const { cid, sizeBytes, pinataCid, filename, isRepair } = job.data;

	// --- Repair concurrency gate ---
	let acquiredSlot = false;
	if (isRepair) {
		const got = await acquireRepairSlot();
		if (!got) {
			throw new Error("Repair concurrency limit reached, will retry");
		}
		acquiredSlot = true;
	}

	await trackActiveBytes(sizeBytes);

	logger.info("Starting file replication", {
		jobId: job.id, cid, pinataCid, sizeBytes,
		isRepair: !!isRepair, attempt: job.attemptsMade,
	});

	const redis = getWorkerRedisConnection();
	const spConfig = loadSPProvidersConfig();
	const filecoinClient = getClientFromEnv();
	const { replicationMinProviders, replicationTotalProviders } = config.filecoin;

	try {
		// Create pending SP rows only if they don't exist — never overwrite progress
		await ensurePendingSPRows(
			cid,
			spConfig.providers.map((p) => ({ name: p.name, url: p.url })),
		);

		await updateFileStatus(cid, "uploading");

		// Publish initial status so frontend sees providers right away (skip for repairs)
		if (!isRepair) {
			const initialStatuses = await getSPStatuses(cid);
			await publishSSE(redis, `file:${cid}:status`, {
				cid, status: "uploading",
				confirmedSPs: 0,
				totalProviders: spConfig.providers.length,
				providers: initialStatuses.map((s) => ({ spId: s.spId, status: s.status })),
			});
		}

		// ==================================================================
		// Phase 0: On-chain tx verification (free, idempotent)
		// ==================================================================
		const spStatuses = await getSPStatuses(cid);
		for (const sp of spStatuses) {
			if (sp.txHash && ["failed", "tx_submitted"].includes(sp.status)) {
				logger.info("Verifying existing tx on-chain", { jobId: job.id, cid, spId: sp.spId, txHash: sp.txHash });
				const txSuccess = await verifyTransactionOnChain(sp.txHash);
				if (txSuccess) {
					await updateSPStatus({
						cid, spId: sp.spId, status: "stored",
						verifiedAt: new Date(), txHash: sp.txHash,
					});
					logger.info("SP tx verified on-chain — recovered without re-upload", {
						jobId: job.id, cid, spId: sp.spId, txHash: sp.txHash,
					});
				}
			}
		}

		// Re-read from DB after Phase 0 updates (fixes stale-read bug)
		let confirmedCount = await getConfirmedSPCount(cid);

		if (confirmedCount >= replicationTotalProviders) {
			await updateFileStatus(cid, "fully_replicated");
			if (!isRepair) await publishFinalStatus(redis, cid, confirmedCount, spConfig.providers.length, []);
			logger.info("File already fully replicated after tx verification", { jobId: job.id, cid, confirmedSPs: confirmedCount });
			return;
		}

		// ==================================================================
		// Phase 1: Smart routing — pick cheapest strategy
		// ==================================================================
		const currentStatuses = await getSPStatuses(cid);
		const confirmedSP = currentStatuses.find((s) =>
			["stored", "verified", "tx_confirmed", "piece_parked"].includes(s.status),
		);
		const needsWork = currentStatuses.filter((s) =>
			["failed", "pending", "committing", "tx_submitted"].includes(s.status),
		);

		if (needsWork.length === 0) {
			logger.info("No SPs need work", { jobId: job.id, cid, confirmedCount });
			// Still finalize in case file status is stale
		} else {
			const existingFile = await findFileByCID(cid);
			const hasPieceCid = !!existingFile?.pieceCid;

			if (confirmedSP && hasPieceCid) {
				// --- Route A: SP-to-SP pull for remaining SPs ---
				await doSPtoSPPull(job, cid, existingFile.pieceCid!, sizeBytes,
					confirmedSP, needsWork, spConfig, filecoinClient, redis, isRepair);
			} else {
				// --- Route B: Full upload pipeline ---
				await doFullUpload(job, cid, pinataCid, sizeBytes, filename,
					spConfig, filecoinClient, redis, isRepair);
			}
		}

		// ==================================================================
		// Phase 2: Finalize from DB (atomic — no in-memory counter)
		// ==================================================================
		confirmedCount = await getConfirmedSPCount(cid);

		const finalStatus =
			confirmedCount >= replicationTotalProviders ? "fully_replicated"
				: confirmedCount >= replicationMinProviders ? "stored"
				: confirmedCount > 0 ? "partial"
				: "failed";
		await updateFileStatus(cid, finalStatus);

		// Unpin from Pinata once we have enough confirmations
		if (confirmedCount >= replicationMinProviders) {
			const file = await findFileByCID(cid);
			if (file?.pinataPinId && file.pinataPinned) {
				await enqueuePinataUnpin({ cid, pinataPinId: file.pinataPinId });
				logger.info("Pinata unpin job queued", { cid, confirmedSPs: confirmedCount });
			}
		}

		// Publish final SSE event (skip for repairs)
		if (!isRepair) {
			const finalStatuses = await getSPStatuses(cid);
			const failedIds = finalStatuses.filter((s) => s.status === "failed").map((s) => s.spId);
			await publishFinalStatus(redis, cid, confirmedCount, spConfig.providers.length, failedIds);
		}

		logger.info("File replication completed", {
			jobId: job.id, cid, confirmedSPs: confirmedCount,
			finalStatus, isRepair: !!isRepair, attempt: job.attemptsMade,
		});

		if (confirmedCount === 0) {
			throw new Error(`All SP uploads failed for ${cid}`);
		}
	} catch (error) {
		logger.error("File replication failed", {
			jobId: job.id, cid, isRepair: !!isRepair,
			error: error instanceof Error ? error.message : String(error),
			attempt: job.attemptsMade,
		});
		await updateFileStatus(cid, "failed").catch(() => {});
		throw error;
	} finally {
		await trackActiveBytes(-sizeBytes);
		if (acquiredSlot) await releaseRepairSlot();
	}
}

// ============================================================================
// Route A: SP-to-SP pull for remaining SPs
// ============================================================================

async function doSPtoSPPull(
	job: Job<FilecoinUploadJob>,
	cid: string,
	pieceCid: string,
	sizeBytes: number,
	confirmedSP: { spId: string },
	needsWork: { spId: string }[],
	spConfig: ReturnType<typeof loadSPProvidersConfig>,
	filecoinClient: ReturnType<typeof getClientFromEnv>,
	redis: ReturnType<typeof getWorkerRedisConnection>,
	isRepair?: boolean,
): Promise<void> {
	const confirmedProviderConfig = spConfig.providers.find((p) => p.name === confirmedSP.spId);
	if (!confirmedProviderConfig) {
		throw new Error(`No provider config found for confirmed SP ${confirmedSP.spId}`);
	}

	const failedProviders = needsWork
		.map((s) => spConfig.providers.find((p) => p.name === s.spId))
		.filter((p): p is SPProviderConfig => p != null);

	if (failedProviders.length === 0) return;

	logger.info("Route A: SP-to-SP pull", {
		jobId: job.id, cid, sourceSP: confirmedSP.spId,
		targetSPs: failedProviders.map((p) => p.name),
	});

	const retryResults = await retryFailedSPs(filecoinClient, {
		cid, pieceCid, sizeBytes,
		confirmedProvider: confirmedProviderConfig,
		failedProviders,
		async onSPProgress(spId, status, txHash) {
			await updateSPStatus({ cid, spId, status, txHash });
			if (!isRepair) {
				await publishSSE(redis, `file:${cid}:status`, {
					cid, status: "uploading",
					event: "provider-progress",
					provider: { spId, status, txHash },
				});
			}
		},
	});

	for (const result of retryResults) {
		if (result.success) {
			await updateSPStatus({
				cid, spId: result.spId, status: "stored",
				verifiedAt: new Date(), txHash: result.txHash,
			});
			logger.info("SP pull succeeded", { jobId: job.id, cid, spId: result.spId, txHash: result.txHash });
		} else if (result.txHash) {
			// TX submitted but unconfirmed — Phase 0 will verify it on next run
			await updateSPStatus({ cid, spId: result.spId, status: "tx_submitted", txHash: result.txHash });
			logger.warn("SP pull tx unconfirmed — saved for Phase 0 verification", {
				jobId: job.id, cid, spId: result.spId, txHash: result.txHash,
			});
		} else {
			await updateSPStatus({ cid, spId: result.spId, status: "failed" });
		}
	}
}

// ============================================================================
// Route B: Full upload pipeline (IPFS fetch → CAR → store → pull → commit)
// ============================================================================

async function doFullUpload(
	job: Job<FilecoinUploadJob>,
	cid: string,
	pinataCid: string,
	sizeBytes: number,
	filename: string,
	spConfig: ReturnType<typeof loadSPProvidersConfig>,
	filecoinClient: ReturnType<typeof getClientFromEnv>,
	redis: ReturnType<typeof getWorkerRedisConnection>,
	isRepair?: boolean,
): Promise<void> {
	logger.info("Route B: full upload pipeline", {
		jobId: job.id, cid, sizeBytes, isRepair: !!isRepair,
	});

	const useStreaming = sizeBytes > STREAM_THRESHOLD;

	const uploadOptions = {
		filename: filename || `file-${cid}`,
		sizeBytes,
		waitForIPNI: true,

		async onPieceCidComputed(pieceCid: string) {
			await updateFilePieceCid(cid, pieceCid);
			logger.info("PieceCID computed", { jobId: job.id, cid, pieceCid });
			if (!isRepair) {
				await publishSSE(redis, `file:${cid}:status`, {
					cid, status: "uploading", event: "piece-cid-computed", pieceCid,
				});
			}
		},

		onProgress: (stage: string, data?: unknown) => {
			logger.info("Upload progress", { jobId: job.id, cid, stage, data });
		},

		async onProviderProgress({ name, status: spStatus, txHash }: {
			configId: string; name: string; status: string; txHash?: string;
		}) {
			await updateSPStatus({ cid, spId: name, status: spStatus, txHash });
			logger.info("SP progress", { jobId: job.id, cid, sp: name, status: spStatus, txHash });
			if (!isRepair) {
				await publishSSE(redis, `file:${cid}:status`, {
					cid, status: "uploading",
					event: "provider-progress",
					provider: { spId: name, status: spStatus, txHash },
				});
			}
		},

		// onProviderCommit: update individual SP only — file status set in Phase 2
		async onProviderCommit(result: {
			configId: string; pieceCid: string; txHash: string;
			provider: { endpoint: string };
		}) {
			const sp = spConfig.providers.find((p) => p.id === result.configId);
			const spName = sp?.name ?? result.configId;

			await updateSPStatus({
				cid, spId: spName, status: "stored",
				url: result.provider.endpoint, verifiedAt: new Date(),
				pieceCid: result.pieceCid, txHash: result.txHash,
			});

			logger.info("SP stored", { jobId: job.id, cid, sp: spName, txHash: result.txHash });

			if (!isRepair) {
				// Read actual confirmed count from DB for accurate SSE
				const confirmed = await getConfirmedSPCount(cid);
				const { replicationTotalProviders, replicationMinProviders } = config.filecoin;
				const fileStatus =
					confirmed >= replicationTotalProviders ? "fully_replicated"
						: confirmed >= replicationMinProviders ? "stored"
						: "uploading";

				await publishSSE(redis, `file:${cid}:status`, {
					cid, status: fileStatus,
					event: "provider-committed",
					confirmedSPs: confirmed,
					totalProviders: spConfig.providers.length,
					provider: { spId: spName, status: "stored", txHash: result.txHash, pieceCid: result.pieceCid },
				});
			}
		},

		async onProviderFail(failure: { configId: string; error: string }) {
			const sp = spConfig.providers.find((p) => p.id === failure.configId);
			const spName = sp?.name ?? failure.configId;
			await updateSPStatus({ cid, spId: spName, status: "failed" });
			if (!isRepair) {
				await publishSSE(redis, `file:${cid}:status`, {
					cid, status: "uploading",
					event: "provider-failed",
					provider: { spId: spName, status: "failed", error: failure.error },
				});
			}
		},
	};

	// Use the CID directly for repairs (pinataCid may equal cid)
	const fetchCid = pinataCid || cid;

	if (useStreaming) {
		logger.info("Using streaming upload for large file", { jobId: job.id, cid, sizeBytes });
		const { stream, sizeBytes: fetchedBytes } = await fetchFromIPFSStream(fetchCid);
		logger.info("IPFS stream opened", { jobId: job.id, cid, fetchedBytes });
		await uploadCarFromStreamToAllProviders(
			filecoinClient, stream,
			uploadOptions as Parameters<typeof uploadCarFromStreamToAllProviders>[2],
		);
	} else {
		logger.info("Using buffered upload for small file", { jobId: job.id, cid, sizeBytes });
		const fileData = await fetchFromIPFS(fetchCid);
		logger.info("Fetched file from IPFS", { jobId: job.id, cid, fetchedBytes: fileData.length });
		await uploadCarToAllProviders(
			filecoinClient, fileData,
			uploadOptions as Parameters<typeof uploadCarToAllProviders>[2],
		);
	}
}

// ============================================================================
// SSE/Redis pub/sub helpers
// ============================================================================

async function publishSSE(
	redis: ReturnType<typeof getWorkerRedisConnection>,
	channel: string,
	data: Record<string, unknown>,
): Promise<void> {
	try {
		await redis.publish(
			channel,
			JSON.stringify(data, (_, v) => (typeof v === "bigint" ? v.toString() : v)),
		);
	} catch (err) {
		logger.warn("Failed to publish SSE event", {
			channel,
			error: err instanceof Error ? err.message : String(err),
		});
	}
}

async function publishFinalStatus(
	redis: ReturnType<typeof getWorkerRedisConnection>,
	cid: string,
	confirmedSPs: number,
	totalProviders: number,
	failedProviderIds: string[],
): Promise<void> {
	const { replicationTotalProviders, replicationMinProviders } = config.filecoin;
	const status =
		confirmedSPs >= replicationTotalProviders ? "fully_replicated"
			: confirmedSPs >= replicationMinProviders ? "stored"
			: "partial";
	await publishSSE(redis, `file:${cid}:status`, {
		cid, status, confirmedSPs, totalProviders,
		failedProviders: failedProviderIds,
	});
}

// ============================================================================
// Pinata unpin handler
// ============================================================================

async function processPinataUnpin(job: Job<PinataUnpinJob>): Promise<void> {
	const { cid } = job.data;
	logger.info("Processing Pinata unpin job", { jobId: job.id, cid });

	try {
		await unpinFile(cid);
	} catch (error) {
		const msg = error instanceof Error ? error.message : String(error);
		if (!msg.includes("404") && !msg.includes("not found") && !msg.includes("NOT_FOUND")) {
			logger.warn("Pinata unpin API error (may already be unpinned)", { jobId: job.id, cid, error: msg });
		}
	}

	try {
		await updatePinataStatus(cid, false);
	} catch (dbError) {
		logger.warn("Failed to update pinata status in DB (non-critical)", {
			jobId: job.id, cid,
			error: dbError instanceof Error ? dbError.message : String(dbError),
		});
	}

	logger.info("File unpinned from Pinata", { jobId: job.id, cid });
}

// ============================================================================
// Worker setup
// ============================================================================

const connection = getWorkerRedisConnection();

const worker = new Worker(
	"filecoin-operations",
	async (job: Job) => {
		try {
			switch (job.name) {
				case "filecoin-upload":
					await processFilecoinUpload(job as Job<FilecoinUploadJob>);
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
		lockDuration: config.worker.lockDuration,
		stalledInterval: config.worker.stalledInterval,
		maxStalledCount: config.worker.maxStalledCount,
		limiter: {
			max: config.worker.rateLimitMax,
			duration: config.worker.rateLimitDuration,
		},
	},
);

worker.on("completed", (job) => {
	logger.info("Job completed successfully", { jobId: job.id, jobType: job.name });
});

worker.on("failed", (job, error) => {
	logger.error("Job failed", { jobId: job?.id, jobType: job?.name, error: error.message });
});

logger.info("Worker started", {
	queue: "filecoin-operations",
	concurrency: config.worker.concurrency,
	env: config.env,
});

// ============================================================================
// Startup cleanup
// ============================================================================

resetActiveBytes();

(async () => {
	try {
		// Reset SP statuses stuck in in-progress states from OOM crashes
		const resetCount = await resetStaleSPStatuses(10);
		if (resetCount > 0) {
			logger.info("Reset stale SP statuses on startup", { resetCount });
		}

		// Clean up legacy repeatable jobs from previous deployments
		const queue = getFilecoinQueue();
		const existing = await queue.getRepeatableJobs();
		for (const job of existing) {
			if (job.name === "sp-retry-check") {
				await queue.removeRepeatableByKey(job.key);
				logger.info("Removed legacy sp-retry-check repeatable job");
			}
		}
	} catch (error) {
		logger.warn("Startup cleanup failed (non-critical)", {
			error: error instanceof Error ? error.message : String(error),
		});
	}
})();

// ============================================================================
// Auto-repair: enqueue individual repair jobs when system is idle
// ============================================================================

const AUTO_REPAIR_SIGNAL_KEY = "w3stor:auto-repair:signal";
const AUTO_REPAIR_POLL_MS = 15_000;
const MAX_REPAIR_BATCH = 10;

async function pollAutoRepairSignal(): Promise<void> {
	const redis = getWorkerRedisConnection();
	try {
		const signal = await redis.get(AUTO_REPAIR_SIGNAL_KEY);
		if (!signal) return;

		// Consume the signal so other workers don't double-trigger
		await redis.del(AUTO_REPAIR_SIGNAL_KEY);

		const repairable = await getRepairableFiles(
			config.filecoin.replicationTotalProviders,
			MAX_REPAIR_BATCH,
		);

		if (repairable.length === 0) {
			logger.info("Auto-repair: no repairable files found");
			return;
		}

		let enqueued = 0;
		for (const file of repairable) {
			if (!file.walletAddress) continue;

			const jobId = await enqueueRepairUpload({
				cid: file.cid,
				sizeBytes: file.sizeBytes,
				walletAddress: file.walletAddress,
				pinataCid: file.cid,
				filename: file.filename || `file-${file.cid}`,
			});

			if (jobId) enqueued++;
		}

		logger.info("Auto-repair: enqueued individual repair jobs", {
			found: repairable.length,
			enqueued,
		});
	} catch (error) {
		logger.warn("Auto-repair signal poll failed", {
			error: error instanceof Error ? error.message : String(error),
		});
	}
}

const repairInterval = setInterval(pollAutoRepairSignal, AUTO_REPAIR_POLL_MS);

// ============================================================================
// Graceful shutdown
// ============================================================================

async function shutdownWorker(signal: string): Promise<void> {
	logger.info(`${signal} received, shutting down worker`);
	clearInterval(repairInterval);
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
