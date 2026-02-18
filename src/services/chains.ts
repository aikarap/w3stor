import type { Chain } from "viem";
import { base, baseSepolia } from "viem/chains";

const CHAIN_REGISTRY: Record<number, Chain> = {
	[baseSepolia.id]: baseSepolia,
	[base.id]: base,
};

export function getViemChain(chainId: number): Chain {
	const chain = CHAIN_REGISTRY[chainId];
	if (!chain) throw new Error(`Unsupported chain ID: ${chainId}`);
	return chain;
}
