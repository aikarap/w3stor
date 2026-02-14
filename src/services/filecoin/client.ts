import { type Chain, calibration } from "@filoz/synapse-core/chains";
import { type Account, createWalletClient, http, type Transport, type WalletClient } from "viem";
import { privateKeyToAccount } from "viem/accounts";

export type FilecoinClient = WalletClient<Transport, Chain, Account>;

export interface ClientConfig {
	privateKey: string;
	chainId?: number;
	rpcUrl?: string;
}

export function createFilecoinClient(config: ClientConfig): FilecoinClient {
	const account = privateKeyToAccount(config.privateKey as `0x${string}`);

	const client = createWalletClient({
		account,
		chain: calibration,
		transport: http(),
	});

	return client;
}

export function getClientFromEnv(): FilecoinClient {
	const privateKey = process.env.FILECOIN_PRIVATE_KEY;
	if (!privateKey) {
		throw new Error("FILECOIN_PRIVATE_KEY environment variable is required");
	}

	return createFilecoinClient({
		privateKey,
	});
}
