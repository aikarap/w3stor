"use client";

import {
	Agent,
	AgentContent,
	AgentHeader,
	AgentInstructions,
	AgentTool,
	AgentTools,
} from "@/components/ai-elements/agent";
import { CodeBlock } from "@/components/ai-elements/code-block";
import { PackageInstall } from "@/components/ai-elements/package-install";
import { Snippet, SnippetCopyButton, SnippetInput } from "@/components/ai-elements/snippet";
import {
	Terminal,
	TerminalActions,
	TerminalContent,
	TerminalCopyButton,
	TerminalHeader,
	TerminalTitle,
} from "@/components/ai-elements/terminal";
import { Badge } from "@/components/ui/badge";
import { BlurFade } from "@/components/ui/blur-fade";

const initOutput = `\x1b[36m  w3stor init\x1b[0m
\x1b[32m✓\x1b[0m Wallet configured: 0xabc...def
\x1b[32m✓\x1b[0m Connected to Filecoin Calibration
\x1b[32m✓\x1b[0m Pinata API key validated
\x1b[32m✓\x1b[0m SP providers loaded (3 active)
\x1b[32m✓\x1b[0m x402 facilitator ready

\x1b[1m\x1b[32mReady!\x1b[0m Configuration saved to ~/.w3stor/config.json`;

const healthOutput = `\x1b[36m  w3stor health\x1b[0m

\x1b[1mService Status\x1b[0m
  \x1b[32m●\x1b[0m  API Server        \x1b[32mhealthy\x1b[0m    4ms
  \x1b[32m●\x1b[0m  Pinata IPFS       \x1b[32mhealthy\x1b[0m   48ms
  \x1b[32m●\x1b[0m  Filecoin RPC      \x1b[32mhealthy\x1b[0m  120ms
  \x1b[32m●\x1b[0m  SP: f01234        \x1b[32mhealthy\x1b[0m   85ms
  \x1b[32m●\x1b[0m  SP: f05678        \x1b[32mhealthy\x1b[0m   92ms
  \x1b[32m●\x1b[0m  SP: f09012        \x1b[32mhealthy\x1b[0m  110ms
  \x1b[32m●\x1b[0m  x402 Facilitator  \x1b[32mhealthy\x1b[0m   15ms

\x1b[32mAll services operational\x1b[0m`;

const uploadOutput = `\x1b[36m  w3stor upload photo.jpg --tags "robotics,research"\x1b[0m

\x1b[2mPinning to IPFS...\x1b[0m
\x1b[32m✓\x1b[0m Pinned to Pinata  \x1b[2m(1.2s)\x1b[0m

\x1b[2mReplicating to Filecoin SPs...\x1b[0m
  \x1b[32m✓\x1b[0m f01234  CAR stored   \x1b[2m(3.4s)\x1b[0m
  \x1b[33m⟳\x1b[0m f05678  pulling...
  \x1b[33m⟳\x1b[0m f09012  pulling...

\x1b[1mCID:\x1b[0m  bafkreihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenora
\x1b[1mSize:\x1b[0m 2.4 MB
\x1b[1mURL:\x1b[0m  https://gateway.pinata.cloud/ipfs/bafkreihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenora
\x1b[1mCost:\x1b[0m $0.0024 USDC (x402)`;

const filesOutput = `\x1b[36m  w3stor files --status stored\x1b[0m

\x1b[1m  CID                                            Size     Status   SPs  Tags\x1b[0m
  bafkreihdwdcefgh4dqkjv67uzcmw7ojee6xedzd...   2.4 MB   \x1b[32mstored\x1b[0m   3/3  robotics,research
  bafkreiabcdefgh5eqlmn89012uvwx3456yzabcd...   890 KB   \x1b[32mstored\x1b[0m   3/3  dataset,v2
  bafkreiqrstuvwx6yzabcdefgh7890ijklmnopqr...   15.1 MB  \x1b[32mstored\x1b[0m   3/3  model-weights
  bafkreijklmnopqr8stabcdefgh9012uvwxyzabc...   4.7 MB   \x1b[32mstored\x1b[0m   2/3  paper,draft

\x1b[2m4 files, 23.1 MB total\x1b[0m`;

