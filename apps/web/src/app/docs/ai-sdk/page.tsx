"use client";

import { CodeBlock } from "@/components/ai-elements/code-block";
import { Snippet, SnippetCopyButton, SnippetInput } from "@/components/ai-elements/snippet";
import { BlurFade } from "@/components/ui/blur-fade";

const toolDefinitions = `import { tool } from "ai";
import { z } from "zod";

const W3S_API = "https://api.w3s.storage";

export const storeFile = tool({
  description: "Upload a file to decentralized storage (IPFS + Filecoin)",
  parameters: z.object({
    filePath: z.string().describe("Path to the file to upload"),
    tags: z.string().optional().describe("Comma-separated tags"),
    replicationTarget: z.number().default(3).describe("Number of SP replicas"),
  }),
  execute: async ({ filePath, tags, replicationTarget }) => {
    const formData = new FormData();
    const file = await fetch(filePath).then((r) => r.blob());
    formData.append("file", file);
    if (tags) formData.append("tags", tags);
    if (replicationTarget) formData.append("replicationTarget", String(replicationTarget));

    const res = await fetch(\`\${W3S_API}/upload\`, {
      method: "POST",
      body: formData,
    });
    return res.json();
  },
});

export const listFiles = tool({
  description: "List files stored in decentralized storage",
  parameters: z.object({
    status: z.enum(["pinned", "storing", "stored"]).optional(),
    limit: z.number().default(50),
  }),
  execute: async ({ status, limit }) => {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    params.set("limit", String(limit));

    const res = await fetch(\`\${W3S_API}/files?\${params}\`);
    return res.json();
  },
});

export const checkStatus = tool({
  description: "Check replication status for a CID",
  parameters: z.object({
    cid: z.string().describe("Content identifier to check"),
  }),
  execute: async ({ cid }) => {
    const res = await fetch(\`\${W3S_API}/status/\${cid}\`);
    return res.json();
  },
});`;

const generateTextExample = `import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import { storeFile, listFiles, checkStatus } from "./tools";

const { text } = await generateText({
  model: openai("gpt-4o"),
  tools: { storeFile, listFiles, checkStatus },
  maxSteps: 5,
  prompt: "Upload the file at /data/research.pdf and tag it as 'paper,2026'. Then check its replication status.",
});

console.log(text);
// "I've uploaded research.pdf (bafkrei...). It's currently pinned on IPFS
//  and replicating to 3 Filecoin SPs. 1 of 3 confirmed so far."`;

const streamTextExample = `import { streamText } from "ai";
import { openai } from "@ai-sdk/openai";
import { storeFile, listFiles, checkStatus } from "./tools";

const result = streamText({
  model: openai("gpt-4o"),
  tools: { storeFile, listFiles, checkStatus },
  maxSteps: 5,
  prompt: "Show me all my stored files and their replication status.",
});

for await (const chunk of result.textStream) {
  process.stdout.write(chunk);
}`;

const routeHandlerExample = `// app/api/storage/route.ts
import { streamText } from "ai";
import { openai } from "@ai-sdk/openai";
import { storeFile, listFiles, checkStatus } from "@/lib/w3s-tools";

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = streamText({
    model: openai("gpt-4o"),
    tools: { storeFile, listFiles, checkStatus },
    maxSteps: 5,
    system: \`You are a storage assistant. Help users upload files to
decentralized storage, check their file status, and manage
their stored data. Use x402 micropayments for paid operations.\`,
    messages,
  });

  return result.toDataStreamResponse();
}`;

export default function AiSdkPage() {
	return (
		<div className="space-y-16">
			{/* Hero */}
			<BlurFade delay={0}>
				<div className="space-y-4">
					<h1 className="text-4xl font-bold tracking-tight">Vercel AI SDK</h1>
					<p className="max-w-2xl text-lg text-muted-foreground">
						Define w3stor tools with Zod schemas and plug them into{" "}
						<code className="font-mono text-foreground">generateText</code> or{" "}
						<code className="font-mono text-foreground">streamText</code>. Your AI model decides
						when to store, list, or check files.
					</p>
				</div>
			</BlurFade>

			{/* Install */}
			<BlurFade delay={0.05}>
				<section className="space-y-4">
					<h2 className="text-2xl font-semibold">Install</h2>
					<Snippet code="bun add ai @ai-sdk/openai zod">
						<SnippetInput />
						<SnippetCopyButton />
					</Snippet>
				</section>
			</BlurFade>

			{/* Tool Definitions */}
			<BlurFade delay={0.1}>
				<section className="space-y-4">
					<h2 className="text-2xl font-semibold">Define Storage Tools</h2>
					<p className="text-muted-foreground">
						Each tool wraps a w3stor API call with a Zod schema. The AI model sees the descriptions
						and decides which tool to invoke based on user intent.
					</p>
					<CodeBlock code={toolDefinitions} language="typescript" showLineNumbers />
				</section>
			</BlurFade>

			{/* generateText */}
			<BlurFade delay={0.15}>
				<section className="space-y-4">
					<h2 className="text-2xl font-semibold">Usage with generateText</h2>
					<p className="text-muted-foreground">
						Single-shot generation with tool calls. The model will automatically invoke tools across
						multiple steps to fulfill the request.
					</p>
					<CodeBlock code={generateTextExample} language="typescript" />
				</section>
			</BlurFade>

			{/* streamText */}
			<BlurFade delay={0.2}>
				<section className="space-y-4">
					<h2 className="text-2xl font-semibold">Usage with streamText</h2>
					<p className="text-muted-foreground">
						Stream responses with real-time tool execution. Ideal for chat interfaces where you want
						to show progress as the agent works.
					</p>
					<CodeBlock code={streamTextExample} language="typescript" />
				</section>
			</BlurFade>

			{/* Route Handler */}
			<BlurFade delay={0.25}>
				<section className="space-y-4">
					<h2 className="text-2xl font-semibold">Next.js Route Handler</h2>
					<p className="text-muted-foreground">
						Integrate into a Next.js app with a route handler. The client-side chat UI sends
						messages, and the server streams back responses with tool results.
					</p>
					<CodeBlock code={routeHandlerExample} language="typescript" showLineNumbers />
				</section>
			</BlurFade>
		</div>
	);
}
