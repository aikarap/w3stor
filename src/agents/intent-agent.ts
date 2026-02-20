import type { ConversationMessage, IntentResult } from "@w3stor/shared";
import { generateText, Output } from "ai";
import { z } from "zod";

const intentSchema = z.object({
	intent: z.enum(["store", "retrieve", "list", "status", "attest", "conversation"]),
	confidence: z.number().min(0).max(1),
	extractedParams: z.record(z.unknown()),
	reasoning: z.string(),
});

const SYSTEM_PROMPT = `You are an intent classifier for a Filecoin decentralized storage agent. Classify the user's intent based on their message and conversation history.

Intent definitions:
- "store": User wants to upload, save, store, persist, backup, or archive a file to Filecoin/IPFS
- "retrieve": User wants to download, get, fetch, or retrieve a file by CID
- "list": User wants to see their files, browse uploads, or check what they've stored
- "status": User wants to check the replication status of a specific upload
- "attest": User wants cryptographic proof or attestation that a file is replicated
- "conversation": General conversation, greetings, questions about capabilities, or unclear intent

For extractedParams, extract any of these if found in the message:
- "cid": IPFS CID (starts with Qm... or bafy...)
- "filename": mentioned filename
- "walletAddress": Ethereum address (starts with 0x)

Important: Consider the FULL conversation history. "yes" after "Would you like to store it?" means intent is "store".`;

export async function detectIntent(
	model: Parameters<typeof generateText>[0]["model"],
	currentMessage: string,
	conversationHistory: ConversationMessage[],
): Promise<IntentResult> {
	try {
		const messages = conversationHistory
			.slice(-10)
			.filter((msg) => msg.content != null && msg.content !== "")
			.map((msg) => ({
				role: msg.role === "agent" ? ("assistant" as const) : ("user" as const),
				content: msg.content,
			}));

		const { output } = await generateText({
			model,
			output: Output.object({ schema: intentSchema }),
			system: SYSTEM_PROMPT,
			messages: [...messages, { role: "user", content: currentMessage }],
			temperature: 0.1,
		});

		return output!;
	} catch {
		return {
			intent: "conversation",
			confidence: 0.5,
			extractedParams: {},
			reasoning: "Intent detection failed, defaulting to conversation",
		};
	}
}
