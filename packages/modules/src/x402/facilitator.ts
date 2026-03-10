import { config, logger } from "@w3stor/shared";
import { x402Facilitator } from "@x402/core/facilitator";
import type { FacilitatorClient } from "@x402/core/server";
import { x402ResourceServer } from "@x402/core/server";
import type {
	PaymentPayload,
	PaymentRequirements,
	SettleResponse,
	SupportedResponse,
	VerifyResponse,
} from "@x402/core/types";
import { toFacilitatorEvmSigner } from "@x402/evm";
import { registerExactEvmScheme as registerFacilitatorEvmScheme } from "@x402/evm/exact/facilitator";
import { registerExactEvmScheme as registerServerEvmScheme } from "@x402/evm/exact/server";
import { createWalletClient, http, publicActions } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { getViemChain } from "../chains";

/**
 * Adapts a local x402Facilitator to the FacilitatorClient interface
 * so it can be used with x402ResourceServer for self-hosted settlement.
 */
class LocalFacilitatorClient implements FacilitatorClient {
	constructor(private facilitator: x402Facilitator) {}

	async verify(
		paymentPayload: PaymentPayload,
		paymentRequirements: PaymentRequirements,
	): Promise<VerifyResponse> {
		return this.facilitator.verify(paymentPayload, paymentRequirements);
	}

	async settle(
		paymentPayload: PaymentPayload,
		paymentRequirements: PaymentRequirements,
	): Promise<SettleResponse> {
		return this.facilitator.settle(paymentPayload, paymentRequirements);
	}

	getSupported() {
		return this.facilitator.getSupported() as unknown as Promise<SupportedResponse>;
	}
}

let resourceServer: x402ResourceServer | null = null;

/**
 * Returns the initialized x402ResourceServer singleton.
 * Must call initializeResourceServer() first during startup.
 */
export function getResourceServer(): x402ResourceServer {
	if (!resourceServer) {
		throw new Error("x402 resource server not initialized. Call initializeResourceServer() first.");
	}
	return resourceServer;
}

export async function initializeResourceServer(): Promise<x402ResourceServer> {
	if (resourceServer) {
		return resourceServer;
	}

	logger.info("Initializing x402 self-hosted facilitator");

	// Config validated by validateConfig() at startup
	const primaryNetwork = config.x402.networks[0];
	const viemChain = getViemChain(primaryNetwork.chainId);

	const evmAccount = privateKeyToAccount(config.x402.evmPrivateKey as `0x${string}`);
	logger.info("x402: EVM account initialized", { address: evmAccount.address });

	const viemClient = createWalletClient({
		account: evmAccount,
		chain: viemChain,
		transport: http(),
	}).extend(publicActions);

	const evmSigner = toFacilitatorEvmSigner({
		getCode: (args: { address: `0x${string}` }) => viemClient.getCode(args),
		address: evmAccount.address,
		readContract: (args: {
			address: `0x${string}`;
			abi: readonly unknown[];
			functionName: string;
			args?: readonly unknown[];
		}) =>
			viemClient.readContract({
				...args,
				args: args.args || [],
			}),
		verifyTypedData: (args: {
			address: `0x${string}`;
			domain: Record<string, unknown>;
			types: Record<string, unknown>;
			primaryType: string;
			message: Record<string, unknown>;
			signature: `0x${string}`;
		}) => viemClient.verifyTypedData(args as Parameters<typeof viemClient.verifyTypedData>[0]),
		writeContract: async (args: {
			address: `0x${string}`;
			abi: readonly unknown[];
			functionName: string;
			args: readonly unknown[];
		}) => {
			logger.debug("x402: writeContract called", {
				functionName: args.functionName,
				contractAddress: args.address,
			});
			try {
				return await viemClient.writeContract({
					...args,
					args: args.args || [],
				});
			} catch (error) {
				logger.error("x402: writeContract reverted", {
					functionName: args.functionName,
					contractAddress: args.address,
					error: error instanceof Error ? error.message : String(error),
				});
				throw error;
			}
		},
		sendTransaction: async (args: { to: `0x${string}`; data: `0x${string}` }) => {
			logger.debug("x402: sendTransaction called", { to: args.to });
			try {
				return await viemClient.sendTransaction(args);
			} catch (error) {
				logger.error("x402: sendTransaction failed", {
					to: args.to,
					error: error instanceof Error ? error.message : String(error),
				});
				throw error;
			}
		},
		waitForTransactionReceipt: (args: { hash: `0x${string}` }) =>
			viemClient.waitForTransactionReceipt(args),
	});

	// Build the local facilitator with the EVM signer
	const facilitator = new x402Facilitator();
	registerFacilitatorEvmScheme(facilitator, {
		signer: evmSigner,
		networks: primaryNetwork.network as `${string}:${string}`,
	});

	// Wrap in adapter and create resource server
	const facilitatorClient = new LocalFacilitatorClient(facilitator);
	const server = new x402ResourceServer(facilitatorClient);
	registerServerEvmScheme(server, {});

	server
		.onBeforeVerify(async (context) => {
			logger.debug("x402: Before verify", {
				network: context.paymentPayload.accepted.network,
				scheme: context.paymentPayload.accepted.scheme,
			});
		})
		.onAfterVerify(async (context) => {
			logger.info("x402: Payment verified", {
				network: context.paymentPayload.accepted.network,
				scheme: context.paymentPayload.accepted.scheme,
				isValid: context.result.isValid,
			});
		})
		.onVerifyFailure(async (context) => {
			logger.warn("x402: Verify failure", {
				network: context.paymentPayload.accepted.network,
				error: context.error?.message,
			});
		})
		.onBeforeSettle(async (context) => {
			logger.debug("x402: Before settle", {
				network: context.paymentPayload.accepted.network,
			});
		})
		.onAfterSettle(async (context) => {
			logger.info("x402: Payment settled", {
				network: context.paymentPayload.accepted.network,
				success: context.result.success,
				transaction: context.result.transaction,
			});
		})
		.onSettleFailure(async (context) => {
			logger.error("x402: Settle failure", {
				network: context.paymentPayload.accepted.network,
				scheme: context.paymentPayload.accepted.scheme,
				error: context.error?.message,
				errorStack: context.error?.stack,
			});
		});

	resourceServer = server;
	logger.info("x402: Self-hosted facilitator initialized", {
		network: primaryNetwork.network,
		chainId: primaryNetwork.chainId,
		address: evmAccount.address,
	});

	return server;
}

export async function verifyPayment(
	paymentPayload: PaymentPayload,
	paymentRequirements: PaymentRequirements,
): Promise<VerifyResponse> {
	const server = await initializeResourceServer();
	return server.verifyPayment(paymentPayload, paymentRequirements);
}

export async function settlePayment(
	paymentPayload: PaymentPayload,
	paymentRequirements: PaymentRequirements,
): Promise<SettleResponse> {
	const server = await initializeResourceServer();
	return server.settlePayment(paymentPayload, paymentRequirements);
}
