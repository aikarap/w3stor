import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
import type { PieceCID } from "@filoz/synapse-core/piece";
import * as Piece from "@filoz/synapse-core/piece";
import * as SP from "@filoz/synapse-core/sp";
import { addPieces, type PullResponse, waitForPullStatus } from "@filoz/synapse-core/sp";
import { logger } from "@w3stor/shared";
import { CID } from "multiformats/cid";
import type { FilecoinClient } from "./client";
import { buildCarToFile, cleanupCarFile } from "./pin";
import { waitForIpniProviderResults } from "./pin/wait-ipni-advertisement";
import { loadSPProvidersConfig, type SPProviderConfig } from "./sp-config";
import type { FilecoinUploadOptions, FilecoinUploadResult } from "./types";

export interface CarUploadOptions extends Omit<FilecoinUploadOptions, "metadata"> {
	datasetId: bigint;
	clientDataSetId: bigint;
	filename?: string;
	waitForIPNI?: boolean;
	sizeBytes?: number;
}

export interface CarUploadResult extends FilecoinUploadResult {
	ipfsRootCid: string;
	carSize: number;
	ipniAdvertised?: boolean;
	configId?: string;
}

interface PreBuiltCar {
	carFilePath: string;
	rootCid: string;
	pieceCid: PieceCID;
	carSize: number;
}

/**
 * Create a Web ReadableStream from a file path for streaming upload.
 */
function createFileReadableStream(filePath: string): ReadableStream<Uint8Array> {
	const nodeStream = createReadStream(filePath);
	return Readable.toWeb(nodeStream) as unknown as ReadableStream<Uint8Array>;
}

/**
 * Store: Upload CAR to the primary SP via streaming and confirm it's parked.
 *
 * This makes the piece available for other SPs to pull from.
 * Does NOT commit the piece on-chain — that happens in commitPieceToProvider.
 */
async function storePieceToPrimary(
	car: PreBuiltCar,
	primaryProvider: SPProviderConfig,
	onProgress?: CarUploadOptions["onProgress"],
): Promise<void> {
	onProgress?.("provider_selected", {
		providerId: primaryProvider.providerId,
		endpoint: primaryProvider.url,
	});

	onProgress?.("uploading_to_sp", {
		pieceCid: car.pieceCid.toString(),
		ipfsRootCid: car.rootCid,
	});

	const stream = createFileReadableStream(car.carFilePath);
	await SP.uploadPieceStreaming({
		data: stream,
		serviceURL: primaryProvider.url,
		pieceCid: car.pieceCid,
		size: car.carSize,
	});

	await SP.findPiece({
		pieceCid: car.pieceCid,
		serviceURL: primaryProvider.url,
		retry: true,
	});

	onProgress?.("piece_parked");
}

/**
 * Pull: Initiate SP-to-SP pulls from the primary to all secondary providers.
 *
 * Uses Promise.allSettled so one secondary failure doesn't kill the batch.
 * Returns immediately — use waitForPullStatus to confirm completion.
 */
export function pullPieceToSecondaries(
	client: FilecoinClient,
	car: PreBuiltCar,
	metadata: Record<string, string>,
	primaryProvider: SPProviderConfig,
	secondaryProviders: SPProviderConfig[],
): Promise<Array<PromiseSettledResult<PullResponse>>> {
	return Promise.allSettled(
		secondaryProviders.map(async (provider) => {
			return await SP.pullPieces(client, {
				serviceURL: provider.url,
				pieces: [
					{
						pieceCid: car.pieceCid,
						sourceUrl: `${primaryProvider.url}/piece/${car.pieceCid.toString()}`,
						metadata,
					},
				],
				dataSetId: BigInt(provider.datasetId),
				clientDataSetId: BigInt(provider.clientDataSetId),
			});
		}),
	);
}

/**
 * Commit: Register piece in provider's on-chain dataset via addPieces.
 */
async function commitPieceToProvider(
	client: FilecoinClient,
	car: PreBuiltCar,
	providerConfig: SPProviderConfig,
	metadata: Record<string, string>,
	onProgress?: CarUploadOptions["onProgress"],
): Promise<{ txHash: `0x${string}`; statusUrl: string }> {
	onProgress?.("adding_pieces", {
		dataSetId: providerConfig.datasetId.toString(),
	});

	const result = await addPieces(client, {
		serviceURL: providerConfig.url,
		dataSetId: BigInt(providerConfig.datasetId),
		clientDataSetId: BigInt(providerConfig.clientDataSetId),
		pieces: [
			{
				pieceCid: car.pieceCid,
				metadata,
			},
		],
	});

	onProgress?.("tx_submitted", { txHash: result.txHash });

	await SP.waitForAddPieces({ statusUrl: result.statusUrl });

	onProgress?.("tx_confirmed");

	return result;
}

export interface AllProvidersResult {
	succeeded: CarUploadResult[];
	failed: Array<{ configId: string; error: string }>;
	totalProviders: number;
}

