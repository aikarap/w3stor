import { getPartiallyStoredFiles, getSPStatuses, updateFileStatus, updateSPStatus } from "@w3stor/db";
import {
	getClientFromEnv,
	loadSPProvidersConfig,
	type SPProviderConfig,
} from "@w3stor/modules/filecoin";
import { getWorkerRedisConnection } from "@w3stor/modules/queue";
import type { SPRetryCheckJob } from "@w3stor/shared";
import { config, logger } from "@w3stor/shared";
import type { Job } from "bullmq";

export async function processSPRetryCheck(job: Job<SPRetryCheckJob>): Promise<void> {
	logger.info("Starting SP retry check", { triggeredBy: job.data.triggeredBy });

	const partialFiles = await getPartiallyStoredFiles();

	if (partialFiles.length === 0) {
		logger.info("No partially-stored files found for retry");
		return;
	}

	logger.info("Found files for SP retry", { count: partialFiles.length });

	const spConfig = loadSPProvidersConfig();
	const redis = getWorkerRedisConnection();
	const { replicationTotalProviders } = config.filecoin;

	for (const file of partialFiles) {
		try {
			logger.info("Retrying failed SPs for file", {
				cid: file.cid,
				storedCount: file.storedCount,
				failedSPs: file.failedSPs,
			});

			// Get current SP statuses to find a confirmed provider for pull source
			const spStatuses = await getSPStatuses(file.cid);
			const confirmedSP = spStatuses.find((s) =>
				["stored", "verified", "tx_confirmed"].includes(s.status),
			);

			if (!confirmedSP) {
				logger.warn("No confirmed SP found for pull source", { cid: file.cid });
				continue;
			}

			// Find provider configs for failed SPs
			const failedProviders = file.failedSPs
				.map((spId) => spConfig.providers.find((p) => p.name === spId))
				.filter((p): p is SPProviderConfig => p != null);

			if (failedProviders.length === 0) {
				logger.warn("No matching provider configs for failed SPs", {
					cid: file.cid,
					failedSPs: file.failedSPs,
				});
				continue;
			}

			let newConfirmations = 0;

			// Retry each failed SP
			for (const provider of failedProviders) {
				try {
					await updateSPStatus({
						cid: file.cid,
						spId: provider.name,
						status: "pulling",
					});

					// TODO: Implement individual SP retry via Synapse SDK
					// For now, reset status to pending so the next full upload attempt picks it up
					await updateSPStatus({
						cid: file.cid,
						spId: provider.name,
						status: "pending",
					});

					logger.info("Reset failed SP to pending for retry", {
						cid: file.cid,
						spId: provider.name,
					});
				} catch (error) {
					logger.error("SP retry failed for provider", {
						cid: file.cid,
						spId: provider.name,
						error: error instanceof Error ? error.message : String(error),
					});
				}
			}

			// Check if file has reached replication threshold
			const totalConfirmed = file.storedCount + newConfirmations;
			if (totalConfirmed >= replicationTotalProviders) {
				await updateFileStatus(file.cid, "fully_replicated");
				logger.info("File reached full replication after retry", {
					cid: file.cid,
					confirmedSPs: totalConfirmed,
				});
			}

			// Publish status update
			await redis.publish(
				`file:${file.cid}:status`,
				JSON.stringify({
					cid: file.cid,
					event: "sp-retry",
					storedCount: totalConfirmed,
				}),
			).catch(() => {});
		} catch (error) {
			logger.error("Failed to process retry for file", {
				cid: file.cid,
				error: error instanceof Error ? error.message : String(error),
			});
		}
	}

	logger.info("SP retry check completed", {
		filesProcessed: partialFiles.length,
	});
}
