"use client";

import { useMemo } from "react";
import { useAccount, useWalletClient } from "wagmi";
import { API_URL } from "@/lib/constants";

export function useX402() {
	const { address, isConnected } = useAccount();
	const { data: walletClient } = useWalletClient();

	const isReady = useMemo(() => isConnected && !!walletClient, [isConnected, walletClient]);

	async function x402Fetch(path: string, init: RequestInit = {}) {
		if (!walletClient || !address) {
			throw new Error("Wallet not connected");
		}

		const url = `${API_URL}${path}`;
		const firstResponse = await fetch(url, init);

		if (firstResponse.status !== 402) {
			return firstResponse;
		}

		// Build x402 client with EVM scheme using the connected wallet
		const { wrapFetchWithPayment, x402Client } = await import("@x402/fetch");
		const { ExactEvmScheme } = await import("@x402/evm/exact/client");
		const { publicActions } = await import("viem");

		const extended = walletClient.extend(publicActions);
		// ExactEvmScheme expects signer.address at top level,
		// but wagmi wallet clients store it at .account.address
		const signer = Object.assign(extended, { address: address as `0x${string}` });
		const client = new x402Client().register("eip155:84532", new ExactEvmScheme(signer as any));

		const paidFetch = wrapFetchWithPayment(fetch, client);
		return paidFetch(url, init);
	}

	return { x402Fetch, isReady, address };
}
