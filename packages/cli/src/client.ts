import { execSync } from "node:child_process";
import { basename, dirname } from "node:path";
import { getChain } from "@filoz/synapse-core/chains";
import { createPublicClient, createWalletClient, type Hex, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import * as chains from "viem/chains";
import config from "./config.ts";

export function privateKeyFromConfig(): string {
	const keystore = config.get("keystore");
	if (!keystore) {
		const privateKey = config.get("privateKey");
		if (!privateKey) {
			throw new Error("Private key not configured. Run `w3stor init` to set up your wallet.");
		}
		return privateKey;
	}
	const keystoreDir = dirname(keystore);
	const keystoreName = basename(keystore);
	try {
		const extraction = execSync(`cast w dk -k ${keystoreDir} ${keystoreName}`).toString();
		const foundAt = extraction.search(/0x[a-fA-F0-9]{64}/);
		if (foundAt === -1) {
			throw new Error("Failed to retrieve private key from keystore");
		}
		return extraction.slice(foundAt, foundAt + 66);
	} catch (_error) {
		throw new Error(
			"Failed to access keystore. Check that `cast` is installed and keystore path is correct.",
		);
	}
}

export function privateKeyClient(chainId: number) {
	const chain = getChain(chainId);
	const privateKey = privateKeyFromConfig();
	const account = privateKeyToAccount(privateKey as Hex);
	const client = createWalletClient({
		account,
		chain,
		transport: http(),
	});
	return { client, chain };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function publicClient(chainId: number): any {
	const allChains = Object.values(chains);
	const chain = allChains.find((c) => c.id === chainId);
	if (!chain) {
		throw new Error(`Chain ${chainId} not found`);
	}
	return createPublicClient({
		chain,
		transport: http(),
	});
}
