import { createStorageAgentStream } from "@w3stor/sdk/ai";
import { convertToModelMessages, gateway, type UIMessage } from "ai";

export const maxDuration = 30;

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export async function POST(req: Request) {
	const {
		messages,
		model: modelId,
		wallet,
	}: { messages: UIMessage[]; model?: string; wallet?: string } = await req.json();

	const result = createStorageAgentStream({
		model: gateway(modelId ?? process.env.AI_DEFAULT_MODEL ?? "openai/gpt-4o-mini"),
		messages: await convertToModelMessages(messages),
		walletAddress: wallet,
		apiUrl: API_URL,
	});

	return result.toUIMessageStreamResponse();
}
