"use client";

import { CodeBlock } from "@/components/ai-elements/code-block";
import { PackageInstall } from "@/components/ai-elements/package-install";
import { BlurFade } from "@/components/ui/blur-fade";

const setupExample = `import { createTools } from "@w3stor/sdk/ai-sdk";

const { storeFile, listFiles, checkStatus, attestFile } = await createTools({
  privateKey: process.env.PRIVATE_KEY, // x402 payments handled automatically
});`;

const accountExample = `import { createTools } from "@w3stor/sdk/ai-sdk";
import { privateKeyToAccount } from "viem/accounts";

const account = privateKeyToAccount(process.env.PRIVATE_KEY as \`0x\${string}\`);

const { storeFile, listFiles, checkStatus, attestFile } = await createTools({
  account,
});`;

const generateTextExample = `import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import { createTools } from "@w3stor/sdk/ai-sdk";

const { storeFile, listFiles, checkStatus } = await createTools({
  privateKey: process.env.PRIVATE_KEY,
});

const { text } = await generateText({
  model: openai("gpt-4o"),
  tools: { storeFile, listFiles, checkStatus },
  maxSteps: 5,
  prompt: "Upload /data/research.pdf tagged 'paper,2026', then check its status.",
});`;

const streamTextExample = `import { streamText } from "ai";
import { openai } from "@ai-sdk/openai";
import { createTools } from "@w3stor/sdk/ai-sdk";

const { storeFile, listFiles, checkStatus } = await createTools({
  privateKey: process.env.PRIVATE_KEY,
});

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
import { createTools } from "@w3stor/sdk/ai-sdk";

const tools = await createTools({ privateKey: process.env.PRIVATE_KEY });

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = streamText({
    model: openai("gpt-4o"),
    tools,
    maxSteps: 5,
    system: "You are a storage assistant. Help users upload files to decentralized storage and manage their data.",
    messages,
  });

  return result.toDataStreamResponse();
}`;

export default function AiSdkPage() {
	return (
		<div className="space-y-16">
			<BlurFade delay={0}>
				<div className="space-y-4">
					<h1 className="text-4xl font-bold tracking-tight">Vercel AI SDK</h1>
					<p className="max-w-2xl text-lg text-muted-foreground">
						Import w3stor tools and plug them into{" "}
						<code className="font-mono text-foreground">generateText</code> or{" "}
						<code className="font-mono text-foreground">streamText</code>. The SDK handles x402
						payment signing automatically.
					</p>
				</div>
			</BlurFade>

			<BlurFade delay={0.05}>
				<section className="space-y-4">
					<h2 className="text-2xl font-semibold">Install</h2>
					<PackageInstall packages="@w3stor/sdk ai @ai-sdk/openai @x402/fetch @x402/evm viem" />
				</section>
			</BlurFade>

			<BlurFade delay={0.1}>
				<section className="space-y-4">
					<h2 className="text-2xl font-semibold">Setup</h2>
					<p className="text-muted-foreground">
						Pass a private key and the SDK creates an x402 payment signer for paid operations
						(upload, attest) on Base Sepolia USDC.
					</p>
					<CodeBlock code={setupExample} language="typescript" />
				</section>
			</BlurFade>

			<BlurFade delay={0.12}>
				<section className="space-y-4">
					<h2 className="text-2xl font-semibold">Using a viem Account</h2>
					<p className="text-muted-foreground">
						If you already have a viem account, pass it directly instead of a raw key.
					</p>
					<CodeBlock code={accountExample} language="typescript" />
				</section>
			</BlurFade>

			<BlurFade delay={0.15}>
				<section className="space-y-4">
					<h2 className="text-2xl font-semibold">generateText</h2>
					<p className="text-muted-foreground">
						Single-shot generation with multi-step tool calls.
					</p>
					<CodeBlock code={generateTextExample} language="typescript" />
				</section>
			</BlurFade>

			<BlurFade delay={0.2}>
				<section className="space-y-4">
					<h2 className="text-2xl font-semibold">streamText</h2>
					<p className="text-muted-foreground">
						Stream responses with real-time tool execution for chat interfaces.
					</p>
					<CodeBlock code={streamTextExample} language="typescript" />
				</section>
			</BlurFade>

			<BlurFade delay={0.25}>
				<section className="space-y-4">
					<h2 className="text-2xl font-semibold">Next.js Route Handler</h2>
					<p className="text-muted-foreground">
						Drop into a Next.js API route for a full-stack storage assistant.
					</p>
					<CodeBlock code={routeHandlerExample} language="typescript" showLineNumbers />
				</section>
			</BlurFade>
		</div>
	);
}
