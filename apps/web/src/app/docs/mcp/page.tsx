"use client";

import { CodeBlock } from "@/components/ai-elements/code-block";
import { SchemaDisplay } from "@/components/ai-elements/schema-display";
import { Snippet, SnippetCopyButton, SnippetInput } from "@/components/ai-elements/snippet";
import { Badge } from "@/components/ui/badge";
import { BlurFade } from "@/components/ui/blur-fade";

const claudeDesktopConfig = `// ~/Library/Application Support/Claude/claude_desktop_config.json
{
  "mcpServers": {
    "w3stor": {
      "command": "w3stor",
      "args": ["--mcp"],
      "env": {
        "PRIVATE_KEY": "0x..."
      }
    }
  }
}`;

const customClientExample = `import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const transport = new StdioClientTransport({
  command: "w3stor",
  args: ["--mcp"],
});

const client = new Client({ name: "my-app", version: "1.0.0" }, {});
await client.connect(transport);

// List available tools
const tools = await client.listTools();
console.log(tools);

// Upload a file
const result = await client.callTool({
  name: "web3_storage_upload",
  arguments: {
    file: "/path/to/data.json",
    tags: "dataset,v1",
  },
});
console.log(result);`;

export default function MCPPage() {
	return (
		<div className="space-y-16">
			{/* Hero */}
			<BlurFade delay={0}>
				<div className="space-y-4">
					<h1 className="text-4xl font-bold tracking-tight">MCP Server</h1>
					<p className="max-w-2xl text-lg text-muted-foreground">
						The Model Context Protocol lets AI assistants like Claude interact with w3stor directly.
						Upload files, check status, and create attestations without leaving the conversation.
					</p>
				</div>
			</BlurFade>

			{/* What is MCP */}
			<BlurFade delay={0.05}>
				<section className="space-y-4">
					<h2 className="text-2xl font-semibold">What is MCP?</h2>
					<div className="rounded-lg border bg-card p-6 space-y-3">
						<p className="text-muted-foreground">
							The <span className="text-foreground font-medium">Model Context Protocol</span> is an
							open standard that allows AI models to securely interact with external tools and data
							sources. Instead of copy-pasting CIDs or switching between apps, your AI assistant can
							store and retrieve files directly.
						</p>
						<p className="text-muted-foreground">
							w3stor implements MCP over stdio transport, exposing 4 tools that map to the REST API.
							Payment is handled automatically via x402 -- the AI decides when to store, and the
							protocol handles the rest.
						</p>
					</div>
				</section>
			</BlurFade>

			{/* Setup: Claude Desktop */}
			<BlurFade delay={0.1}>
				<section className="space-y-6">
					<h2 className="text-2xl font-semibold">Setup</h2>

					<div className="space-y-4">
						<h3 className="text-lg font-medium">Claude Desktop</h3>
						<p className="text-sm text-muted-foreground">
							Add the w3stor server to your Claude Desktop configuration:
						</p>
						<CodeBlock code={claudeDesktopConfig} language="json" />
					</div>

					<div className="space-y-4">
						<h3 className="text-lg font-medium">Claude Code</h3>
						<p className="text-sm text-muted-foreground">
							Register w3stor as an MCP server with a single command:
						</p>
						<Snippet code="w3stor mcp add">
							<SnippetInput />
							<SnippetCopyButton />
						</Snippet>
					</div>

					<div className="space-y-4">
						<h3 className="text-lg font-medium">Custom MCP Client</h3>
						<p className="text-sm text-muted-foreground">
							Connect any MCP-compatible client using the SDK:
						</p>
						<CodeBlock code={customClientExample} language="typescript" />
					</div>
				</section>
			</BlurFade>

			{/* Available Tools */}
			<BlurFade delay={0.15}>
				<section className="space-y-6">
					<h2 className="text-2xl font-semibold">Available Tools</h2>
					<p className="text-muted-foreground">
						Each tool maps to a REST API endpoint. Tools marked x402 trigger a micropayment.
					</p>

					<div className="space-y-4">
						<div className="space-y-2">
							<div className="flex items-center gap-2">
								<h3 className="font-mono text-base font-medium">web3_storage_upload</h3>
								<Badge variant="secondary" className="bg-blue-900/30 text-blue-400 text-xs">
									x402
								</Badge>
							</div>
							<SchemaDisplay
								method="POST"
								path="/upload"
								description="Upload a file to IPFS and replicate across Filecoin storage providers."
								requestBody={[
									{
										name: "file",
										type: "string",
										required: true,
										description: "Absolute path to the file to upload",
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
									{
										name: "size",
										type: "number",
										required: true,
										description: "File size in bytes",
									},
									{
										name: "pinataUrl",
										type: "string",
										required: true,
										description: "IPFS gateway URL",
									},
								]}
							/>
						</div>

						<div className="space-y-2">
							<div className="flex items-center gap-2">
								<h3 className="font-mono text-base font-medium">web3_storage_list</h3>
								<Badge variant="outline" className="text-xs">
									free
								</Badge>
							</div>
							<SchemaDisplay
								method="GET"
								path="/files"
								description="List files stored by the authenticated wallet."
								parameters={[
									{
										name: "status",
										type: "string",
										location: "query",
										description: "Filter: pinned | storing | stored",
									},
									{
										name: "limit",
										type: "number",
										location: "query",
										description: "Max results (default: 50)",
									},
								]}
								responseBody={[
									{
										name: "files",
										type: "array",
										required: true,
										description: "Array of file objects with CID, size, status, tags",
									},
									{ name: "total", type: "number", required: true, description: "Total count" },
								]}
							/>
						</div>

						<div className="space-y-2">
							<div className="flex items-center gap-2">
								<h3 className="font-mono text-base font-medium">web3_storage_status</h3>
								<Badge variant="outline" className="text-xs">
									free
								</Badge>
							</div>
							<SchemaDisplay
								method="GET"
								path="/status/{cid}"
								description="Check replication and storage status for a specific CID."
								parameters={[
									{
										name: "cid",
										type: "string",
										required: true,
										location: "path",
										description: "Content identifier",
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
										description: "SP providers storing this CID",
									},
									{ name: "replicationCount", type: "number", description: "Confirmed replicas" },
								]}
							/>
						</div>

						<div className="space-y-2">
							<div className="flex items-center gap-2">
								<h3 className="font-mono text-base font-medium">web3_storage_attest</h3>
								<Badge variant="secondary" className="bg-blue-900/30 text-blue-400 text-xs">
									x402
								</Badge>
							</div>
							<SchemaDisplay
								method="POST"
								path="/attest/{cid}"
								description="Create an on-chain attestation proving data integrity and storage."
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
										description: "On-chain attestation ID",
									},
									{
										name: "txHash",
										type: "string",
										required: true,
										description: "Transaction hash",
									},
									{
										name: "timestamp",
										type: "number",
										required: true,
										description: "Unix timestamp",
									},
								]}
							/>
						</div>
					</div>
				</section>
			</BlurFade>
		</div>
	);
}
