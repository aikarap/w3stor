import { bytesToMB, logger } from "@w3stor/shared";
import pricingConfig from "./pricing.json";

export type OperationType = "upload" | "attestation" | "workflow-execute";

import { createPublicClient, http, parseAbi } from "viem";
import { getViemChain } from "../chains";

interface PricingConfig {
	operations: {
		upload: { pricePerMB: number; minimumCharge: number };
		attestation: { pricePerOperation: number };
		"workflow-execute": { pricePerOperation: number };
	};
	networks: {
		[networkId: string]: {
			name: string;
			chainId: number;
			multiplier: number;
			tokens: {
				[symbol: string]: {
					address: string;
					decimals: number;
					multiplier: number;
				};
			};
		};
	};
}

const pricing = pricingConfig as PricingConfig;

export function calculateOperationPrice(
	operation: OperationType,
	sizeBytes?: number,
	network?: string,
	token?: string,
): number {
	let basePrice: number;

	switch (operation) {
		case "upload": {
			if (sizeBytes === undefined || sizeBytes === null) throw new Error("sizeBytes required for upload");
			const uploadMB = bytesToMB(sizeBytes);
			basePrice = Math.max(
				uploadMB * pricing.operations.upload.pricePerMB,
				pricing.operations.upload.minimumCharge,
			);
			break;
		}
		case "attestation":
			basePrice = pricing.operations.attestation.pricePerOperation;
			break;
		case "workflow-execute":
			basePrice = pricing.operations["workflow-execute"].pricePerOperation;
			break;

		default:
			throw new Error(`Unknown operation type: ${operation}`);
	}

	let networkMultiplier = 1.0;
	let tokenMultiplier = 1.0;

	if (network && pricing.networks[network]) {
		networkMultiplier = pricing.networks[network].multiplier;

		if (token && pricing.networks[network].tokens[token]) {
			tokenMultiplier = pricing.networks[network].tokens[token].multiplier;
		}
	}

	return Number((basePrice * networkMultiplier * tokenMultiplier).toFixed(10));
}

const eip712Abi = parseAbi([
	"function name() view returns (string)",
	"function version() view returns (string)",
]);

const eip712Cache = new Map<string, { name: string; version: string }>();

export async function getTokenEip712Domain(
	networkId: string,
	tokenAddress: string,
): Promise<{ name: string; version: string }> {
	const cacheKey = `${networkId}:${tokenAddress.toLowerCase()}`;
	const cached = eip712Cache.get(cacheKey);
	if (cached) return cached;

	const network = pricing.networks[networkId];
	if (!network) {
		throw new Error(`Unknown network ${networkId} in pricing config`);
	}

	const chain = getViemChain(network.chainId);
	const client = createPublicClient({ chain, transport: http() });
	const address = tokenAddress as `0x${string}`;

	const [name, version] = await Promise.all([
		client.readContract({ address, abi: eip712Abi, functionName: "name" }),
		client.readContract({ address, abi: eip712Abi, functionName: "version" }).catch(() => "2"),
	]);

	logger.debug("Fetched EIP-712 domain from contract", {
		networkId,
		tokenAddress,
		name,
		version,
	});

	const domain = { name, version };
	eip712Cache.set(cacheKey, domain);
	return domain;
}

