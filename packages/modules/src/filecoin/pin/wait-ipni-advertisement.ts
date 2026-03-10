import { FILECOIN_CONFIG, FILECOIN_IPNI_INDEXER_URL, logger } from "@w3stor/shared";
import type { CID } from "multiformats/cid";

/**
 * Response structure from an IPNI indexer.
 *
 * The indexer returns provider records corresponding with each SP that advertised
 * a given CID to IPNI.
 * Each provider includes their peer ID and multiaddrs.
 */
interface IpniIndexerResponse {
	MultihashResults?: Array<{
		Multihash?: string;
		ProviderResults?: ProviderResult[];
	}>;
}

/**
 * A single provider's provider record from IPNI.
 *
 * Contains the provider's libp2p peer ID and an array of multiaddrs where
 * the content can be retrieved. These multiaddrs typically include the
 * provider's PDP service endpoint (e.g., /dns/provider.example.com/tcp/443/https).
 *
 * Note: this format matches what IPNI indexers return (see https://cid.contact/cid/bafybeigvgzoolc3drupxhlevdp2ugqcrbcsqfmcek2zxiw5wctk3xjpjwy for an example)
 */
interface ProviderResult {
	Provider?: {
		/** Libp2p peer ID of the storage provider */
		ID?: string;
		/** Multiaddrs where this provider can serve the content */
		Addrs?: string[];
	};
}

/**
 * Check if the IPNI Indexer has the provided ProviderResults for the provided ipfsRootCid.
 * This effectively verifies the entire SP<->IPNI flow, including:
 * - The SP announced the advertisement chain to the IPNI indexer(s)
 * - The IPNI indexer(s) pulled the advertisement chain from the SP
 * - The IPNI indexer(s) updated their index
 * This doesn't check individual steps, but rather the end ProviderResults reponse from the IPNI indexer.
 * If the IPNI indexer ProviderResults have the expected providers, then the steps abomove must have completed.
 * This doesn't actually do any IPFS Mainnet retrieval checks of the ipfsRootCid.
 *
 * This should not be called until you receive confirmation from the SP that the piece has been parked, i.e. `onPieceAdded` in the `synapse.storage.upload` callbacks.
 *
 * @param ipfsRootCid - The IPFS root CID to check
 * @returns True if the IPNI announce succeeded, false otherwise
 */
export async function waitForIpniProviderResults(ipfsRootCid: CID): Promise<boolean> {
	const delayMs = FILECOIN_CONFIG.ADVERTISEMENT_WAIT.DELAY_MS;
	const maxAttempts = FILECOIN_CONFIG.ADVERTISEMENT_WAIT.MAX_ATTEMPTS;
	const ipniIndexerUrl = FILECOIN_IPNI_INDEXER_URL;

	return new Promise<boolean>((resolve, reject) => {
		let retryCount = 0;
		let lastFailureReason: string | undefined;
		let lastActualMultiaddrs: Set<string> = new Set();

		const check = async (): Promise<void> => {
			const fetchOptions: RequestInit = {
				headers: { Accept: "application/json" },
			};

			let response: Response | undefined;
			try {
				response = await fetch(`${ipniIndexerUrl}/cid/${ipfsRootCid}`, fetchOptions);
			} catch (fetchError) {
				lastActualMultiaddrs = new Set();
				lastFailureReason = `Failed to query IPNI indexer: ${fetchError instanceof Error ? fetchError.message : String(fetchError)}`;
				logger.error("IPNI indexer query failed", {
					reason: lastFailureReason,
					cid: ipfsRootCid.toString(),
				});
			}

			if (response?.ok) {
				let providerResults: ProviderResult[] = [];
				try {
					const body = (await response.json()) as IpniIndexerResponse;
					providerResults = (body.MultihashResults ?? []).flatMap((r) => r.ProviderResults ?? []);
					lastActualMultiaddrs = new Set(providerResults.flatMap((pr) => pr.Provider?.Addrs ?? []));
					lastFailureReason = undefined;
				} catch (parseError) {
					lastActualMultiaddrs = new Set();
					lastFailureReason = `Failed to parse IPNI response body: ${parseError instanceof Error ? parseError.message : String(parseError)}`;
					logger.error("IPNI indexer query failed", {
						reason: lastFailureReason,
						cid: ipfsRootCid.toString(),
					});
				}

				if (providerResults.length > 0) {
					if (lastActualMultiaddrs.size > 0) {
						resolve(true);
						return;
					}
				} else if (lastFailureReason == null) {
					lastFailureReason = "IPNI response did not include any provider results";
					lastActualMultiaddrs = new Set();
				}
			} else if (response != null) {
				lastActualMultiaddrs = new Set();
				lastFailureReason = `IPNI indexer request failed with status ${response.status}`;
			}

			if (++retryCount < maxAttempts) {
				await new Promise((resolve) => setTimeout(resolve, delayMs));
				await check();
			} else {
				const msgBase = `IPFS root CID "${ipfsRootCid.toString()}" does not have expected IPNI ProviderResults after ${maxAttempts} attempt${maxAttempts > 1 ? "s" : ""}`;
				let msg = msgBase;
				if (lastFailureReason != null) {
					msg = `${msgBase}. Last observation: ${lastFailureReason}`;
				}
				msg = `${msg}. Actual multiaddrs in response: [${Array.from(lastActualMultiaddrs).join(", ")}]`;
				const error = new Error(msg);
				logger.error("IPNI validation failed", {
					error: error.message,
					cid: ipfsRootCid.toString(),
				});
				throw error;
			}
		};

		check().catch((error) => {
			logger.error("IPNI advertisement wait failed", { error: error.message });
			reject(error);
		});
	});
}
