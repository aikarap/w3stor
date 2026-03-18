"use client";

import { CodeBlock } from "@/components/ai-elements/code-block";
import { Snippet, SnippetCopyButton, SnippetInput } from "@/components/ai-elements/snippet";
import { BlurFade } from "@/components/ui/blur-fade";

const pluginStructure = `// plugins/w3stor/index.ts
import type { Plugin } from "@elizaos/core";

import { storeOnFilecoin } from "./actions/store";
import { listStoredFiles } from "./actions/list";
import { checkStorageStatus } from "./actions/status";

export const w3storPlugin: Plugin = {
  name: "w3stor",
  description: "Decentralized storage via IPFS + Filecoin with x402 micropayments",
  actions: [storeOnFilecoin, listStoredFiles, checkStorageStatus],
  evaluators: [],
  providers: [],
};`;

const storeAction = `// plugins/w3stor/actions/store.ts
import type { Action, IAgentRuntime, Memory, State } from "@elizaos/core";

const W3S_API = process.env.W3S_API_URL ?? "https://api.w3s.storage";

export const storeOnFilecoin: Action = {
  name: "STORE_ON_FILECOIN",
  similes: ["UPLOAD_FILE", "SAVE_TO_IPFS", "STORE_DATA", "PIN_FILE"],
  description: "Upload a file to IPFS and replicate across Filecoin storage providers",

  validate: async (_runtime: IAgentRuntime, message: Memory) => {
    // Check if message contains file reference or upload intent
    const text = message.content.text?.toLowerCase() ?? "";
    return (
      text.includes("upload") ||
      text.includes("store") ||
      text.includes("save") ||
      text.includes("pin") ||
      !!message.content.attachments?.length
    );
  },

  handler: async (runtime: IAgentRuntime, message: Memory, state?: State) => {
    const attachments = message.content.attachments ?? [];

    if (attachments.length === 0) {
      return { text: "Please attach a file to upload to decentralized storage." };
    }

    const results = [];

    for (const attachment of attachments) {
      const formData = new FormData();
      const blob = new Blob([attachment.data], { type: attachment.mimeType });
      formData.append("file", blob, attachment.name);

      const res = await fetch(\`\${W3S_API}/upload\`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      results.push(data);
    }

    const summary = results
      .map((r) => \`- \${r.cid} (\${r.size} bytes)\`)
      .join("\\n");

    return {
      text: \`Uploaded \${results.length} file(s) to decentralized storage:\\n\${summary}\\n\\nFiles are pinned on IPFS and replicating to Filecoin SPs.\`,
      data: results,
    };
  },

  examples: [
    [
      {
        user: "user",
        content: { text: "Store this research data on Filecoin" },
      },
      {
        user: "agent",
        content: {
          text: "Uploaded 1 file to decentralized storage. CID: bafkrei... Replicating to 3 SPs.",
          action: "STORE_ON_FILECOIN",
        },
      },
    ],
  ],
};`;

const listAction = `// plugins/w3stor/actions/list.ts
import type { Action, IAgentRuntime, Memory } from "@elizaos/core";

const W3S_API = process.env.W3S_API_URL ?? "https://api.w3s.storage";

export const listStoredFiles: Action = {
  name: "LIST_STORED_FILES",
  similes: ["SHOW_FILES", "MY_FILES", "LIST_UPLOADS"],
  description: "List files stored in decentralized storage",

  validate: async (_runtime: IAgentRuntime, message: Memory) => {
    const text = message.content.text?.toLowerCase() ?? "";
    return text.includes("list") || text.includes("files") || text.includes("show");
  },

  handler: async () => {
    const res = await fetch(\`\${W3S_API}/files?limit=20\`);
    const data = await res.json();

    const table = data.files
      .map((f: { cid: string; status: string; size: number }) =>
        \`- \${f.cid.slice(0, 20)}... | \${f.status} | \${f.size} bytes\`
      )
      .join("\\n");

    return {
      text: \`You have \${data.total} stored files:\\n\${table}\`,
      data: data.files,
    };
  },

  examples: [
    [
      { user: "user", content: { text: "Show me my stored files" } },
      {
        user: "agent",
        content: { text: "You have 4 stored files:...", action: "LIST_STORED_FILES" },
      },
    ],
  ],
};`;

