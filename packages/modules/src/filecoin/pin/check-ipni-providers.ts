import { FILECOIN_IPNI_INDEXER_URL, logger } from "@w3stor/shared";

interface IpniIndexerResponse {
	MultihashResults?: Array<{
		Multihash?: string;
		ProviderResults?: Array<{
			Provider?: {
				ID?: string;
				Addrs?: string[];
			};
		}>;
	}>;
}

export interface IpniCheckResult {
	providerCount: number;
	providerIds: string[];
}

/**
 * Single-shot IPNI lookup. Queries the indexer once and returns the count
 * of unique providers advertising the given CID.
 *
 * Fail-open: any error returns { providerCount: 0, providerIds: [] }
 * so the caller falls through to the normal upload flow.
 */
export async function checkIpniProviders(
	cid: string,
	timeoutMs: number = 5000,
): Promise<IpniCheckResult> {
	const ipniIndexerUrl = FILECOIN_IPNI_INDEXER_URL;

	try {
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), timeoutMs);

		const response = await fetch(`${ipniIndexerUrl}/cid/${cid}`, {
			headers: { Accept: "application/json" },
			signal: controller.signal,
		});

		clearTimeout(timer);

		if (!response.ok) {
			logger.debug("IPNI check returned non-OK status", {
				cid,
				status: response.status,
			});
			return { providerCount: 0, providerIds: [] };
		}

		const body = (await response.json()) as IpniIndexerResponse;

		const allProviderResults = (body.MultihashResults ?? []).flatMap(
			(r) => r.ProviderResults ?? [],
		);

		const uniqueProviderIds = new Set<string>();
		for (const pr of allProviderResults) {
			if (pr.Provider?.ID) {
				uniqueProviderIds.add(pr.Provider.ID);
			}
		}

		const providerIds = Array.from(uniqueProviderIds);

		logger.info("IPNI dedup check completed", {
			cid,
			providerCount: providerIds.length,
			providerIds,
		});

		return { providerCount: providerIds.length, providerIds };
	} catch (error) {
		logger.warn("IPNI dedup check failed, proceeding with normal upload", {
			cid,
			error: error instanceof Error ? error.message : String(error),
		});
		return { providerCount: 0, providerIds: [] };
	}
}