/**
 * Upload a file to all configured storage providers using the store/pull/commit pattern:
 *
 * 1. Store — Upload CAR to primary SP, confirm piece is parked
 * 2. Pull  — Secondary SPs pull the piece from the primary (SP-to-SP, saves bandwidth)
 * 3. Commit — Register piece on-chain for every provider via addPieces
 */
export async function uploadCarToAllProviders(
	client: FilecoinClient,
	fileData: Uint8Array,
	options: Omit<CarUploadOptions, "datasetId" | "clientDataSetId" | "providerId">,
): Promise<AllProvidersResult> {
	const filename = options.filename || "file";
	const sizeBytes = options.sizeBytes || fileData.length;

	logger.info("Building CAR file to disk", { filename, sizeBytes });

	const carFile = await buildCarToFile(fileData, filename);

	logger.info("CAR file built", {
		rootCid: carFile.rootCid,
		carSize: carFile.carSize,
		carFilePath: carFile.carFilePath,
	});

	try {
		// Compute PieceCID once by streaming the temp file
		const fileStream = createReadStream(carFile.carFilePath);
		const pieceCid = await Piece.calculateFromIterable(
			fileStream as unknown as AsyncIterable<Uint8Array>,
		);

		logger.info("PieceCID computed", { pieceCid: pieceCid.toString() });

		const car: PreBuiltCar = {
			carFilePath: carFile.carFilePath,
			rootCid: carFile.rootCid,
			pieceCid,
			carSize: carFile.carSize,
		};

		const spConfig = loadSPProvidersConfig();
		const primaryProvider = spConfig.providers[0];
		const secondaryProviders = spConfig.providers.slice(1);
		const metadata = {
			name: filename,
			ipfsRootCid: car.rootCid,
		};

		// --- Phase 1: Store piece on primary SP ---
		await storePieceToPrimary(car, primaryProvider, options.onProgress);

		// --- Phase 2: Pull piece to secondary SPs ---
		if (secondaryProviders.length > 0) {
			const pullResults = await pullPieceToSecondaries(
				client,
				car,
				metadata,
				primaryProvider,
				secondaryProviders,
			);

			// Wait for each successful pull to complete
			const waitResults = await Promise.allSettled(
				pullResults.map(async (result, index) => {
					const provider = secondaryProviders[index];
					if (result.status === "rejected") {
						throw result.reason;
					}

					if (result.value.status === "complete") {
						return result.value;
					}

					// Poll until the pull completes or fails
					return await waitForPullStatus(client, {
						serviceURL: provider.url,
						pieces: [
							{
								pieceCid: car.pieceCid,
								sourceUrl: `${primaryProvider.url}/piece/${car.pieceCid.toString()}`,
								metadata,
							},
						],
						dataSetId: BigInt(provider.datasetId),
						clientDataSetId: BigInt(provider.clientDataSetId),
					});
				}),
			);

			for (let i = 0; i < waitResults.length; i++) {
				const result = waitResults[i];
				if (result.status === "rejected") {
					logger.warn("Secondary provider pull failed", {
						provider: secondaryProviders[i].id,
						error: result.reason instanceof Error ? result.reason.message : String(result.reason),
					});
				}
			}
		}

		// --- Phase 3: Commit piece on-chain for all providers ---
		options.onProgress?.("provider_selected", {
			stage: "parallel_commit",
			providerCount: spConfig.providers.length,
		});

		const commitResults = await Promise.allSettled(
			spConfig.providers.map((providerConfig) =>
				commitPieceToProvider(client, car, providerConfig, metadata, options.onProgress),
			),
		);

		// Check IPNI advertisement for our root CID
		let ipniAdvertised: boolean | undefined;
		try {
			ipniAdvertised = await waitForIpniProviderResults(CID.parse(car.rootCid));
		} catch (error) {
			logger.warn("IPNI advertisement check failed", {
				error: error instanceof Error ? error.message : String(error),
				rootCid: car.rootCid,
			});
			ipniAdvertised = false;
		}

		const succeeded: CarUploadResult[] = [];
		const failed: Array<{ configId: string; error: string }> = [];

		commitResults.forEach((result, index) => {
			const providerConfig = spConfig.providers[index];
			const configId = providerConfig.id;
			if (result.status === "fulfilled") {
				succeeded.push({
					pieceCid: car.pieceCid.toString(),
					ipfsRootCid: car.rootCid,
					carSize: car.carSize,
					size: sizeBytes,
					dataSetId: BigInt(providerConfig.datasetId),
					provider: {
						id: BigInt(providerConfig.providerId),
						address: providerConfig.address,
						endpoint: providerConfig.url,
					},
					txHash: result.value.txHash,
					ipniAdvertised,
				});
			} else {
				const errorMsg =
					result.reason instanceof Error ? result.reason.message : String(result.reason);
				failed.push({ configId, error: errorMsg });
			}
		});

		logger.info("All providers upload completed", {
			succeeded: succeeded.length,
			failed: failed.length,
			total: spConfig.providers.length,
		});

		return {
			succeeded,
			failed,
			totalProviders: spConfig.providers.length,
		};
	} finally {
		await cleanupCarFile(carFile.carFilePath);
		logger.info("Temp CAR file cleaned up", {
			carFilePath: carFile.carFilePath,
		});
	}
}
