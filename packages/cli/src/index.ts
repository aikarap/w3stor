#!/usr/bin/env node
import { Cli } from "incur";
import { registerAttest } from "./commands/attest.ts";
import { registerAuth } from "./commands/auth.ts";
import { registerFiles } from "./commands/files.ts";
import { registerGraph } from "./commands/graph.ts";
import { registerHealth } from "./commands/health.ts";
import { registerInit } from "./commands/init.ts";
import { registerStatus } from "./commands/status.ts";
import { registerUpload } from "./commands/upload.ts";
import { registerBatchUpload } from "./commands/batch-upload.ts";
import { wallet } from "./commands/wallet.ts";

const cli = Cli.create("w3stor", {
	version: "1.0.0",
	description: "CLI for Web3 Storage Agent — decentralized storage on Filecoin with x402 payments.",
	sync: {
		include: ["_root"],
		suggestions: [
			"initialize wallet with w3stor init --auto",
			"upload a file to Web3 Storage Agent",
			"list your files in Web3 Storage Agent",
			"check the replication status of a file across Pinata and Filecoin SPs",
			"check your USDC wallet balance on Base Sepolia",
		],
	},
});

// Register all commands
registerInit(cli);
registerAuth(cli);
registerUpload(cli);
registerBatchUpload(cli);
registerFiles(cli);
registerStatus(cli);
registerAttest(cli);
registerGraph(cli);
registerHealth(cli);
cli.command(wallet);

cli.serve();

export default cli;
