import type { Message, TaskStatusUpdateEvent } from "@a2a-js/sdk";
import type { ExecutionEventBus, RequestContext } from "@a2a-js/sdk/server";
import {
	appendMessage,
	createConversation,
	findByContextId,
	getHistory,
	updateState,
} from "@w3stor/db";
import type { Intent } from "@w3stor/shared";
import { logger, SERVER } from "@w3stor/shared";
import { gateway } from "ai";
import { detectIntent } from "../agents/intent-agent";
import { checkParams, mergeParams } from "../intent/param-collector";
import { generateErrorResponse, generateResponse } from "../intent/response-generator";

// Route handlers — forward requests to the local Hono server's REST endpoints
const uploadHandler = (req: Request): Promise<Response> => fetch(req);
const filesHandler = (req: Request): Promise<Response> => fetch(req);
const statusHandler = (_req: Request, cid: string): Promise<Response> =>
	fetch(SERVER.getInternalUrl(`/status/${cid}`));

// TODO(Task 6): Wire conversationRateLimiter from @w3stor/api
const conversationRateLimiter = {
	checkMessageLimit: async (_contextId: string) =>
		({ allowed: true, limit: 100 }) as { allowed: boolean; limit: number },
	isIdle: async (_contextId: string) => false,
	closeConversation: async (_contextId: string) => {},
	incrementMessageCount: async (_contextId: string) => {},
};