const statusOutput = `\x1b[36m  w3stor status bafkreihdwdcefgh4dqkjv67uzcmw7ojee6xedzd\x1b[0m

\x1b[1mCID:\x1b[0m     bafkreihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenora
\x1b[1mStatus:\x1b[0m  \x1b[32mstored\x1b[0m
\x1b[1mSize:\x1b[0m    2.4 MB
\x1b[1mCreated:\x1b[0m 2026-03-28T10:15:00Z

\x1b[1mReplication:\x1b[0m 3/3 SPs confirmed
  \x1b[32m●\x1b[0m f01234  \x1b[32mcommitted\x1b[0m  sector 5891  2026-03-28T10:18:22Z
  \x1b[32m●\x1b[0m f05678  \x1b[32mcommitted\x1b[0m  sector 3204  2026-03-28T10:19:45Z
  \x1b[32m●\x1b[0m f09012  \x1b[32mcommitted\x1b[0m  sector 7712  2026-03-28T10:20:01Z

\x1b[1mAttestation:\x1b[0m \x1b[32mverified\x1b[0m  tx:0xabc123...
\x1b[1mIPNI:\x1b[0m        \x1b[32mindexed\x1b[0m   3 providers`;

const walletOutput = `\x1b[36m  w3stor wallet balance\x1b[0m

\x1b[1mWallet:\x1b[0m 0xabc...def (Filecoin Calibration)

\x1b[1mBalances:\x1b[0m
  USDC   \x1b[32m$42.50\x1b[0m
  FIL    \x1b[33m0.85\x1b[0m

\x1b[1mSpending (30d):\x1b[0m
  Uploads      $1.24  (52 files)
  Attestations $0.18  (3 certs)
  \x1b[2mTotal        $1.42\x1b[0m`;

const claudeDesktopConfig = `{
  "mcpServers": {
    "w3stor": {
      "command": "w3stor",
      "args": ["--mcp"]
    }
  }
}`;

const allCommands = [
	{ cmd: "w3stor init", desc: "Configure wallet and SP providers", paid: false },
	{ cmd: "w3stor health", desc: "Check all service statuses", paid: false },
	{ cmd: "w3stor upload <file>", desc: "Upload file to IPFS + Filecoin", paid: true },
	{ cmd: "w3stor files", desc: "List stored files", paid: false },
	{ cmd: "w3stor status <cid>", desc: "Check replication status", paid: false },
	{ cmd: "w3stor attest <cid>", desc: "Create on-chain attestation", paid: true },
	{ cmd: "w3stor auth login", desc: "SIWE session auth for graph reads", paid: false },
	{ cmd: "w3stor graph add <cid>", desc: "Add file to agent memory", paid: true },
	{ cmd: "w3stor graph connect <from> <to>", desc: "Create file relationship", paid: true },
	{ cmd: "w3stor graph search <query>", desc: "Semantic search across files", paid: false },
	{ cmd: "w3stor graph traverse <cid>", desc: "Explore connected files", paid: false },
	{ cmd: "w3stor graph remove <cid>", desc: "Remove file from memory graph", paid: false },
	{ cmd: "w3stor wallet balance", desc: "Show wallet balances", paid: false },
	{ cmd: "w3stor wallet fund", desc: "Fund wallet with USDC", paid: false },
	{ cmd: "w3stor --mcp", desc: "Start as MCP server", paid: false },
	{ cmd: "w3stor mcp add", desc: "Register with Claude Code", paid: false },
];

import { jsonSchema, type Tool } from "ai";

