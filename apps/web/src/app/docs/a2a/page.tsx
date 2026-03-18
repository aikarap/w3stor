"use client";

import { CodeBlock } from "@/components/ai-elements/code-block";
import { A2AConversationMock } from "@/components/landing/a2a-conversation-mock";
import { Badge } from "@/components/ui/badge";
import { BlurFade } from "@/components/ui/blur-fade";

const agentCard = `{
  "name": "w3stor",
  "description": "Decentralized storage agent — IPFS + Filecoin with x402 micropayments",
  "url": "https://api.w3s.storage",
  "version": "0.1.0",
  "capabilities": {
    "streaming": false,
    "pushNotifications": false
  },
  "skills": [
    {
      "id": "upload",
      "name": "Upload File",
      "description": "Upload a file to IPFS and replicate across Filecoin SPs",
      "tags": ["storage", "ipfs", "filecoin"],
      "examples": ["Store this dataset on Filecoin", "Upload report.pdf"]
    },
    {
      "id": "list",
      "name": "List Files",
      "description": "List stored files with optional status filter",
      "tags": ["query", "files"],
      "examples": ["Show my stored files", "List files with status stored"]
    },
    {
      "id": "status",
      "name": "Check Status",
      "description": "Check replication status for a CID",
      "tags": ["query", "status"],
      "examples": ["Check status of bafkrei...", "How many SPs store my file?"]
    },
    {
      "id": "converse",
      "name": "Conversational",
      "description": "Natural language interaction about storage operations",
      "tags": ["conversation"],
      "examples": ["What is Filecoin?", "Explain x402 payments"]
    }
  ],
  "authentication": {
    "schemes": ["x402"]
  },
  "rateLimits": {
    "maxRequestsPerMinute": 60,
    "maxConcurrentRequests": 5
  }
}`;

const jsonRpcUpload = `// POST https://api.w3s.storage/a2a
{
  "jsonrpc": "2.0",
  "id": "1",
  "method": "tasks/send",
  "params": {
    "id": "task-001",
    "message": {
      "role": "user",
      "parts": [
        {
          "type": "text",
          "text": "Upload this file to decentralized storage"
        },
        {
          "type": "file",
          "file": {
            "name": "dataset.csv",
            "mimeType": "text/csv",
            "bytes": "base64-encoded-content..."
          }
        }
      ]
    }
  }
}`;

const jsonRpcResponse = `{
  "jsonrpc": "2.0",
  "id": "1",
  "result": {
    "id": "task-001",
    "status": {
      "state": "completed",
      "message": {
        "role": "agent",
        "parts": [
          {
            "type": "text",
            "text": "File uploaded successfully."
          },
          {
            "type": "data",
            "data": {
              "cid": "bafkreihdwdcefgh4dqkjv67uzcmw7ojee6xedzd",
              "size": 245760,
              "status": "pinned",
              "replicationTarget": 3,
              "pinataUrl": "https://gateway.pinata.cloud/ipfs/bafkrei..."
            }
          }
        ]
      }
    },
    "artifacts": [
      {
        "name": "storage-receipt",
        "parts": [
          {
            "type": "data",
            "data": {
              "cid": "bafkreihdwdcefgh4dqkjv67uzcmw7ojee6xedzd",
              "providers": ["f01234", "f05678", "f09012"]
            }
          }
        ]
      }
    ]
  }
}`;

const conversationalExample = `// Conversational mode — natural language interaction
{
  "jsonrpc": "2.0",
  "id": "2",
  "method": "tasks/send",
  "params": {
    "id": "task-002",
    "message": {
      "role": "user",
      "parts": [
        {
          "type": "text",
          "text": "How many files do I have stored, and what's my total storage usage?"
        }
      ]
    }
  }
}`;

const rateLimits = [
	{ tier: "Free", rpm: 10, concurrent: 2, maxSize: "10 MB" },
	{ tier: "x402 Basic", rpm: 60, concurrent: 5, maxSize: "100 MB" },
	{ tier: "x402 Pro", rpm: 300, concurrent: 20, maxSize: "1 GB" },
];

