import type { X402NetworkConfig } from "@w3stor/shared";
import pricingConfig from "./pricing.json";

/**
 * Load x402 network configuration from pricing.json + environment variables.
 * Call this at startup and assign to config.x402.networks.
 */
export function loadX402Networks(): X402NetworkConfig[] {
	// Full JSON override for custom deployments
	const networksJson = process.env.X402_NETWORKS;
	if (networksJson) {
		try {
			return JSON.parse(networksJson);
		} catch (_error) {
			throw new Error("Invalid X402_NETWORKS JSON configuration");
		}
	}

	// Derive from pricing.json + environment variables
	const evmPayTo = process.env.X402_EVM_PAY_TO;
	if (!evmPayTo) {
		return [];
	}

	const pricingNetworks = (
		pricingConfig as {
			networks: Record<
				string,
				{
					chainId: number;
					tokens: Record<string, { address: string; decimals: number }>;
				}
			>;
		}
	).networks;

	return Object.entries(pricingNetworks).map(([networkId, networkDef]) => ({
		network: networkId,
		chainId: networkDef.chainId,
		payTo: evmPayTo,
		tokens: Object.entries(networkDef.tokens).map(([symbol, tokenDef]) => ({
			symbol,
			address: tokenDef.address,
			decimals: tokenDef.decimals,
		})),
	}));
}