const agentTools: Tool[] = [
	{
		type: "function" as const,
		description: "web3_storage_upload — Upload a file to decentralized storage (x402)",
		inputSchema: jsonSchema({
			type: "object",
			properties: {
				file: { type: "string", description: "File path or URL to upload" },
				tags: { type: "string", description: "Comma-separated tags" },
				replicationTarget: { type: "number", description: "Number of SP replicas", default: 3 },
			},
			required: ["file"],
		}),
	},
	{
		type: "function" as const,
		description: "web3_storage_list — List stored files (free)",
		inputSchema: jsonSchema({
			type: "object",
			properties: {
				status: { type: "string", enum: ["pinned", "storing", "stored"] },
				limit: { type: "number", default: 50 },
			},
		}),
	},
	{
		type: "function" as const,
		description: "web3_storage_status — Check CID replication status (free)",
		inputSchema: jsonSchema({
			type: "object",
			properties: {
				cid: { type: "string", description: "Content identifier to check" },
			},
			required: ["cid"],
		}),
	},
	{
		type: "function" as const,
		description: "web3_storage_attest — Create on-chain attestation (x402)",
		inputSchema: jsonSchema({
			type: "object",
			properties: {
				cid: { type: "string", description: "CID to attest" },
			},
			required: ["cid"],
		}),
	},
	{
		type: "function" as const,
		description: "graph_add_file — Add file to agent memory with embeddings (x402)",
		inputSchema: jsonSchema({
			type: "object",
			properties: {
				cid: { type: "string", description: "CID of file to add" },
				description: { type: "string", description: "Description for semantic search" },
				tags: { type: "array", items: { type: "string" }, description: "Tags for organization" },
			},
			required: ["cid"],
		}),
	},
	{
		type: "function" as const,
		description: "graph_search — Semantic search across agent memory (SIWE)",
		inputSchema: jsonSchema({
			type: "object",
			properties: {
				query: { type: "string", description: "Natural language search query" },
				limit: { type: "number", description: "Max results", default: 10 },
			},
			required: ["query"],
		}),
	},
	{
		type: "function" as const,
		description: "graph_connect_files — Create relationship between files (x402)",
		inputSchema: jsonSchema({
			type: "object",
			properties: {
				fromCid: { type: "string", description: "Source file CID" },
				toCid: { type: "string", description: "Target file CID" },
				relationship: { type: "string", description: "Edge label (e.g. references, derived_from)" },
			},
			required: ["fromCid", "toCid", "relationship"],
		}),
	},
];

