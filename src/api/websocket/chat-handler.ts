import {
	appendMessage,
	createConversation,
	findByContextId,
	findOrCreateUser,
	getHistory,
	updateState,
} from "@w3stor/db";
import {
	checkParams,
	detectIntent,
	generateConversationalResponse,
	generateResponse,
	mergeParams,
} from "@w3stor/sdk";
import type { Intent } from "@w3stor/shared";
import { logger } from "@w3stor/shared";
import { gateway } from "ai";
import type { Namespace, Socket } from "socket.io";
import { conversationRateLimiter } from "../middleware/rate-limiter";

export function setupChatNamespace(chatNs: Namespace): void {
	chatNs.on("connection", (socket: Socket) => {
		const wallet = socket.data.wallet as string;
		logger.info("Chat connected", { wallet, socketId: socket.id });

		socket.on("chat:join", async ({ contextId }: { contextId: string }) => {
			socket.join(`chat:${contextId}`);
			try {
				const history = await getHistory(contextId, 50);
				socket.emit("chat:history", { contextId, messages: history });
			} catch (error) {
				logger.error("Failed to load chat history", { contextId, error });
			}
		});

		socket.on("chat:leave", ({ contextId }: { contextId: string }) => {
			socket.leave(`chat:${contextId}`);
		});

		socket.on(
			"chat:message",
			async ({ contextId, text, cid }: { contextId: string; text: string; cid?: string }) => {
				try {
					await handleChatMessage(socket, wallet, contextId, text, cid);
				} catch (error) {
					logger.error("Chat message handling failed", { contextId, error });
					socket.emit("chat:error", {
						contextId,
						error: error instanceof Error ? error.message : "An unexpected error occurred",
					});
				}
			},
		);

		socket.on("chat:new", async () => {
			try {
				await findOrCreateUser(wallet);
				const contextId = `ws:${wallet}:${crypto.randomUUID()}`;
				const conversation = await createConversation({
					contextId,
					sessionType: "websocket",
					walletAddress: wallet,
				});
				socket.emit("chat:created", { contextId, conversationId: conversation.id });
			} catch (error) {
				logger.error("Failed to create conversation", { wallet, error });
				socket.emit("chat:error", { error: "Failed to create conversation" });
			}
		});

		socket.on("disconnect", () => {
			logger.info("Chat disconnected", { wallet, socketId: socket.id });
		});
	});
}

