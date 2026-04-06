import { createPublicClient, http } from "viem";
import { calibration } from "@filoz/synapse-core/chains";
import * as SP from "@filoz/synapse-core/sp";
import { addPieces, waitForPullStatus } from "@filoz/synapse-core/sp";
import type { PieceCID } from "@filoz/synapse-core/piece";
import { CID } from "multiformats/cid";
import { logger } from "@w3stor/shared";
import type { FilecoinClient } from "./client";
import { pullPieceToSecondaries } from "./upload-car";
import type { SPProviderConfig } from "./sp-config";

/**
 * Create a public client for reading chain state (tx receipts).
 */
function getPublicClient() {
	return createPublicClient({
		chain: calibration,
		transport: http(),
	});
}

/**
 * Check if a transaction was actually successful on-chain.
 * Returns true if the tx exists and succeeded, false if it failed or doesn't exist.
 */
export async function verifyTransactionOnChain(txHash: string): Promise<boolean> {
	try {
		const publicClient = getPublicClient();
		const receipt = await publicClient.getTransactionReceipt({
			hash: txHash as `0x${string}`,
		});
		return receipt.status === "success";
	} catch (error) {
		logger.warn("Failed to verify tx on-chain", {
			txHash,
			error: error instanceof Error ? error.message : String(error),
		});
		return false;
	}
}

/**
 * Retry a failed SP by doing SP-to-SP pull from a confirmed provider, then committing on-chain.
 * Returns the txHash if successful, null if failed.
 */
export async function retryFailedSPs(
	client: FilecoinClient,
	params: {
		cid: string;
		pieceCid: string;
		sizeBytes: number;
		confirmedProvider: SPProviderConfig;
		failedProviders: SPProviderConfig[];
		onSPProgress?: (spId: string, status: string, txHash?: string) => Promise<void>;
	},
): Promise<{ spId: string; txHash: string; success: boolean }[]> {
	const { cid, pieceCid, confirmedProvider, failedProviders, onSPProgress } = params;
	const results: { spId: string; txHash: string; success: boolean }[] = [];

	const pieceCidObj = CID.parse(pieceCid) as unknown as PieceCID;
	const metadata = { name: `retry-${cid}`, ipfsRootCid: cid };

	const car = {
		carFilePath: "",
		rootCid: cid,
		pieceCid: pieceCidObj,
		carSize: params.sizeBytes,
	};

	for (const provider of failedProviders) {
		try {
			await onSPProgress?.(provider.name, "pulling");

			logger.info("Initiating SP-to-SP pull for retry", {
				cid,
				targetSP: provider.name,
				sourceSP: confirmedProvider.name,
			});

			// Pull from confirmed SP
			const pullResults = await pullPieceToSecondaries(
				client,
				car,
				metadata,
				confirmedProvider,
				[provider],
			);

			const pullResult = pullResults[0];
			if (pullResult.status === "rejected") {
				throw pullResult.reason;
			}

			// Wait for pull completion
			if (pullResult.value.status !== "complete") {
				await waitForPullStatus(client, {
					serviceURL: provider.url,
					pieces: [
						{
							pieceCid: pieceCidObj,
							sourceUrl: `${confirmedProvider.url}/piece/${pieceCid}`,
							metadata,
						},
					],
					dataSetId: BigInt(provider.datasetId),
					clientDataSetId: BigInt(provider.clientDataSetId),
				});
			}

			await onSPProgress?.(provider.name, "committing");

			// Commit on-chain
			const addResult = await addPieces(client, {
				serviceURL: provider.url,
				dataSetId: BigInt(provider.datasetId),
				clientDataSetId: BigInt(provider.clientDataSetId),
				pieces: [{ pieceCid: pieceCidObj, metadata }],
			});

			await onSPProgress?.(provider.name, "tx_submitted", addResult.txHash);

			// Wait for confirmation
			try {
				await SP.waitForAddPieces({ statusUrl: addResult.statusUrl });
				results.push({ spId: provider.name, txHash: addResult.txHash, success: true });
			} catch (waitError) {
				// TX submitted but confirmation timed out — still partially successful
				logger.warn("SP retry tx confirmation timed out", {
					cid,
					spId: provider.name,
					txHash: addResult.txHash,
				});
				results.push({ spId: provider.name, txHash: addResult.txHash, success: false });
			}
		} catch (error) {
			logger.error("SP retry failed for provider", {
				cid,
				spId: provider.name,
				error: error instanceof Error ? error.message : String(error),
			});
			results.push({ spId: provider.name, txHash: "", success: false });
		}
	}

	return results;
}