const statusAction = `// plugins/w3stor/actions/status.ts
import type { Action, IAgentRuntime, Memory } from "@elizaos/core";

const W3S_API = process.env.W3S_API_URL ?? "https://api.w3s.storage";

export const checkStorageStatus: Action = {
  name: "CHECK_STORAGE_STATUS",
  similes: ["FILE_STATUS", "CHECK_CID", "REPLICATION_STATUS"],
  description: "Check replication status for a specific CID",

  validate: async (_runtime: IAgentRuntime, message: Memory) => {
    const text = message.content.text ?? "";
    return text.includes("status") || text.includes("bafk") || text.includes("check");
  },

  handler: async (_runtime: IAgentRuntime, message: Memory) => {
    const cidMatch = message.content.text?.match(/bafk[a-z0-9]+/);
    if (!cidMatch) {
      return { text: "Please provide a CID to check. Example: check status of bafkrei..." };
    }

    const res = await fetch(\`\${W3S_API}/status/\${cidMatch[0]}\`);
    const data = await res.json();

    return {
      text: \`CID: \${data.cid}\\nStatus: \${data.status}\\nReplicas: \${data.replicationCount}/3\\nProviders: \${data.providers?.join(", ") ?? "pending"}\`,
      data,
    };
  },

  examples: [
    [
      { user: "user", content: { text: "Check status of bafkreihdwdcefgh..." } },
      {
        user: "agent",
        content: { text: "CID: bafkrei... Status: stored, 3/3 replicas", action: "CHECK_STORAGE_STATUS" },
      },
    ],
  ],
};`;

const characterRegistration = `// character.ts
import type { Character } from "@elizaos/core";
import { w3storPlugin } from "./plugins/w3stor";

export const storageAgent: Character = {
  name: "StorageBot",
  plugins: [w3storPlugin],
  system: \`You are a decentralized storage assistant. You help users
upload files to IPFS and Filecoin, check their storage status,
and manage their data. You use x402 micropayments for paid
operations. Be concise and helpful.\`,
  bio: [
    "Decentralized storage agent powered by Filecoin and IPFS",
    "Supports x402 micropayments for trustless file operations",
  ],
  style: {
    all: ["concise", "technical but friendly", "always include CIDs in responses"],
    chat: ["helpful", "proactive about checking replication status"],
  },
};`;

const conversationExample = `// Example conversation
User: "Hey, can you store this CSV file for me?"
Agent: "Of course! I'll upload it to IPFS and replicate across Filecoin SPs."
       [STORE_ON_FILECOIN]
       "Done! Your file is stored:
        - CID: bafkreihdwdcefgh4dqkjv67uzcmw7ojee6xedzd
        - Size: 245 KB
        - Status: pinned (replicating to 3 SPs)
        Cost: $0.0008 USDC via x402"

User: "How's the replication going?"
Agent: [CHECK_STORAGE_STATUS]
       "Your file (bafkrei...) is fully replicated:
        - f01234: committed (sector 5891)
        - f05678: committed (sector 3204)
        - f09012: committed (sector 7712)
        All 3/3 SPs confirmed!"`;

const a2aAlternative = `// Alternative: Use A2A protocol instead of direct plugin
import type { Action, IAgentRuntime, Memory } from "@elizaos/core";

const A2A_ENDPOINT = "https://api.w3s.storage/a2a";

export const a2aStorage: Action = {
  name: "A2A_STORAGE",
  description: "Interact with w3stor via A2A protocol",

  handler: async (_runtime: IAgentRuntime, message: Memory) => {
    const res = await fetch(A2A_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: crypto.randomUUID(),
        method: "tasks/send",
        params: {
          id: \`task-\${Date.now()}\`,
          message: {
            role: "user",
            parts: [{ type: "text", text: message.content.text }],
          },
        },
      }),
    });

    const data = await res.json();
    const agentMessage = data.result?.status?.message;
    const textPart = agentMessage?.parts?.find(
      (p: { type: string }) => p.type === "text"
    );
    return { text: textPart?.text ?? "Storage operation completed." };
  },

  validate: async () => true,
  similes: [],
  examples: [],
};`;

