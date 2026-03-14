"use client";

import { Cpu, Globe, Terminal, Wallet } from "lucide-react";
import Link from "next/link";
import { BlurFade } from "@/components/ui/blur-fade";
import { BorderBeam } from "@/components/ui/border-beam";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const protocols = [
	{
		id: "rest",
		label: "REST API",
		icon: Globe,
		colorClass: "text-blue-400",
		borderColor: "blue",
		href: "/docs",
		description:
			"Store files from any HTTP client. Include the x402 payment header and get a CID back. Works with curl, fetch, axios — any language, any runtime.",
		code: `curl -X POST https://api.w3stor.agent/upload \\
  -H "Content-Type: multipart/form-data" \\
  -H "X-402-Payment: eip155:8453:0xPayment…" \\
  -F "file=@robot-telemetry.ndjson" \\
  -F "providers=3" \\
  -F "permanent=true"

# Response
{
  "cid": "bafybeig3p7xj2vkqzn5o4ywlmca7ibe2i3qp6dta5r8nfhz2ska4k2",
  "providers": ["f01234", "f05678", "f09012"],
  "pinataUrl": "https://gateway.pinata.cloud/ipfs/bafybei…",
  "costUSDFC": "0.0014",
  "status": "confirmed"
}`,
	},
	{
		id: "mcp",
		label: "MCP Server",
		icon: Terminal,
		colorClass: "text-cyan-400",
		borderColor: "cyan",
		href: "/docs/mcp",
		description:
			"Connect any MCP-compatible AI framework (Claude, Cursor, Zed) to w3stor as a tool server. Five tools cover the full lifecycle: upload, retrieve, list, status, unpin.",
		code: `// Tool call from any MCP client
{
  "tool": "w3stor_upload",
  "arguments": {
    "filename": "robot-telemetry.ndjson",
    "content": "<base64-encoded-bytes>",
    "providers": 3,
    "permanent": true,
    "paymentHeader": "eip155:8453:0xPayment…"
  }
}

// Tool response
{
  "cid": "bafybeig3p7xj2vkqzn5o4ywlmca7ibe2i3qp6dta5r8nfhz2ska4k2",
  "providers": 3,
  "costUSDFC": "0.0014"
}`,
	},
	{
		id: "a2a",
		label: "A2A Protocol",
		icon: Cpu,
		colorClass: "text-purple-400",
		borderColor: "purple",
		href: "/docs/a2a",
		description:
			"Agent-to-agent storage via JSON-RPC 2.0. Any agent in a swarm can delegate storage to w3stor by sending a tasks/send message. Responses carry CIDs back as structured data parts.",
		code: `// JSON-RPC 2.0 over HTTP (A2A Protocol)
{
  "jsonrpc": "2.0",
  "method": "tasks/send",
  "id": "store-001",
  "params": {
    "taskId": "swarm-session-7f3a",
    "message": {
      "role": "user",
      "parts": [
        { "type": "text", "text": "store this artifact permanently" },
        {
          "type": "data",
          "mimeType": "application/octet-stream",
          "data": { "filename": "robot-telemetry.ndjson", "bytes": "…" }
        }
      ]
    }
  }
}`,
	},
	{
		id: "erc8004",
		label: "ERC-8004",
		icon: Wallet,
		colorClass: "text-emerald-400",
		borderColor: "emerald",
		href: "#",
		description:
			"On-chain identity for storage agents. ERC-8004 agent cards published to Base, Optimism, or Arbitrum let other contracts discover and pay w3stor directly. x402 handles settlement in USDFC.",
		code: `// x402 payment + ERC-8004 agent endpoint
POST https://api.w3stor.agent/upload
X-402-Payment: eip155:8453:0xPayment…USDFCtoken
X-Agent-Card: ipfs://bafybei…agentcard.json
X-Chain: base   // base | optimism | arbitrum

// Supported chains
{
  "base":      { "chainId": 8453,  "token": "USDFC" },
  "optimism":  { "chainId": 10,    "token": "USDFC" },
  "arbitrum":  { "chainId": 42161, "token": "USDFC" }
}

// Settlement confirmed on-chain — no custodian, no wrapping`,
	},
];

export function ProtocolCards() {
	return (
		<section className="mx-auto max-w-7xl px-4 py-24">
			<BlurFade delay={0.05}>
				<div className="mb-10 text-center">
					<h2 className="text-3xl font-bold">Four Ways to Connect</h2>
					<p className="mt-3 max-w-2xl mx-auto text-muted-foreground">
						Every protocol speaks the same operation. Pick the one that fits your stack — or use all
						four in the same swarm.
					</p>
				</div>
			</BlurFade>

			<BlurFade delay={0.1}>
				<Tabs defaultValue="rest">
					<TabsList className="mx-auto mb-8 flex w-fit gap-1">
						{protocols.map((p) => {
							const Icon = p.icon;
							return (
								<TabsTrigger key={p.id} value={p.id} className="gap-2 px-4 py-2">
									<Icon className={`h-4 w-4 ${p.colorClass}`} />
									<span>{p.label}</span>
								</TabsTrigger>
							);
						})}
					</TabsList>

					{protocols.map((p) => (
						<TabsContent key={p.id} value={p.id}>
							<Card className="relative overflow-hidden border-border/50 bg-card/60 backdrop-blur-sm">
								<BorderBeam
									size={120}
									duration={12}
									colorFrom={
										p.borderColor === "blue"
											? "#3b82f6"
											: p.borderColor === "cyan"
												? "#06b6d4"
												: p.borderColor === "purple"
													? "#8b5cf6"
													: "#10b981"
									}
									colorTo="#1e293b"
								/>
								<CardContent className="p-6">
									<div className="grid gap-6 md:grid-cols-2">
										{/* Left: description */}
										<div className="flex flex-col justify-between gap-6">
											<div className="space-y-3">
												<div className="flex items-center gap-2">
													{(() => {
														const Icon = p.icon;
														return <Icon className={`h-5 w-5 ${p.colorClass}`} />;
													})()}
													<h3 className="text-lg font-semibold">{p.label}</h3>
												</div>
												<p className="text-sm text-muted-foreground leading-relaxed">
													{p.description}
												</p>
											</div>
											<Link
												href={p.href}
												className="group inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
											>
												View documentation
												<span className="transition-transform group-hover:translate-x-0.5">→</span>
											</Link>
										</div>

										{/* Right: code snippet */}
										<div className="rounded-xl border border-border/40 bg-zinc-950/80 p-4 font-mono">
											<pre className="overflow-x-auto text-[11px] leading-relaxed text-zinc-300 whitespace-pre">
												{p.code}
											</pre>
										</div>
									</div>
								</CardContent>
							</Card>
						</TabsContent>
					))}
				</Tabs>
			</BlurFade>
		</section>
	);
}
