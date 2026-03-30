"use client";

import { CodeBlock } from "@/components/ai-elements/code-block";
import { PackageInstall } from "@/components/ai-elements/package-install";
import { BlurFade } from "@/components/ui/blur-fade";

const setupExample = `import { createTools } from "@w3stor/sdk/mastra";

const { uploadTool, listTool, statusTool, attestTool } = await createTools({
  privateKey: process.env.PRIVATE_KEY, // x402 payments handled automatically
});`;

const accountExample = `import { createTools } from "@w3stor/sdk/mastra";
import { privateKeyToAccount } from "viem/accounts";

const account = privateKeyToAccount(process.env.PRIVATE_KEY as \`0x\${string}\`);

const { uploadTool, listTool, statusTool, attestTool } = await createTools({
  account,
});`;

const agentConfig = `import { Agent } from "@mastra/core";
import { createTools } from "@w3stor/sdk/mastra";

const { uploadTool, listTool, statusTool, attestTool } = await createTools({
  privateKey: process.env.PRIVATE_KEY,
});

export const storageAgent = new Agent({
  name: "w3stor-agent",
  instructions: "You are a decentralized storage agent. Help users upload files to IPFS and Filecoin, check replication status, and create attestations.",
  model: { provider: "OPEN_AI", name: "gpt-4o" },
  tools: {
    upload: uploadTool,
    list: listTool,
    status: statusTool,
    attest: attestTool,
  },
});`;

const workflowExample = `import { Workflow, Step } from "@mastra/core";
import { z } from "zod";
import { createTools } from "@w3stor/sdk/mastra";

const { uploadTool, statusTool, attestTool } = await createTools({
  privateKey: process.env.PRIVATE_KEY,
});

const uploadAndVerify = new Workflow({
  name: "upload-verify-attest",
  triggerSchema: z.object({
    filePath: z.string(),
    tags: z.string().optional(),
  }),
});

const uploadStep = new Step({
  id: "upload",
  execute: async ({ context }) => {
    const result = await uploadTool.execute({
      context: {
        filePath: context.triggerData.filePath,
        tags: context.triggerData.tags,
        replicationTarget: 3,
      },
    });
    return { cid: result.cid, size: result.size };
  },
});

const verifyStep = new Step({
  id: "verify",
  execute: async ({ context }) => {
    const { cid } = context.getStepResult<{ cid: string }>("upload");
    let status;
    let attempts = 0;
    do {
      await new Promise((r) => setTimeout(r, 10000));
      status = await statusTool.execute({ context: { cid } });
      attempts++;
    } while (status.status !== "stored" && attempts < 30);
    return { cid, status: status.status, replicationCount: status.replicationCount };
  },
});

const attestStep = new Step({
  id: "attest",
  execute: async ({ context }) => {
    const { cid, status } = context.getStepResult<{ cid: string; status: string }>("verify");
    if (status !== "stored") return { error: "Not fully replicated" };
    return attestTool.execute({ context: { cid } });
  },
});

uploadAndVerify.step(uploadStep).then(verifyStep).then(attestStep).commit();

const run = await uploadAndVerify.execute({
  triggerData: { filePath: "/data/research-paper.pdf", tags: "paper,2026" },
});
console.log("Result:", run.results);`;

export default function MastraPage() {
	return (
		<div className="space-y-16">
			<BlurFade delay={0}>
				<div className="space-y-4">
					<h1 className="text-4xl font-bold tracking-tight">Mastra Integration</h1>
					<p className="max-w-2xl text-lg text-muted-foreground">
						Import w3stor tools and use them in Mastra agents and workflows. The SDK handles x402
						payment signing automatically.
					</p>
				</div>
			</BlurFade>

			<BlurFade delay={0.05}>
				<section className="space-y-4">
					<h2 className="text-2xl font-semibold">Install</h2>
					<PackageInstall packages="@w3stor/sdk @mastra/core zod @x402/fetch @x402/evm viem" />
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
					<h2 className="text-2xl font-semibold">Agent Configuration</h2>
					<p className="text-muted-foreground">
						Create a Mastra agent with all four w3stor tools.
					</p>
					<CodeBlock code={agentConfig} language="typescript" showLineNumbers />
				</section>
			</BlurFade>

			<BlurFade delay={0.2}>
				<section className="space-y-4">
					<h2 className="text-2xl font-semibold">Workflow: Upload, Verify, Attest</h2>
					<p className="text-muted-foreground">
						Chain storage operations into an automated pipeline that uploads, waits for replication,
						then creates an on-chain attestation.
					</p>
					<CodeBlock code={workflowExample} language="typescript" showLineNumbers />
				</section>
			</BlurFade>
		</div>
	);
}
