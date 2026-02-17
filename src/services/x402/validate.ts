import { config } from "@w3stor/shared";

export function validateX402Config() {
	if (!config.x402.evmPrivateKey)
		throw new Error("Missing required configuration: X402_EVM_PRIVATE_KEY");
	if (!config.x402.evmPayToAddress)
		throw new Error("Missing required configuration: X402_EVM_PAY_TO");
	if (config.x402.networks.length === 0)
		throw new Error(
			"No x402 networks configured. Check pricing.json networks and X402_EVM_PAY_TO.",
		);

	for (const network of config.x402.networks) {
		if (!network.chainId) {
			throw new Error(`Network ${network.network} missing chainId in pricing.json`);
		}
		if (network.tokens.length === 0) {
			throw new Error(`Network ${network.network} has no configured tokens in pricing.json`);
		}
	}
}