export class ConversationHandler {
	async handle(requestContext: RequestContext, eventBus: ExecutionEventBus): Promise<void> {
		const { taskId, contextId, userMessage } = requestContext;

		const textPart = userMessage.parts.find((p) => p.kind === "text");
		const text = textPart && "text" in textPart ? textPart.text : "";
		const filePart = userMessage.parts.find((p) => p.kind === "file");
		const metadata = (userMessage.metadata as Record<string, unknown>) || {};

		// Rate limiting: check message count
		const messageLimit = await conversationRateLimiter.checkMessageLimit(contextId);
		if (!messageLimit.allowed) {
			await this.publishAgentMessage(
				eventBus,
				taskId,
				contextId,
				`This conversation has reached the maximum of ${messageLimit.limit} messages. Please start a new conversation.`,
				"failed",
			);
			return;
		}

		// Check for idle timeout
		if (await conversationRateLimiter.isIdle(contextId)) {
			await conversationRateLimiter.closeConversation(contextId);
			await this.publishAgentMessage(
				eventBus,
				taskId,
				contextId,
				"This conversation has been idle for too long and was closed. Please start a new conversation.",
				"failed",
			);
			return;
		}

		await conversationRateLimiter.incrementMessageCount(contextId);

		let conversation = await findByContextId(contextId);
		if (!conversation) {
			conversation = await createConversation({
				contextId,
				sessionType: "a2a",
			});
		}

		await appendMessage(contextId, {
			role: "user",
			content: text,
			timestamp: new Date().toISOString(),
		});

		const history = await getHistory(contextId, 10);

		try {
			// If conversation is waiting for input and already has a detected intent, reuse it
			const isWaiting = conversation.state === "waiting_input" && conversation.detectedIntent;
			const intentResult = isWaiting
				? {
						intent: conversation.detectedIntent as Intent,
						confidence: conversation.intentConfidence ?? 1,
						extractedParams: {},
						reasoning: "Continuing existing conversation flow",
					}
				: await detectIntent(
						gateway(process.env.AI_DEFAULT_MODEL ?? "anthropic/claude-sonnet-4-5"),
						text,
						history,
					);

			let collectedParams: Record<string, unknown> = { ...(conversation.collectedParams || {}) };

			if (intentResult.extractedParams) {
				collectedParams = mergeParams(collectedParams, intentResult.extractedParams);
			}

			if (metadata.wallet) {
				collectedParams.walletAddress = metadata.wallet as string;
			}

			if (filePart && filePart.kind === "file") {
				const fileData = filePart.file;
				if ("bytes" in fileData) {
					collectedParams.fileBytes = fileData.bytes;
					collectedParams.fileData = true;
					collectedParams.filename = fileData.name || collectedParams.filename || "file";
					collectedParams.mimeType = fileData.mimeType || "application/octet-stream";
					const decoded = Buffer.from(fileData.bytes as string, "base64");
					collectedParams.sizeBytes = decoded.length;
				}
			}

			const intent = intentResult.intent;

			if (intent === "conversation") {
				await this.publishAgentMessage(
					eventBus,
					taskId,
					contextId,
					generateResponse("conversation", "active", {}),
					"completed",
				);
				await updateState({
					contextId,
					state: "completed",
					detectedIntent: "conversation",
					intentConfidence: intentResult.confidence,
					collectedParams,
				});
				return;
			}

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

				await this.publishAgentMessage(eventBus, taskId, contextId, responseText, "input-required");

				await appendMessage(contextId, {
					role: "agent",
					content: responseText,
					timestamp: new Date().toISOString(),
				});
				return;
			}

			await this.executeIntent(intent, collectedParams, eventBus, userMessage, taskId, contextId);
		} catch (error) {
			logger.error("Conversation handling failed", {
				contextId,
				error: error instanceof Error ? error.message : String(error),
			});

			const errorMsg = generateErrorResponse(
				error instanceof Error ? error.message : "An unexpected error occurred",
			);

			await this.publishAgentMessage(eventBus, taskId, contextId, errorMsg, "failed");

			await updateState({ contextId, state: "failed" });

			await appendMessage(contextId, {
				role: "agent",
				content: errorMsg,
				timestamp: new Date().toISOString(),
			});
		}
	}

	private async executeIntent(
		intent: Intent,
		params: Record<string, unknown>,
		eventBus: ExecutionEventBus,
		userMessage: Message,
		taskId: string,
		contextId: string,
	): Promise<void> {
		switch (intent) {
			case "store":
				await this.executeStore(params, eventBus, userMessage, taskId, contextId);
				break;
			case "list":
				await this.executeList(params, eventBus, taskId, contextId);
				break;
			case "status":
				await this.executeStatus(params, eventBus, taskId, contextId);
				break;
			case "attest":
				await this.executeAttest(params, eventBus, taskId, contextId);
				break;
			default:
				await this.publishAgentMessage(
					eventBus,
					taskId,
					contextId,
					generateResponse("conversation", "active", {}),
					"completed",
				);
		}
	}

	private async executeStore(
		params: Record<string, unknown>,
		eventBus: ExecutionEventBus,
		userMessage: Message,
		taskId: string,
		contextId: string,
	): Promise<void> {
		this.publishProgress(eventBus, taskId, contextId, "Pinning file to IPFS...");

		const filePart = userMessage.parts.find((p) => p.kind === "file");
		let fileBytes: string | undefined;
		let filename = (params.filename as string) || "file";
		let mimeType = (params.mimeType as string) || "application/octet-stream";

		if (filePart && filePart.kind === "file" && "bytes" in filePart.file) {
			fileBytes = filePart.file.bytes as string;
			filename = filePart.file.name || filename;
			mimeType = filePart.file.mimeType || mimeType;
		} else if (params.fileBytes) {
			fileBytes = params.fileBytes as string;
		}

		if (!fileBytes) {
			await this.publishAgentMessage(
				eventBus,
				taskId,
				contextId,
				"No file data available. Please attach the file.",
				"input-required",
			);
			return;
		}

		const formData = new FormData();
		const blob = new Blob([Buffer.from(fileBytes, "base64")], {
			type: mimeType,
		});
		formData.append("file", blob, filename);

		const metadata = (params.metadata as Record<string, unknown>) || {};
		formData.append("metadata", JSON.stringify(metadata));

		const wallet = params.walletAddress as string;
		if (wallet) {
			formData.append("wallet", wallet);
		}

		const headers: Record<string, string> = {};
		if (params.payment) {
			// x402 v2 protocol: base64-encoded payment payload in PAYMENT-SIGNATURE header
			headers["payment-signature"] = Buffer.from(JSON.stringify(params.payment)).toString("base64");
		}
		const mockRequest = new Request(SERVER.getInternalUrl("/upload"), {
			method: "POST",
			headers,
			body: formData,
		});

		const response = await uploadHandler(mockRequest);
		const result = (await response.json()) as {
			cid?: string;
			size?: number;
			status?: string;
			message?: string;
			error?: string;
		};

		if (response.status === 201) {
			const responseText = generateResponse("store", "storing", {
				cid: result.cid,
				filename,
				sizeBytes: result.size,
				status: result.status,
			});

			await this.publishAgentMessage(eventBus, taskId, contextId, responseText, "completed");

			await updateState({ contextId, state: "completed" });

			await appendMessage(contextId, {
				role: "agent",
				content: responseText,
				timestamp: new Date().toISOString(),
			});
		} else {
			const errorMsg = `Upload failed: ${result.message || result.error || "Unknown error"}`;
			await this.publishAgentMessage(eventBus, taskId, contextId, errorMsg, "failed");
			await updateState({ contextId, state: "failed" });
		}
	}

	private async executeList(
		params: Record<string, unknown>,
		eventBus: ExecutionEventBus,
		taskId: string,
		contextId: string,
	): Promise<void> {
		const wallet = (params.walletAddress as string) || "";
		const request = new Request(SERVER.getInternalUrl(`/files?wallet=${wallet}&page=1&limit=20`), {
			method: "GET",
		});

		const response = await filesHandler(request);
		const result = (await response.json()) as {
			files?: { cid: string; filename: string; status: string }[];
			message?: string;
		};

		if (response.status === 200) {
			const responseText = generateResponse("list", "completed", {
				files: result.files?.map((f) => ({
					cid: f.cid,
					filename: f.filename,
					status: f.status,
				})),
			});

			await this.publishAgentMessage(eventBus, taskId, contextId, responseText, "completed");
		} else {
			await this.publishAgentMessage(
				eventBus,
				taskId,
				contextId,
				`Failed to list files: ${result.message || "Unknown error"}`,
				"failed",
			);
		}

		await updateState({ contextId, state: "completed" });
	}

	private async executeStatus(
		params: Record<string, unknown>,
		eventBus: ExecutionEventBus,
		taskId: string,
		contextId: string,
	): Promise<void> {
		const cid = (params.cid as string) || "";
		const request = new Request(SERVER.getInternalUrl(`/status/${cid}`), {
			method: "GET",
		});

		const response = await statusHandler(request, cid);
		const result = (await response.json()) as {
			cid: string;
			status: string;
			verifiedSPs: number;
			message?: string;
		};

		if (response.status === 200) {
			const responseText = generateResponse("status", "completed", {
				cid: result.cid,
				status: result.status,
				replicatedSPs: result.verifiedSPs,
				totalSPs: 3,
			});

			await this.publishAgentMessage(eventBus, taskId, contextId, responseText, "completed");
		} else {
			await this.publishAgentMessage(
				eventBus,
				taskId,
				contextId,
				`Status check failed: ${result.message || "Unknown error"}`,
				"failed",
			);
		}

		await updateState({ contextId, state: "completed" });
	}

	private async executeAttest(
		params: Record<string, unknown>,
		eventBus: ExecutionEventBus,
		taskId: string,
		contextId: string,
	): Promise<void> {
		const cid = (params.cid as string) || "";

		if (!params.payment) {
			await this.publishAgentMessage(
				eventBus,
				taskId,
				contextId,
				"Attestation requires an x402 micropayment to generate the cryptographic proof. Please provide your payment signature to proceed.",
				"input-required",
			);

			await updateState({ contextId, state: "waiting_input" });

			await appendMessage(contextId, {
				role: "agent",
				content:
					"Attestation requires an x402 micropayment to generate the cryptographic proof. Please provide your payment signature to proceed.",
				timestamp: new Date().toISOString(),
			});
			return;
		}

		// Real HTTP request through the x402 payment middleware
		const headers: Record<string, string> = {
			"payment-signature": Buffer.from(JSON.stringify(params.payment)).toString("base64"),
		};

		const response = await fetch(SERVER.getInternalUrl(`/attest/${cid}`), {
			method: "POST",
			headers,
		});

		const result = (await response.json()) as {
			success?: boolean;
			attestation?: {
				cid: string;
				verification: {
					attestationHash: string;
					verificationHash: string;
				};
				replicationStatus: {
					confirmed: number;
					total: number;
				};
			};
			error?: string;
			message?: string;
		};

		if (response.status === 200 && result.success) {
			const att = result.attestation;
			const responseText = generateResponse("attest", "completed", {
				cid: att?.cid,
				attestationHash: att?.verification?.attestationHash,
				verificationHash: att?.verification?.verificationHash,
				confirmedCount: att?.replicationStatus?.confirmed,
				totalProviders: att?.replicationStatus?.total,
			});

			await this.publishAgentMessage(eventBus, taskId, contextId, responseText, "completed");
		} else if (response.status === 402) {
			await this.publishAgentMessage(
				eventBus,
				taskId,
				contextId,
				`Payment required for attestation. ${result.message || "Please complete x402 payment to proceed."}`,
				"input-required",
			);
			await updateState({ contextId, state: "waiting_input" });
			return;
		} else {
			await this.publishAgentMessage(
				eventBus,
				taskId,
				contextId,
				`Attestation failed: ${result.message || result.error || "Unknown error"}`,
				"failed",
			);
		}

		await updateState({ contextId, state: "completed" });
	}

	private publishProgress(
		eventBus: ExecutionEventBus,
		taskId: string,
		contextId: string,
		message: string,
	): void {
		const statusUpdate: TaskStatusUpdateEvent = {
			kind: "status-update",
			taskId,
			contextId,
			status: {
				state: "working",
				message: {
					kind: "message",
					role: "agent",
					messageId: crypto.randomUUID(),
					parts: [{ kind: "text", text: message }],
					taskId,
					contextId,
				},
				timestamp: new Date().toISOString(),
			},
			final: false,
		};
		eventBus.publish(statusUpdate);
	}

	private async publishAgentMessage(
		eventBus: ExecutionEventBus,
		taskId: string,
		contextId: string,
		text: string,
		state: "completed" | "failed" | "input-required",
	): Promise<void> {
		const statusUpdate: TaskStatusUpdateEvent = {
			kind: "status-update",
			taskId,
			contextId,
			status: {
				state,
				message: {
					kind: "message",
					role: "agent",
					messageId: crypto.randomUUID(),
					parts: [{ kind: "text", text }],
					taskId,
					contextId,
				},
				timestamp: new Date().toISOString(),
			},
			final: true,
		};
		eventBus.publish(statusUpdate);
	}
}
