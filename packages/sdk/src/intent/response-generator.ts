import type { ConversationMessage, ConversationState, Intent } from "@w3stor/shared";
import { logger } from "@w3stor/shared";
import { gateway, generateText } from "ai";

interface ResponseContext {
	intent?: Intent;
	state?: ConversationState;
	cid?: string;
	filename?: string;
	sizeBytes?: number;
	status?: string;
	error?: string;
	files?: Array<{ cid: string; filename: string; status: string }>;
	[key: string]: unknown;
}

export function generateResponse(intent: Intent, state: string, context: ResponseContext): string {
	const key = `${intent}:${state}`;

	switch (key) {
		case "conversation:active":
			// This is the sync fallback — the async generateConversationalResponse is preferred
			return "I am a decentralized storage agent. I can help you store files permanently on Filecoin, retrieve files by CID, list your stored files, or check replication status. What would you like to do?";

		case "store:waiting_input":
			if (!context.cid) {
				return "I can help you store that on Filecoin with permanent replication across 3 storage providers. Please attach the file you would like to store.";
			}
			return "Please provide the remaining information to proceed with storage.";

		case "store:storing":
			return `Your file has been pinned to IPFS${context.cid ? ` with CID ${context.cid}` : ""}. It is now being replicated to 3 Filecoin storage providers. This typically takes 3-5 minutes. You can check the status anytime.`;

		case "store:completed":
			return [
				"Your file is now stored on Filecoin.",
				"",
				context.cid ? `CID: ${context.cid}` : "",
				context.filename ? `Filename: ${context.filename}` : "",
				context.sizeBytes ? `Size: ${formatBytes(context.sizeBytes)}` : "",
				context.status ? `Status: ${context.status}` : "",
				"",
				"You can retrieve it anytime using the CID.",
			]
				.filter(Boolean)
				.join("\n");

		case "store:failed":
			return `Storage operation failed${context.error ? `: ${context.error}` : ""}. Would you like to try again?`;

		case "retrieve:waiting_input":
			return "Which file would you like to retrieve? Please provide the CID (Content Identifier).";

		case "retrieve:completed":
			return `File retrieved successfully.${context.cid ? ` CID: ${context.cid}` : ""}`;

		case "list:completed": {
			if (!context.files || context.files.length === 0) {
				return "You have no stored files yet.";
			}
			const fileList = context.files
				.map((f, i) => `${i + 1}. ${f.filename || "Unnamed"} — ${f.cid} (${f.status})`)
				.join("\n");
			return `Your stored files:\n\n${fileList}`;
		}

		case "status:completed":
			return [
				`File status for ${context.cid || "requested file"}:`,
				"",
				context.status ? `Overall: ${context.status}` : "",
			]
				.filter(Boolean)
				.join("\n");

		case "status:waiting_input":
			return "Which file would you like to check the status of? Please provide the CID.";

		case "attest:completed":
			return [
				`Attestation generated for ${context.cid || "requested file"}:`,
				"",
				context.attestationHash ? `Attestation Hash: ${context.attestationHash}` : "",
				context.verificationHash ? `Verification Hash: ${context.verificationHash}` : "",
				context.confirmedCount !== undefined
					? `Replicated: ${context.confirmedCount}/${context.totalProviders || "?"} providers`
					: "",
				"",
				"This cryptographic proof confirms your file is replicated across Filecoin storage providers.",
			]
				.filter(Boolean)
				.join("\n");

		case "attest:waiting_input":
			return "Which file would you like an attestation for? Please provide the CID.";

		default:
			return "How can I help you with decentralized storage today?";
	}
}

export function generateErrorResponse(error: string): string {
	return `I encountered an issue: ${error}. Would you like to try again or do something else?`;
}

function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

const CONVERSATIONAL_SYSTEM_PROMPT = `You are a friendly decentralized storage agent powered by Filecoin. You help users store, retrieve, and manage files on IPFS and Filecoin.

Your capabilities:
- Store/upload files to Filecoin with replication across multiple storage providers
- Retrieve files by CID
- List a user's stored files
- Check replication status of uploads
- Generate cryptographic attestations proving file replication

Keep responses concise (1-3 sentences), friendly, and helpful. If the user is making conversation, respond naturally but gently guide them toward using your storage features. Don't repeat the same response twice.`;

export async function generateConversationalResponse(
	userMessage: string,
	history: ConversationMessage[],
): Promise<string> {
	try {
		const messages = [
			{ role: "system" as const, content: CONVERSATIONAL_SYSTEM_PROMPT },
			...history
				.slice(-6)
				.filter((msg) => msg.content != null && msg.content !== "")
				.map((msg) => ({
					role: msg.role === "agent" ? ("assistant" as const) : ("user" as const),
					content: msg.content,
				})),
			{ role: "user" as const, content: userMessage },
		];

		const result = await generateText({
			model: gateway(process.env.AI_DEFAULT_MODEL ?? "openai/gpt-4o-mini"),
			messages,
			temperature: 0.7,
			maxOutputTokens: 200,
		});

		return result.text || generateResponse("conversation", "active", {});
	} catch (error) {
		logger.error("Conversational response generation failed", {
			error: error instanceof Error ? error.message : String(error),
		});
		return generateResponse("conversation", "active", {});
	}
}
