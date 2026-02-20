import { type ModelMessage, streamText } from "ai";
import { createAttestTool } from "../tools/attest";
import { createListFilesTool } from "../tools/list-files";
import { createCheckStatusTool } from "../tools/status";
import { uploadTool } from "../tools/upload";

const SYSTEM_PROMPT = `You are the W3S Storage Agent — an AI assistant for decentralized file storage on Filecoin.

## Capabilities
- Upload files to permanent Filecoin storage via IPFS → multi-SP replication
- Check file replication status across Storage Providers
- List a wallet's uploaded files with status details
- Explain x402 micropayments, the w3stor CLI, and integration options (REST, A2A, MCP)

## How uploads work
1. User attaches a file and asks to upload
2. You call the uploadFile tool with the filename and size
3. The tool returns upload details including CID and cost
4. The file gets pinned to IPFS instantly, then replicated to 3+ Filecoin SPs

## Formatting
- When showing file status, present it clearly with CID, size, provider count, and replication state
- When an upload completes, summarize the result: filename, size, CID, and replication status
- Use bullet points and headers for multi-item responses
- Keep responses concise and actionable`;

export interface StorageAgentOptions {
	model: Parameters<typeof streamText>[0]["model"];
	messages: ModelMessage[];
	walletAddress?: string;
	apiUrl?: string;
}

export function createStorageAgentStream(options: StorageAgentOptions) {
	const { model, messages, walletAddress, apiUrl } = options;

	const systemPrompt = walletAddress
		? `${SYSTEM_PROMPT}\n\n## Connected wallet\nThe user's connected wallet address is: ${walletAddress}\nWhen listing files, always use this wallet address — do not ask the user for it.`
		: SYSTEM_PROMPT;

	const toolDeps = apiUrl ? { apiUrl } : {};

	return streamText({
		model,
		system: systemPrompt,
		messages,
		tools: {
			uploadFile: uploadTool,
			checkStatus: createCheckStatusTool(toolDeps),
			listFiles: createListFilesTool(toolDeps),
			attest: createAttestTool(toolDeps),
		},
	});
}
