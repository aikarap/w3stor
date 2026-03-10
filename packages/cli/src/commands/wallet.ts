import { Cli, z } from "incur";
import { erc20Abi, formatUnits, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import { privateKeyFromConfig, publicClient } from "../client.ts";

// USDC on Base Sepolia
const USDC_ADDRESS = "0x036CbD53842c5426634e7929541eC2318f3dCF7e" as const;
const USDC_DECIMALS = 6;

const wallet = Cli.create("wallet", {
	description: "Wallet operations",
});

wallet.command("balance", {
	description: "Check USDC balance on Base Sepolia",
	options: z.object({
		wallet: z
			.string()
			.optional()
			.describe("Wallet address to check (defaults to configured wallet)"),
	}),
	alias: { wallet: "w" },
	output: z.object({
		wallet: z.string(),
		usdc: z.string(),
		usdcRaw: z.string(),
		chain: z.string(),
	}),
	examples: [
		{ description: "Check your USDC balance" },
		{
			options: { wallet: "0xabc..." },
			description: "Check another wallet's balance",
		},
	],
	async run(c) {
		let walletAddress: string;

		if (c.options.wallet) {
			walletAddress = c.options.wallet;
		} else {
			try {
				const pk = privateKeyFromConfig();
				walletAddress = privateKeyToAccount(pk as Hex).address;
			} catch (e) {
				return c.error({
					code: "NO_WALLET",
					message: (e as Error).message,
					retryable: true,
					cta: {
						description: "Set up your wallet first:",
						commands: [
							{
								command: "init",
								options: { auto: true },
								description: "Initialize from env var",
							},
						],
					},
				});
			}
		}

		const client = publicClient(baseSepolia.id);

		const balance = await client.readContract({
			address: USDC_ADDRESS,
			abi: erc20Abi,
			functionName: "balanceOf",
			args: [walletAddress as Hex],
		});

		const formatted = formatUnits(balance, USDC_DECIMALS);

		return c.ok(
			{
				wallet: walletAddress,
				usdc: `${formatted} USDC`,
				usdcRaw: balance.toString(),
				chain: "Base Sepolia (84532)",
			},
			{
				cta: {
					description: "Next:",
					commands: [
						{
							command: "upload",
							args: { file: "<path>" },
							description: "Upload a file (costs USDC)",
						},
						{ command: "health", description: "Check server status" },
					],
				},
			},
		);
	},
});

wallet.command("address", {
	description: "Show your configured wallet address",
	output: z.object({
		wallet: z.string(),
	}),
	run(c) {
		try {
			const pk = privateKeyFromConfig();
			const address = privateKeyToAccount(pk as Hex).address;
			return c.ok({ wallet: address });
		} catch (e) {
			return c.error({
				code: "NO_WALLET",
				message: (e as Error).message,
				retryable: true,
				cta: {
					description: "Set up your wallet first:",
					commands: [
						{
							command: "init",
							options: { auto: true },
							description: "Initialize from env var",
						},
					],
				},
			});
		}
	},
});

export { wallet };
