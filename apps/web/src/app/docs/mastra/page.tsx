"use client";

import { CodeBlock } from "@/components/ai-elements/code-block";
import { Snippet, SnippetCopyButton, SnippetInput } from "@/components/ai-elements/snippet";
import { BlurFade } from "@/components/ui/blur-fade";

const mastraTools = `import { createTool } from "@mastra/core";
import { z } from "zod";

const W3S_API = process.env.W3S_API_URL ?? "https://api.w3s.storage";

export const uploadTool = createTool({
  id: "w3s-upload",
  description: "Upload a file to IPFS and replicate across Filecoin storage providers",
  inputSchema: z.object({
    filePath: z.string().describe("Path to the file to upload"),
    tags: z.string().optional().describe("Comma-separated tags"),
    replicationTarget: z.number().default(3).describe("Number of SP replicas"),
  }),
  outputSchema: z.object({
    cid: z.string(),
    size: z.number(),
    pinataUrl: z.string(),
    status: z.string(),
  }),
  execute: async ({ context }) => {
    const formData = new FormData();
    const file = await fetch(context.filePath).then((r) => r.blob());
    formData.append("file", file);
    if (context.tags) formData.append("tags", context.tags);
    formData.append("replicationTarget", String(context.replicationTarget));

    const res = await fetch(\`\${W3S_API}/upload\`, {
      method: "POST",
      body: formData,
    });
    return res.json();
  },
});

export const listTool = createTool({
  id: "w3s-list",
  description: "List files stored in decentralized storage",
  inputSchema: z.object({
    status: z.enum(["pinned", "storing", "stored"]).optional(),
    limit: z.number().default(50),
  }),
  outputSchema: z.object({
    files: z.array(z.object({
      cid: z.string(),
      size: z.number(),
      status: z.string(),
    })),
    total: z.number(),
  }),
  execute: async ({ context }) => {
    const params = new URLSearchParams();
    if (context.status) params.set("status", context.status);
    params.set("limit", String(context.limit));

    const res = await fetch(\`\${W3S_API}/files?\${params}\`);
    return res.json();
  },
});

export const statusTool = createTool({
  id: "w3s-status",
  description: "Check replication status for a CID",
  inputSchema: z.object({
    cid: z.string().describe("Content identifier to check"),
  }),
  outputSchema: z.object({
    cid: z.string(),
    status: z.string(),
    replicationCount: z.number(),
    providers: z.array(z.string()),
  }),
  execute: async ({ context }) => {
    const res = await fetch(\`\${W3S_API}/status/\${context.cid}\`);
    return res.json();
  },
});

export const attestTool = createTool({
  id: "w3s-attest",
  description: "Create an on-chain attestation for a stored file",
  inputSchema: z.object({
    cid: z.string().describe("CID to attest"),
  }),
  outputSchema: z.object({
    attestationId: z.string(),
    txHash: z.string(),
    timestamp: z.number(),
  }),
  execute: async ({ context }) => {
    const res = await fetch(\`\${W3S_API}/attest/\${context.cid}\`, {
      method: "POST",
    });
    return res.json();
  },
});`;

const agentConfig = `import { Agent } from "@mastra/core";
import { uploadTool, listTool, statusTool, attestTool } from "./tools";

export const storageAgent = new Agent({
  name: "w3stor-agent",
  instructions: \`You are a decentralized storage agent. Help users upload files
to IPFS and Filecoin, check replication status, and create on-chain
attestations. Use x402 micropayments for paid operations (upload, attest).
Always report CIDs and replication counts in your responses.\`,
  model: {
    provider: "OPEN_AI",
    name: "gpt-4o",
  },
  tools: {
    upload: uploadTool,
    list: listTool,
    status: statusTool,
    attest: attestTool,
  },
});`;

