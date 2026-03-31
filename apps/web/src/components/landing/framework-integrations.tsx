"use client";

import { ArrowRight, Check } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { BlurFade } from "@/components/ui/blur-fade";
import { BorderBeam } from "@/components/ui/border-beam";
import { Card, CardContent } from "@/components/ui/card";
import { SpotlightGrid } from "@/components/ui/spotlight-grid";

const liveSnippet = `import { createTools } from "@w3stor/sdk/ai-sdk";
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";

const tools = await createTools({
  privateKey: process.env.PRIVATE_KEY, // EVM wallet for x402 payments
});

const { text } = await generateText({
  model: openai("gpt-4o"),
  tools,
  prompt: "Upload research.pdf to Filecoin",
});`;

const integrations = [
	{
		name: "Mastra",
		href: "/docs/mastra",
		description:
			"Agent orchestration framework with built-in w3stor integration for multi-step workflows.",
	},
	{
		name: "ElizaOS",
		href: "/docs/elizaos",
		description: "Autonomous agent OS plugin — storage actions as first-class agent capabilities.",
	},
	{
		name: "A2A Protocol",
		href: "/docs/a2a",
		description: "Agent-to-Agent communication via JSON-RPC 2.0 for cross-agent storage operations.",
	},
];

export function FrameworkIntegrations() {
	return (
		<section className="mx-auto max-w-7xl px-4 py-24">
			<BlurFade delay={0.1}>
				<p className="mb-3 text-center text-xs font-medium uppercase tracking-[0.2em] text-blue-400">
					Framework Integrations
				</p>
				<h2 className="mb-4 text-center text-3xl font-bold">Connect Any AI Framework</h2>
				<p className="mx-auto mb-12 max-w-xl text-center text-muted-foreground">
					Drop w3stor into your existing agent stack. Import tools from the SDK and start storing
					files on Filecoin in minutes.
				</p>
			</BlurFade>

			{/* Featured: Vercel AI SDK — LIVE */}
			<BlurFade delay={0.15}>
				<Card className="relative mb-8 overflow-hidden border-border/60 bg-card">
					<BorderBeam size={350} duration={10} colorFrom="#3b82f6" colorTo="#8b5cf6" />
					<CardContent className="p-0">
						<div className="grid grid-cols-1 lg:grid-cols-2">
							{/* Left: info */}
							<div className="flex flex-col justify-center p-8">
								<div className="mb-4 flex items-center gap-3">
									<span className="text-xl font-bold">Vercel AI SDK</span>
									<Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30">
										<Check className="mr-1 h-3 w-3" />
										Live
									</Badge>
								</div>
								<p className="mb-6 text-muted-foreground">
									Use w3stor as a tool in{" "}
									<code className="rounded bg-muted px-1 py-0.5 text-sm font-mono">
										generateText
									</code>{" "}
									or{" "}
									<code className="rounded bg-muted px-1 py-0.5 text-sm font-mono">streamText</code>
									. Pass files to any GPT-4o or Claude model and get back a permanent Filecoin CID —
									no extra infrastructure.
								</p>
								<Link
									href="/docs/ai-sdk"
									className="inline-flex items-center gap-2 text-sm font-medium text-blue-400 hover:text-blue-300 transition-colors"
								>
									View integration docs <ArrowRight className="h-4 w-4" />
								</Link>
							</div>

							{/* Right: code snippet */}
							<div className="border-t border-border/50 lg:border-l lg:border-t-0">
								<div className="flex items-center gap-2 border-b border-border/50 px-4 py-3">
									<div className="h-2.5 w-2.5 rounded-full bg-red-500/60" />
									<div className="h-2.5 w-2.5 rounded-full bg-yellow-500/60" />
									<div className="h-2.5 w-2.5 rounded-full bg-green-500/60" />
									<span className="ml-2 text-xs text-muted-foreground">agent.ts</span>
								</div>
								<pre className="overflow-x-auto p-6 font-mono text-sm leading-relaxed text-emerald-300">
									<code>{liveSnippet}</code>
								</pre>
							</div>
						</div>
					</CardContent>
				</Card>
			</BlurFade>

			{/* Live integration cards */}
			<SpotlightGrid glowColor="139, 92, 246" className="grid grid-cols-1 gap-4 sm:grid-cols-3">
				{integrations.map((item, i) => (
					<BlurFade key={item.name} delay={0.2 + i * 0.08}>
						<Link href={item.href}>
							<Card data-spotlight-card className="relative overflow-hidden border-border/40 bg-card/60 transition-opacity hover:opacity-100 hover:border-foreground/20">
								<CardContent className="p-6">
									<div className="mb-3 flex items-center gap-3">
										<span className="font-semibold">{item.name}</span>
										<Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-xs">
											<Check className="mr-1 h-3 w-3" />
											Live
										</Badge>
									</div>
									<p className="text-sm text-muted-foreground">{item.description}</p>
								</CardContent>
							</Card>
						</Link>
					</BlurFade>
				))}
			</SpotlightGrid>
		</section>
	);
}