async function handleChatMessage(
	socket: Socket,
	wallet: string,
	contextId: string,
	text: string,
	cid?: string,
): Promise<void> {
	// Rate limiting
	const messageLimit = await conversationRateLimiter.checkMessageLimit(contextId);
	if (!messageLimit.allowed) {
		socket.emit("chat:response", {
			contextId,
			role: "agent",
			content: `This conversation has reached the maximum of ${messageLimit.limit} messages. Please start a new conversation.`,
			timestamp: new Date().toISOString(),
			final: true,
		});
		return;
	}

	if (await conversationRateLimiter.isIdle(contextId)) {
		await conversationRateLimiter.closeConversation(contextId, wallet);
		socket.emit("chat:response", {
			contextId,
			role: "agent",
			content:
				"This conversation has been idle for too long and was closed. Please start a new conversation.",
			timestamp: new Date().toISOString(),
			final: true,
		});
		return;
	}

	await conversationRateLimiter.incrementMessageCount(contextId);

	// Ensure conversation + user exist
	let conversation = await findByContextId(contextId);
	if (!conversation) {
		await findOrCreateUser(wallet);
		conversation = await createConversation({
			contextId,
			sessionType: "websocket",
			walletAddress: wallet,
		});
	}

	await appendMessage(contextId, {
		role: "user",
		content: text,
		timestamp: new Date().toISOString(),
	});

	const history = await getHistory(contextId, 10);

	// Determine intent
	let intentResult;
	if (cid) {
		intentResult = {
			intent: "store" as Intent,
			confidence: 1,
			extractedParams: { cid },
			reasoning: "CID provided",
		};
	} else if (conversation.state === "waiting_input" && conversation.detectedIntent) {
		intentResult = {
			intent: conversation.detectedIntent as Intent,
			confidence: conversation.intentConfidence ?? 1,
			extractedParams: {},
			reasoning: "Continuing existing flow",
		};
	} else {
		const model = gateway(process.env.AI_DEFAULT_MODEL ?? "anthropic/claude-sonnet-4-5");
		intentResult = await detectIntent(model, text, history);
	}

	let collectedParams: Record<string, unknown> = { ...(conversation.collectedParams || {}) };
	if (intentResult.extractedParams) {
		collectedParams = mergeParams(collectedParams, intentResult.extractedParams);
	}
	collectedParams.walletAddress = wallet;

	const intent = intentResult.intent;

	// Handle conversation intent
	if (intent === "conversation") {
		let responseText: string;
		try {
			responseText = await generateConversationalResponse(text, history);
		} catch {
			responseText = generateResponse("conversation", "active", {});
		}

		socket.emit("chat:response", {
			contextId,
			role: "agent",
			content: responseText,
			timestamp: new Date().toISOString(),
			final: true,
		});

		await updateState({
			contextId,
			state: "completed",
			detectedIntent: "conversation",
			intentConfidence: intentResult.confidence,
			collectedParams,
		});
		await appendMessage(contextId, {
			role: "agent",
			content: responseText,
			timestamp: new Date().toISOString(),
		});
		return;
	}

	// Check params completeness
	const paramStatus = checkParams(intent, collectedParams);

	await updateState({
		contextId,
		state: paramStatus.complete ? "storing" : "waiting_input",
		detectedIntent: intent,
		intentConfidence: intentResult.confidence,
		collectedParams,
	});

	if (!paramStatus.complete) {
		const responseText =
			paramStatus.nextPrompt || generateResponse(intent, "waiting_input", collectedParams);
		socket.emit("chat:response", {
			contextId,
			role: "agent",
			content: responseText,
			timestamp: new Date().toISOString(),
			final: true,
		});
		await appendMessage(contextId, {
			role: "agent",
			content: responseText,
			timestamp: new Date().toISOString(),
		});
		return;
	}

	// Execute intent
	await executeIntent(socket, contextId, intent, collectedParams);
}

async function executeIntent(
	socket: Socket,
	contextId: string,
	intent: Intent,
	params: Record<string, unknown>,
): Promise<void> {
	switch (intent) {
		case "store": {
			if (params.cid) {
				const responseText = generateResponse("store", "storing", {
					cid: params.cid as string,
					filename: params.filename as string,
				});
				socket.emit("chat:response", {
					contextId,
					role: "agent",
					content: responseText,
					timestamp: new Date().toISOString(),
					final: true,
				});
				await updateState({ contextId, state: "completed" });
				await appendMessage(contextId, {
					role: "agent",
					content: responseText,
					timestamp: new Date().toISOString(),
				});
			} else {
				const msg =
					"Please upload your file first, then I'll register it for Filecoin replication.";
				socket.emit("chat:response", {
					contextId,
					role: "agent",
					content: msg,
					timestamp: new Date().toISOString(),
					final: true,
				});
				await updateState({ contextId, state: "waiting_input" });
			}
			break;
		}
		case "list": {
			const msg = generateResponse("list", "completed", { files: [] });
			socket.emit("chat:response", {
				contextId,
				role: "agent",
				content: msg,
				timestamp: new Date().toISOString(),
				final: true,
			});
			await updateState({ contextId, state: "completed" });
			break;
		}
		case "status": {
			const msg = generateResponse("status", "completed", { cid: params.cid as string });
			socket.emit("chat:response", {
				contextId,
				role: "agent",
				content: msg,
				timestamp: new Date().toISOString(),
				final: true,
			});
			await updateState({ contextId, state: "completed" });
			break;
		}
		default: {
			const msg = generateResponse("conversation", "active", {});
			socket.emit("chat:response", {
				contextId,
				role: "agent",
				content: msg,
				timestamp: new Date().toISOString(),
				final: true,
			});
		}
	}
}