export default function CLIPage() {
	return (
		<div className="space-y-16">
			{/* Hero */}
			<BlurFade delay={0}>
				<div className="space-y-4">
					<div className="flex items-center gap-3">
						<h1 className="text-4xl font-bold tracking-tight">w3stor CLI</h1>
						<Badge variant="secondary" className="text-xs">
							v0.1.0
						</Badge>
					</div>
					<p className="max-w-2xl text-lg text-muted-foreground">
						A command-line tool for decentralized agent memory and storage. Upload files, build
						knowledge graphs, semantic search, manage replications, and run as an MCP server for AI
						assistants -- all from your terminal.
					</p>
				</div>
			</BlurFade>

			{/* Installation */}
			<BlurFade delay={0.05}>
				<section className="space-y-4">
					<h2 className="text-2xl font-semibold">Installation</h2>
					<div className="space-y-3">
						<div>
							<p className="mb-2 text-sm text-muted-foreground">From source:</p>
							<Snippet code="bun install && bun run skills:build && bun link">
								<SnippetInput />
								<SnippetCopyButton />
							</Snippet>
						</div>
						<div>
							<p className="mb-2 text-sm text-muted-foreground">Via package manager:</p>
							<PackageInstall packages="@w3stor/cli" global />
						</div>
					</div>
				</section>
			</BlurFade>

			{/* Terminal Demos */}
			<BlurFade delay={0.1}>
				<section className="space-y-6">
					<h2 className="text-2xl font-semibold">Interactive Demos</h2>

					<div className="space-y-2">
						<h3 className="text-lg font-medium">Initialize</h3>
						<Terminal output={initOutput}>
							<TerminalHeader>
								<TerminalTitle>w3stor init</TerminalTitle>
								<TerminalActions>
									<TerminalCopyButton />
								</TerminalActions>
							</TerminalHeader>
							<TerminalContent />
						</Terminal>
					</div>

					<div className="space-y-2">
						<h3 className="text-lg font-medium">Health Check</h3>
						<Terminal output={healthOutput}>
							<TerminalHeader>
								<TerminalTitle>w3stor health</TerminalTitle>
								<TerminalActions>
									<TerminalCopyButton />
								</TerminalActions>
							</TerminalHeader>
							<TerminalContent />
						</Terminal>
					</div>

					<div className="space-y-2">
						<h3 className="text-lg font-medium">Upload a File</h3>
						<Terminal output={uploadOutput}>
							<TerminalHeader>
								<TerminalTitle>w3stor upload</TerminalTitle>
								<TerminalActions>
									<TerminalCopyButton />
								</TerminalActions>
							</TerminalHeader>
							<TerminalContent />
						</Terminal>
					</div>

					<div className="space-y-2">
						<h3 className="text-lg font-medium">List Files</h3>
						<Terminal output={filesOutput}>
							<TerminalHeader>
								<TerminalTitle>w3stor files</TerminalTitle>
								<TerminalActions>
									<TerminalCopyButton />
								</TerminalActions>
							</TerminalHeader>
							<TerminalContent />
						</Terminal>
					</div>

					<div className="space-y-2">
						<h3 className="text-lg font-medium">Replication Status</h3>
						<Terminal output={statusOutput}>
							<TerminalHeader>
								<TerminalTitle>w3stor status</TerminalTitle>
								<TerminalActions>
									<TerminalCopyButton />
								</TerminalActions>
							</TerminalHeader>
							<TerminalContent />
						</Terminal>
					</div>

					<div className="space-y-2">
						<h3 className="text-lg font-medium">Wallet Balance</h3>
						<Terminal output={walletOutput}>
							<TerminalHeader>
								<TerminalTitle>w3stor wallet</TerminalTitle>
								<TerminalActions>
									<TerminalCopyButton />
								</TerminalActions>
							</TerminalHeader>
							<TerminalContent />
						</Terminal>
					</div>
				</section>
			</BlurFade>

			{/* MCP Integration */}
			<BlurFade delay={0.15}>
				<section className="space-y-6">
					<h2 className="text-2xl font-semibold">MCP Integration</h2>
					<p className="text-muted-foreground">
						Run w3stor as a Model Context Protocol server so AI assistants can store files directly.
					</p>

					<div className="space-y-4">
						<div className="space-y-2">
							<h3 className="text-lg font-medium">Start as MCP Server</h3>
							<Snippet code="w3stor --mcp">
								<SnippetInput />
								<SnippetCopyButton />
							</Snippet>
						</div>

						<div className="space-y-2">
							<h3 className="text-lg font-medium">Claude Desktop Config</h3>
							<CodeBlock code={claudeDesktopConfig} language="json" />
						</div>

						<div className="space-y-2">
							<h3 className="text-lg font-medium">Claude Code</h3>
							<Snippet code="w3stor mcp add">
								<SnippetInput />
								<SnippetCopyButton />
							</Snippet>
						</div>
					</div>
				</section>
			</BlurFade>

			{/* Agent Card */}
			<BlurFade delay={0.2}>
				<section className="space-y-6">
					<h2 className="text-2xl font-semibold">Agent Card</h2>
					<p className="text-muted-foreground">
						The w3stor agent exposes these tools via MCP and A2A protocols.
					</p>
					<Agent>
						<AgentHeader name="w3stor" model="MCP + A2A" />
						<AgentContent>
							<AgentInstructions>
								You are a decentralized storage agent. Upload files to IPFS for instant
								availability, then replicate across multiple Filecoin storage providers for
								permanent storage. Use x402 micropayments for paid operations.
							</AgentInstructions>
							<AgentTools>
								{agentTools.map((tool, i) => (
									<AgentTool key={`tool-${i}`} tool={tool} value={`tool-${i}`} />
								))}
							</AgentTools>
						</AgentContent>
					</Agent>
				</section>
			</BlurFade>

			{/* All Commands */}
			<BlurFade delay={0.25}>
				<section className="space-y-6">
					<h2 className="text-2xl font-semibold">All Commands</h2>
					<div className="overflow-hidden rounded-lg border">
						<table className="w-full text-sm">
							<thead>
								<tr className="border-b bg-muted/50">
									<th className="px-4 py-3 text-left font-medium">Command</th>
									<th className="px-4 py-3 text-left font-medium">Description</th>
									<th className="px-4 py-3 text-left font-medium">Payment</th>
								</tr>
							</thead>
							<tbody>
								{allCommands.map((row) => (
									<tr key={row.cmd} className="border-b last:border-b-0">
										<td className="px-4 py-3 font-mono text-xs">{row.cmd}</td>
										<td className="px-4 py-3 text-muted-foreground">{row.desc}</td>
										<td className="px-4 py-3">
											{row.paid ? (
												<Badge variant="secondary" className="bg-blue-900/30 text-blue-400 text-xs">
													x402
												</Badge>
											) : (
												<Badge variant="outline" className="text-xs">
													free
												</Badge>
											)}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</section>
			</BlurFade>
		</div>
	);
}
