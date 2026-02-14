import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export interface SPProviderConfig {
	id: string;
	providerId: number;
	datasetId: number;
	address: `0x${string}`;
	clientDataSetId: string;
	name: string;
	url: string;
	priority: number;
}

export interface SPProvidersConfig {
	providers: SPProviderConfig[];
	replication: {
		requiredConfirmations: number;
		confirmationTimeoutSeconds: number;
		retryAttempts: number;
	};
}

let cachedConfig: SPProvidersConfig | null = null;

export function loadSPProvidersConfig(configPath?: string): SPProvidersConfig {
	if (cachedConfig) {
		return cachedConfig;
	}

	const path = configPath || join(dirname(fileURLToPath(import.meta.url)), "sp-providers.json");

	try {
		const fileContent = readFileSync(path, "utf-8");
		cachedConfig = JSON.parse(fileContent) as SPProvidersConfig;
		return cachedConfig;
	} catch (error) {
		throw new Error(
			`Failed to load SP providers config from ${path}: ${error instanceof Error ? error.message : String(error)}`,
		);
	}
}

export function getProviderByPriority(
	config: SPProvidersConfig,
	priority: number = 1,
): SPProviderConfig | undefined {
	return config.providers.find((p) => p.priority === priority);
}

import * as SP from "@filoz/synapse-core/sp";
import {
	getApprovedPDPProviders,
	getPDPProvider,
	type PDPProvider,
} from "@filoz/synapse-core/sp-registry";
import { logger } from "@w3stor/shared";
import type { FilecoinClient } from "./client";

export async function getAvailableProviders(client: FilecoinClient): Promise<PDPProvider[]> {
	return await getApprovedPDPProviders(client);
}

export async function selectProvider(
	client: FilecoinClient,
	providerId?: bigint,
): Promise<PDPProvider> {
	if (providerId !== undefined) {
		const provider = await getPDPProvider(client, {
			providerId: BigInt(providerId),
		});
		if (!provider) {
			throw new Error(`Provider with ID ${providerId} not found`);
		}
		try {
			await SP.ping(provider.pdp.serviceURL);
			return provider;
		} catch (error) {
			logger.warn("Provider ping failed", {
				provider: provider.serviceProvider,
				serviceURL: provider.pdp.serviceURL,
				error: error instanceof Error ? error.message : String(error),
			});
			throw new Error(`Provider with ID ${providerId} is not healthy`);
		}
	}
	const providers = await getAvailableProviders(client);

	if (providers.length === 0) {
		throw new Error("No storage providers available");
	}

	for (const provider of providers) {
		try {
			await SP.ping(provider.pdp.serviceURL);
			return provider;
		} catch (error) {
			logger.warn("Provider ping failed", {
				provider: provider.serviceProvider,
				serviceURL: provider.pdp.serviceURL,
				error: error instanceof Error ? error.message : String(error),
			});
		}
	}

	throw new Error("No healthy storage providers available");
}

export async function healthCheckProvider(endpoint: string): Promise<boolean> {
	try {
		await SP.ping(endpoint);
		return true;
	} catch {
		return false;
	}
}
