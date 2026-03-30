"use client";

import { CodeBlock } from "@/components/ai-elements/code-block";
import { PackageInstall } from "@/components/ai-elements/package-install";
import { BlurFade } from "@/components/ui/blur-fade";

const setupExample = `import { createW3StorPlugin } from "@w3stor/sdk/elizaos";

const w3storPlugin = await createW3StorPlugin({
  privateKey: process.env.PRIVATE_KEY, // x402 payments handled automatically
});

// Plugin includes three actions:
//   STORE_ON_FILECOIN  — Upload files
//   LIST_STORED_FILES  — List stored files
//   CHECK_STORAGE_STATUS — Check replication`;

const accountExample = `import { createW3StorPlugin } from "@w3stor/sdk/elizaos";
import { privateKeyToAccount } from "viem/accounts";

const account = privateKeyToAccount(process.env.PRIVATE_KEY as \`0x\${string}\`);

const w3storPlugin = await createW3StorPlugin({ account });`;

const characterRegistration = `import type { Character } from "@elizaos/core";
import { createW3StorPlugin } from "@w3stor/sdk/elizaos";

const w3storPlugin = await createW3StorPlugin({
  privateKey: process.env.PRIVATE_KEY,
});

export const storageAgent: Character = {
  name: "StorageBot",
  plugins: [w3storPlugin],
  system: "You are a decentralized storage assistant. Help users upload files to IPFS and Filecoin, check storage status, and manage their data.",
  bio: [
    "Decentralized storage agent powered by Filecoin and IPFS",
    "Supports x402 micropayments for trustless file operations",
  ],
  style: {
    all: ["concise", "technical but friendly", "always include CIDs in responses"],
    chat: ["helpful", "proactive about checking replication status"],
  },
};`;

const conversationExample = `User: "Hey, can you store this CSV file for me?"
Agent: "Of course! I'll upload it to IPFS and replicate across Filecoin SPs."
       [STORE_ON_FILECOIN]
       "Done! Your file is stored:
        - CID: bafkreihdwdcefgh4dqkjv67uzcmw7ojee6xedzd
        - Size: 245 KB
        - Status: pinned (replicating to 3 SPs)
        Cost: $0.0008 USDC via x402"

User: "How's the replication going?"
Agent: [CHECK_STORAGE_STATUS]
       "Your file (bafkrei...) is fully replicated:
        - f01234: committed (sector 5891)
        - f05678: committed (sector 3204)
        - f09012: committed (sector 7712)
        All 3/3 SPs confirmed!"`;

export default function ElizaOSPage() {
	return (
		<div className="space-y-16">
			<BlurFade delay={0}>
				<div className="space-y-4">
					<h1 className="text-4xl font-bold tracking-tight">ElizaOS Plugin</h1>
					<p className="max-w-2xl text-lg text-muted-foreground">
						Add decentralized storage to any ElizaOS agent with a single import. The SDK handles
						uploads, listing, status checks, and x402 payments automatically.
					</p>
				</div>
			</BlurFade>

			<BlurFade delay={0.05}>
				<section className="space-y-4">
					<h2 className="text-2xl font-semibold">Install</h2>
					<PackageInstall packages="@w3stor/sdk @elizaos/core @x402/fetch @x402/evm viem" />
				</section>
			</BlurFade>

			<BlurFade delay={0.1}>
				<section className="space-y-4">
					<h2 className="text-2xl font-semibold">Setup</h2>
					<p className="text-muted-foreground">
						Pass a private key and the SDK creates an x402 payment signer for paid operations on
						Base Sepolia USDC.
					</p>
					<CodeBlock code={setupExample} language="typescript" />
				</section>
			</BlurFade>

			<BlurFade delay={0.12}>
				<section className="space-y-4">
					<h2 className="text-2xl font-semibold">Using a viem Account</h2>
					<p className="text-muted-foreground">
						Pass a viem account directly if you already have one.
					</p>
					<CodeBlock code={accountExample} language="typescript" />
				</section>
			</BlurFade>

			<BlurFade delay={0.15}>
				<section className="space-y-4">
					<h2 className="text-2xl font-semibold">Character Registration</h2>
					<p className="text-muted-foreground">
						Register the plugin with your ElizaOS character to enable storage capabilities.
					</p>
					<CodeBlock code={characterRegistration} language="typescript" showLineNumbers />
				</section>
			</BlurFade>

			<BlurFade delay={0.2}>
				<section className="space-y-4">
					<h2 className="text-2xl font-semibold">Example Conversation</h2>
					<p className="text-muted-foreground">
						A typical multi-turn conversation with a w3stor-enabled agent:
					</p>
					<CodeBlock code={conversationExample} language="markdown" />
				</section>
			</BlurFade>
		</div>
	);
}