export default function A2APage() {
	return (
		<div className="space-y-16">
			{/* Hero */}
			<BlurFade delay={0}>
				<div className="space-y-4">
					<h1 className="text-4xl font-bold tracking-tight">A2A Protocol</h1>
					<p className="max-w-2xl text-lg text-muted-foreground">
						Agent-to-Agent communication via JSON-RPC. Discover the w3stor agent, invoke skills, and
						hold conversations -- all through a standardized protocol.
					</p>
				</div>
			</BlurFade>

			{/* Agent Discovery */}
			<BlurFade delay={0.05}>
				<section className="space-y-4">
					<h2 className="text-2xl font-semibold">Agent Discovery</h2>
					<p className="text-muted-foreground">
						Agents discover w3stor via the standard well-known endpoint. The agent card describes
						capabilities, skills, auth requirements, and rate limits.
					</p>
					<div className="space-y-2">
						<p className="text-sm font-mono text-muted-foreground">
							GET https://api.w3s.storage/.well-known/agent-card.json
						</p>
						<CodeBlock code={agentCard} language="json" />
					</div>
				</section>
			</BlurFade>

			{/* Skills */}
			<BlurFade delay={0.1}>
				<section className="space-y-6">
					<h2 className="text-2xl font-semibold">Skills</h2>
					<div className="grid gap-4 sm:grid-cols-2">
						{[
							{ id: "upload", label: "Upload", desc: "Store files on IPFS + Filecoin", paid: true },
							{
								id: "list",
								label: "List Files",
								desc: "Query stored files with filters",
								paid: false,
							},
							{
								id: "status",
								label: "Check Status",
								desc: "Replication and SP status",
								paid: false,
							},
							{
								id: "converse",
								label: "Conversational",
								desc: "Natural language about storage",
								paid: false,
							},
						].map((skill) => (
							<div key={skill.id} className="rounded-lg border bg-card p-4 space-y-2">
								<div className="flex items-center gap-2">
									<h3 className="font-medium">{skill.label}</h3>
									{skill.paid ? (
										<Badge variant="secondary" className="bg-blue-900/30 text-blue-400 text-xs">
											x402
										</Badge>
									) : (
										<Badge variant="outline" className="text-xs">
											free
										</Badge>
									)}
								</div>
								<p className="text-sm text-muted-foreground">{skill.desc}</p>
							</div>
						))}
					</div>
				</section>
			</BlurFade>

			{/* Live A2A Conversation Demo */}
			<BlurFade delay={0.12}>
				<section className="space-y-4">
					<h2 className="text-2xl font-semibold">Live Conversation Demo</h2>
					<p className="text-muted-foreground">
						See how agents communicate via A2A in practice. Click the JSON-RPC envelope on each
						message to inspect the wire format.
					</p>
					<A2AConversationMock />
				</section>
			</BlurFade>

			{/* JSON-RPC Interface */}
			<BlurFade delay={0.15}>
				<section className="space-y-6">
					<h2 className="text-2xl font-semibold">JSON-RPC Interface</h2>
					<p className="text-muted-foreground">
						All interactions use JSON-RPC 2.0 over HTTP POST. The{" "}
						<code className="text-foreground font-mono text-sm">tasks/send</code> method handles
						both skill invocations and conversational messages.
					</p>

					<div className="space-y-4">
						<h3 className="text-lg font-medium">Upload Request</h3>
						<CodeBlock code={jsonRpcUpload} language="json" />
					</div>

					<div className="space-y-4">
						<h3 className="text-lg font-medium">Upload Response</h3>
						<CodeBlock code={jsonRpcResponse} language="json" />
					</div>
				</section>
			</BlurFade>

			{/* Conversational Mode */}
			<BlurFade delay={0.2}>
				<section className="space-y-6">
					<h2 className="text-2xl font-semibold">Conversational Mode</h2>
					<p className="text-muted-foreground">
						Beyond structured skill invocation, w3stor supports natural language conversations. The
						agent interprets intent, executes the appropriate operations, and responds
						conversationally.
					</p>
					<CodeBlock code={conversationalExample} language="json" />
				</section>
			</BlurFade>

			{/* Rate Limits */}
			<BlurFade delay={0.25}>
				<section className="space-y-6">
					<h2 className="text-2xl font-semibold">Rate Limits</h2>
					<div className="overflow-hidden rounded-lg border">
						<table className="w-full text-sm">
							<thead>
								<tr className="border-b bg-muted/50">
									<th className="px-4 py-3 text-left font-medium">Tier</th>
									<th className="px-4 py-3 text-left font-medium">Requests/min</th>
									<th className="px-4 py-3 text-left font-medium">Concurrent</th>
									<th className="px-4 py-3 text-left font-medium">Max File Size</th>
								</tr>
							</thead>
							<tbody>
								{rateLimits.map((row) => (
									<tr key={row.tier} className="border-b last:border-b-0">
										<td className="px-4 py-3 font-medium">{row.tier}</td>
										<td className="px-4 py-3 text-muted-foreground">{row.rpm}</td>
										<td className="px-4 py-3 text-muted-foreground">{row.concurrent}</td>
										<td className="px-4 py-3 text-muted-foreground">{row.maxSize}</td>
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