export default function ElizaOSPage() {
	return (
		<div className="space-y-16">
			{/* Hero */}
			<BlurFade delay={0}>
				<div className="space-y-4">
					<h1 className="text-4xl font-bold tracking-tight">ElizaOS Plugin</h1>
					<p className="max-w-2xl text-lg text-muted-foreground">
						Build an ElizaOS agent with decentralized storage capabilities. Three action handlers
						cover the full storage lifecycle: upload, list, and status.
					</p>
				</div>
			</BlurFade>

			{/* Install */}
			<BlurFade delay={0.05}>
				<section className="space-y-4">
					<h2 className="text-2xl font-semibold">Install</h2>
					<Snippet code="bun add @elizaos/core">
						<SnippetInput />
						<SnippetCopyButton />
					</Snippet>
				</section>
			</BlurFade>

			{/* Plugin Structure */}
			<BlurFade delay={0.1}>
				<section className="space-y-4">
					<h2 className="text-2xl font-semibold">Plugin Structure</h2>
					<p className="text-muted-foreground">
						The plugin registers three actions that ElizaOS agents can invoke based on user
						messages.
					</p>
					<CodeBlock code={pluginStructure} language="typescript" />
				</section>
			</BlurFade>

			{/* Action Handlers */}
			<BlurFade delay={0.15}>
				<section className="space-y-6">
					<h2 className="text-2xl font-semibold">Action Handlers</h2>

					<div className="space-y-4">
						<h3 className="text-lg font-medium font-mono">STORE_ON_FILECOIN</h3>
						<p className="text-sm text-muted-foreground">
							Handles file uploads. Validates user intent from keywords and attachments, then
							uploads via the w3stor API.
						</p>
						<CodeBlock code={storeAction} language="typescript" showLineNumbers />
					</div>

					<div className="space-y-4">
						<h3 className="text-lg font-medium font-mono">LIST_STORED_FILES</h3>
						<p className="text-sm text-muted-foreground">
							Lists the user&apos;s stored files with CID, status, and size.
						</p>
						<CodeBlock code={listAction} language="typescript" showLineNumbers />
					</div>

					<div className="space-y-4">
						<h3 className="text-lg font-medium font-mono">CHECK_STORAGE_STATUS</h3>
						<p className="text-sm text-muted-foreground">
							Extracts a CID from the user message and checks its replication status.
						</p>
						<CodeBlock code={statusAction} language="typescript" showLineNumbers />
					</div>
				</section>
			</BlurFade>

			{/* Character Registration */}
			<BlurFade delay={0.2}>
				<section className="space-y-4">
					<h2 className="text-2xl font-semibold">Character Registration</h2>
					<p className="text-muted-foreground">
						Register the plugin with your ElizaOS character to enable storage capabilities.
					</p>
					<CodeBlock code={characterRegistration} language="typescript" />
				</section>
			</BlurFade>

			{/* Conversation Example */}
			<BlurFade delay={0.25}>
				<section className="space-y-4">
					<h2 className="text-2xl font-semibold">Example Conversation</h2>
					<p className="text-muted-foreground">
						A typical multi-turn conversation with a w3stor-enabled ElizaOS agent:
					</p>
					<CodeBlock code={conversationExample} language="markdown" />
				</section>
			</BlurFade>

			{/* A2A Alternative */}
			<BlurFade delay={0.3}>
				<section className="space-y-4">
					<h2 className="text-2xl font-semibold">Alternative: A2A Integration</h2>
					<p className="text-muted-foreground">
						Instead of direct API calls, you can use the A2A protocol. This lets your ElizaOS agent
						communicate with w3stor as a peer agent via JSON-RPC.
					</p>
					<CodeBlock code={a2aAlternative} language="typescript" showLineNumbers />
				</section>
			</BlurFade>
		</div>
	);
}