const workflowExample = `import { Workflow, Step } from "@mastra/core";
import { z } from "zod";
import { uploadTool, statusTool, attestTool } from "./tools";

const uploadAndVerify = new Workflow({
  name: "upload-verify-attest",
  triggerSchema: z.object({
    filePath: z.string(),
    tags: z.string().optional(),
  }),
});

// Step 1: Upload file
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

// Step 2: Wait for replication and verify
const verifyStep = new Step({
  id: "verify",
  execute: async ({ context }) => {
    const { cid } = context.getStepResult<{ cid: string }>("upload");

    // Poll for replication completion
    let status;
    let attempts = 0;
    do {
      await new Promise((r) => setTimeout(r, 10000)); // wait 10s
      status = await statusTool.execute({ context: { cid } });
      attempts++;
    } while (status.status !== "stored" && attempts < 30);

    return {
      cid,
      status: status.status,
      replicationCount: status.replicationCount,
      providers: status.providers,
    };
  },
});

// Step 3: Create attestation once verified
const attestStep = new Step({
  id: "attest",
  execute: async ({ context }) => {
    const { cid, status } = context.getStepResult<{
      cid: string;
      status: string;
    }>("verify");

    if (status !== "stored") {
      return { error: "File not fully replicated, skipping attestation" };
    }

    const attestation = await attestTool.execute({ context: { cid } });
    return {
      cid,
      attestationId: attestation.attestationId,
      txHash: attestation.txHash,
    };
  },
});

// Chain the steps
uploadAndVerify
  .step(uploadStep)
  .then(verifyStep)
  .then(attestStep)
  .commit();

// Execute the workflow
const run = await uploadAndVerify.execute({
  triggerData: {
    filePath: "/data/research-paper.pdf",
    tags: "paper,2026,reviewed",
  },
});

console.log("Workflow result:", run.results);`;

export default function MastraPage() {
	return (
		<div className="space-y-16">
			{/* Hero */}
			<BlurFade delay={0}>
				<div className="space-y-4">
					<h1 className="text-4xl font-bold tracking-tight">Mastra Integration</h1>
					<p className="max-w-2xl text-lg text-muted-foreground">
						Build workflow-based storage agents with Mastra. Define tools, configure agents, and
						chain operations into automated pipelines.
					</p>
				</div>
			</BlurFade>

			{/* Install */}
			<BlurFade delay={0.05}>
				<section className="space-y-4">
					<h2 className="text-2xl font-semibold">Install</h2>
					<Snippet code="bun add mastra @mastra/core">
						<SnippetInput />
						<SnippetCopyButton />
					</Snippet>
				</section>
			</BlurFade>

			{/* Tool Definitions */}
			<BlurFade delay={0.1}>
				<section className="space-y-4">
					<h2 className="text-2xl font-semibold">Define W3S Tools</h2>
					<p className="text-muted-foreground">
						Each tool uses <code className="font-mono text-foreground">createTool</code> with Zod
						schemas for input validation and typed outputs. Four tools cover the full storage
						lifecycle.
					</p>
					<CodeBlock code={mastraTools} language="typescript" showLineNumbers />
				</section>
			</BlurFade>

			{/* Agent Configuration */}
			<BlurFade delay={0.15}>
				<section className="space-y-4">
					<h2 className="text-2xl font-semibold">Agent Configuration</h2>
					<p className="text-muted-foreground">
						Create a Mastra agent with all w3stor tools. The agent uses the instructions to decide
						which tool to call based on user requests.
					</p>
					<CodeBlock code={agentConfig} language="typescript" />
				</section>
			</BlurFade>

			{/* Workflow */}
			<BlurFade delay={0.2}>
				<section className="space-y-4">
					<h2 className="text-2xl font-semibold">Workflow: Upload, Verify, Attest</h2>
					<p className="text-muted-foreground">
						Chain storage operations into an automated pipeline. This workflow uploads a file, polls
						for full replication across 3 SPs, then creates an on-chain attestation.
					</p>
					<CodeBlock code={workflowExample} language="typescript" showLineNumbers />
				</section>
			</BlurFade>
		</div>
	);
}
