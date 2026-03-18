"use client";

import { Bot, Cpu, Package, Sparkles, Terminal, Wrench } from "lucide-react";
import Link from "next/link";
import { SchemaDisplay } from "@/components/ai-elements/schema-display";
import { Snippet, SnippetCopyButton, SnippetInput } from "@/components/ai-elements/snippet";
import { BlurFade } from "@/components/ui/blur-fade";

const integrations = [
	{
		href: "/docs/cli",
		icon: Terminal,
		title: "w3stor CLI",
		desc: "Command-line tool with MCP server mode",
	},
	{
		href: "/docs/mcp",
		icon: Wrench,
		title: "MCP Server",
		desc: "Model Context Protocol for AI assistants",
	},
	{
		href: "/docs/a2a",
		icon: Cpu,
		title: "A2A Protocol",
		desc: "Agent-to-Agent communication via JSON-RPC",
	},
	{
		href: "/docs/ai-sdk",
		icon: Sparkles,
		title: "Vercel AI SDK",
		desc: "Tool definitions for generateText / streamText",
	},
	{
		href: "/docs/elizaos",
		icon: Bot,
		title: "ElizaOS",
		desc: "Plugin with action handlers for agents",
	},
	{
		href: "/docs/mastra",
		icon: Package,
		title: "Mastra",
		desc: "Workflow-based agent integration",
	},
];

export default function DocsPage() {
	return (
		<div className="space-y-16">
			{/* Hero */}
			<BlurFade delay={0}>
				<div className="space-y-4">
					<h1 className="text-4xl font-bold tracking-tight">Documentation</h1>
					<p className="max-w-2xl text-lg text-muted-foreground">
						Decentralized storage for AI agents. Upload to IPFS instantly, replicate across Filecoin
						SPs permanently. Pay per request with x402 micropayments.
					</p>
				</div>
			</BlurFade>

			{/* Quick Start */}
			<BlurFade delay={0.1}>
				<section className="space-y-4">
					<h2 className="text-2xl font-semibold">Quick Start</h2>
					<p className="text-muted-foreground">
						Upload a file with a single cURL command. Include an x402 payment header for paid
						endpoints.
					</p>
					<Snippet code='curl -X POST https://api.w3s.storage/upload -H "Content-Type: multipart/form-data" -F "file=@photo.jpg"'>
						<SnippetInput />
						<SnippetCopyButton />
					</Snippet>
				</section>
			</BlurFade>

			{/* REST API */}
			<BlurFade delay={0.15}>
				<section className="space-y-6">
					<h2 className="text-2xl font-semibold">REST API</h2>
					<p className="text-muted-foreground">
						Four endpoints power the entire storage lifecycle. Endpoints marked x402 require
						micropayment.
					</p>

					<div className="space-y-4">
						<SchemaDisplay
							method="POST"
							path="/upload"
							description="Upload a file to IPFS + Filecoin. Requires x402 payment header."
							requestBody={[
								{
									name: "file",
									type: "File",
									required: true,
									description: "The file to upload (multipart/form-data)",
								},
								{
									name: "tags",
									type: "string",
									description: "Comma-separated tags for organization",
								},
								{
									name: "replicationTarget",
									type: "number",
									description: "Number of SP replicas (default: 3)",
								},
							]}
							responseBody={[
								{
									name: "cid",
									type: "string",
									required: true,
									description: "Content identifier (CIDv1)",
								},
								{ name: "size", type: "number", required: true, description: "File size in bytes" },
								{
									name: "pinataUrl",
									type: "string",
									required: true,
									description: "IPFS gateway URL",
								},
								{
									name: "status",
									type: "string",
									required: true,
									description: "Initial status: pinned",
								},
							]}
						/>

						<SchemaDisplay
							method="GET"
							path="/status/{cid}"
							description="Check storage and replication status for a CID."
							parameters={[
								{
									name: "cid",
									type: "string",
									required: true,
									location: "path",
									description: "Content identifier to check",
								},
							]}
							responseBody={[
								{ name: "cid", type: "string", required: true, description: "The queried CID" },
								{
									name: "status",
									type: "string",
									required: true,
									description: "pinned | storing | stored | failed",
								},
								{
									name: "providers",
									type: "array",
									description: "List of SP providers storing this CID",
								},
								{
									name: "replicationCount",
									type: "number",
									description: "Number of confirmed SP replicas",
								},
							]}
						/>

						<SchemaDisplay
							method="GET"
							path="/files"
							description="List all files for the authenticated wallet."
							parameters={[
								{
									name: "status",
									type: "string",
									location: "query",
									description: "Filter by status: pinned | storing | stored",
								},
								{
									name: "limit",
									type: "number",
									location: "query",
									description: "Max results (default: 50)",
								},
								{
									name: "offset",
									type: "number",
									location: "query",
									description: "Pagination offset",
								},
							]}
							responseBody={[
								{
									name: "files",
									type: "array",
									required: true,
									description: "Array of file objects",
								},
								{ name: "total", type: "number", required: true, description: "Total file count" },
							]}
						/>

						<SchemaDisplay
							method="POST"
							path="/attest/{cid}"
							description="Create an on-chain attestation for a stored file. Requires x402 payment."
							parameters={[
								{
									name: "cid",
									type: "string",
									required: true,
									location: "path",
									description: "CID to attest",
								},
							]}
							responseBody={[
								{
									name: "attestationId",
									type: "string",
									required: true,
									description: "On-chain attestation identifier",
								},
								{ name: "txHash", type: "string", required: true, description: "Transaction hash" },
								{
									name: "timestamp",
									type: "number",
									required: true,
									description: "Unix timestamp of attestation",
								},
							]}
						/>
					</div>
				</section>
			</BlurFade>

			{/* Integration Cards */}
			<BlurFade delay={0.2}>
				<section className="space-y-6">
					<h2 className="text-2xl font-semibold">Integrations</h2>
					<p className="text-muted-foreground">
						Connect your AI agents to decentralized storage through any of these integration paths.
					</p>
					<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
						{integrations.map((item) => {
							const Icon = item.icon;
							return (
								<Link
									key={item.href}
									href={item.href}
									className="group rounded-lg border bg-card p-5 transition-colors hover:border-foreground/20 hover:bg-accent/50"
								>
									<div className="mb-3 flex items-center gap-2">
										<Icon className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
										<h3 className="font-semibold">{item.title}</h3>
									</div>
									<p className="text-sm text-muted-foreground">{item.desc}</p>
								</Link>
							);
						})}
					</div>
				</section>
			</BlurFade>
		</div>
	);
}
