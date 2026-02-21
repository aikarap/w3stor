import type { Message, Task, TaskStatusUpdateEvent } from "@a2a-js/sdk";
import type { AgentExecutor, ExecutionEventBus, RequestContext } from "@a2a-js/sdk/server";
import { logger, SERVER } from "@w3stor/shared";
import { ConversationHandler } from "./conversation-handler";

// Route handlers — forward requests to the local Hono server's REST endpoints
const uploadHandler = (req: Request): Promise<Response> => fetch(req);
const filesHandler = (req: Request): Promise<Response> => fetch(req);
const statusHandler = (_req: Request, cid: string): Promise<Response> =>
	fetch(SERVER.getInternalUrl(`/status/${cid}`));

export class Web3StorageAgentExecutor implements AgentExecutor {
	private conversationHandler = new ConversationHandler();

	async cancelTask(_taskId: string, _eventBus: ExecutionEventBus): Promise<void> {
		logger.info("Task cancellation requested", { taskId: _taskId });
	}

	async execute(requestContext: RequestContext, eventBus: ExecutionEventBus): Promise<void> {
		const userMessage = requestContext.userMessage;
		const existingTask = requestContext.task;
		const taskId = requestContext.taskId;
		const contextId = requestContext.contextId;

		logger.info("A2A request received", {
			taskId,
			messageId: userMessage.messageId,
			contentType: userMessage.parts?.[0]?.kind,
		});

		try {
			if (!existingTask) {
				const initialTask: Task = {
					kind: "task",
					id: taskId,
					contextId: contextId,
					status: {
						state: "submitted",
						timestamp: new Date().toISOString(),
					},
					history: [userMessage],
					metadata: userMessage.metadata,
				};
				eventBus.publish(initialTask);
			}

			const workingStatus: TaskStatusUpdateEvent = {
				kind: "status-update",
				taskId,
				contextId,
				status: {
					state: "working",
					timestamp: new Date().toISOString(),
				},
				final: false,
			};
			eventBus.publish(workingStatus);

			const textPart = userMessage.parts.find((p) => p.kind === "text");
			const text = textPart && "text" in textPart ? textPart.text : "";

			// Dual-path: try JSON command first, fall back to conversational
			const jsonAction = this.tryParseJsonAction(text);

			if (jsonAction) {
				// Legacy JSON command path (backward compatible)
				if (jsonAction.type === "upload") {
					await this.handleUpload(jsonAction, eventBus, userMessage, taskId, contextId);
				} else if (jsonAction.type === "list") {
					await this.handleList(jsonAction, eventBus, taskId, contextId);
				} else if (jsonAction.type === "status") {
					await this.handleStatus(jsonAction, eventBus, taskId, contextId);
				} else if (jsonAction.type === "attest") {
					await this.handleAttest(jsonAction, eventBus, taskId, contextId);
				} else {
					await this.publishFailure(
						eventBus,
						taskId,
						contextId,
						`Unknown action: ${jsonAction.type}`,
					);
				}
			} else {
				// Conversational path (natural language)
				await this.conversationHandler.handle(requestContext, eventBus);
			}
		} catch (error) {
			logger.error("A2A execution failed", {
				taskId,
				error: error instanceof Error ? error.message : String(error),
			});

			await this.publishFailure(
				eventBus,
				taskId,
				contextId,
				error instanceof Error ? error.message : "Unknown error occurred",
			);
		}
	}

	private tryParseJsonAction(text: string): {
		type: "upload" | "list" | "status" | "attest";
		params: Record<string, unknown>;
	} | null {
		try {
			const parsed = JSON.parse(text);
			if (parsed && typeof parsed === "object" && parsed.action) {
				return {
					type: parsed.action,
					params: parsed.params || {},
				};
			}
			return null;
		} catch {
			return null;
		}
	}

	private async handleUpload(
		action: { params: Record<string, unknown> },
		eventBus: ExecutionEventBus,
		userMessage: Message,
		taskId: string,
		contextId: string,
	): Promise<void> {
		const filePart = userMessage.parts.find((p) => p.kind === "file");

		if (!filePart || filePart.kind !== "file") {
			await this.publishFailure(eventBus, taskId, contextId, "No file data provided");
			return;
		}

		const fileData = filePart.file;
		if (!("bytes" in fileData)) {
			await this.publishFailure(eventBus, taskId, contextId, "File must include bytes data");
			return;
		}

		const filename = (action.params.filename as string) || fileData.name || "file";
		const metadata = (action.params.metadata as Record<string, unknown>) || {};
		const wallet = action.params.wallet as string;
		const payment = action.params.payment as Record<string, unknown>;

		const formData = new FormData();
		const blob = new Blob([Buffer.from(fileData.bytes, "base64")], {
			type: fileData.mimeType || "application/octet-stream",
		});
		formData.append("file", blob, filename);
		formData.append("metadata", JSON.stringify(metadata));
		if (wallet) {
			formData.append("wallet", wallet);
		}

		const headers: Record<string, string> = {};
		if (payment) {
			// x402 v2 protocol: base64-encoded payment payload in PAYMENT-SIGNATURE header
			headers["payment-signature"] = Buffer.from(JSON.stringify(payment)).toString("base64");
		}
		const mockRequest = new Request(SERVER.getInternalUrl("/upload"), {
			method: "POST",
			headers,
			body: formData,
		});

		const response = await uploadHandler(mockRequest);
		const result = (await response.json()) as {
			cid?: string;
			status?: string;
			size?: number;
			message?: string;
		};

		if (response.status === 201) {
			await this.publishSuccess(eventBus, taskId, contextId, {
				success: true,
				cid: result.cid,
				status: result.status,
				size: result.size,
			});
		} else {
			await this.publishFailure(
				eventBus,
				taskId,
				contextId,
				`Upload failed: ${result.message || "Unknown error"}`,
			);
		}
	}

	private async handleList(
		action: { params: Record<string, unknown> },
		eventBus: ExecutionEventBus,
		taskId: string,
		contextId: string,
	): Promise<void> {
		const wallet = action.params.wallet as string;
		const page = (action.params.page as number) || 1;
		const limit = (action.params.limit as number) || 20;

		if (!wallet) {
			await this.publishFailure(eventBus, taskId, contextId, "No wallet address provided");
			return;
		}

		const mockRequest = new Request(
			SERVER.getInternalUrl(`/files?wallet=${wallet}&page=${page}&limit=${limit}`),
			{ method: "GET" },
		);

		const response = await filesHandler(mockRequest);
		const result = (await response.json()) as {
			files?: unknown[];
			total?: number;
			page?: number;
			hasMore?: boolean;
			message?: string;
		};

		if (response.status === 200) {
			await this.publishSuccess(eventBus, taskId, contextId, {
				success: true,
				files: result.files,
				total: result.total,
				page: result.page,
				hasMore: result.hasMore,
			});
		} else {
			await this.publishFailure(
				eventBus,
				taskId,
				contextId,
				`List failed: ${result.message || "Unknown error"}`,
			);
		}
	}

	private async handleStatus(
		action: { params: Record<string, unknown> },
		eventBus: ExecutionEventBus,
		taskId: string,
		contextId: string,
	): Promise<void> {
		const cid = action.params.cid as string;

		if (!cid) {
			await this.publishFailure(eventBus, taskId, contextId, "No CID provided");
			return;
		}

		const mockRequest = new Request(SERVER.getInternalUrl(`/status/${cid}`), {
			method: "GET",
		});

		const response = await statusHandler(mockRequest, cid);
		const result = (await response.json()) as {
			cid?: string;
			status?: string;
			pinataStatus?: boolean;
			filecoinStatus?: Record<string, unknown>;
			verifiedSPs?: number;
			message?: string;
		};

		if (response.status === 200) {
			await this.publishSuccess(eventBus, taskId, contextId, {
				success: true,
				cid: result.cid,
				status: result.status,
				pinataStatus: result.pinataStatus,
				filecoinStatus: result.filecoinStatus,
				verifiedSPs: result.verifiedSPs,
			});
		} else {
			await this.publishFailure(
				eventBus,
				taskId,
				contextId,
				`Status check failed: ${result.message || "Unknown error"}`,
			);
		}
	}

	private async handleAttest(
		action: { params: Record<string, unknown> },
		eventBus: ExecutionEventBus,
		taskId: string,
		contextId: string,
	): Promise<void> {
		const cid = action.params.cid as string;
		const payment = action.params.payment as Record<string, unknown>;

		if (!cid) {
			await this.publishFailure(eventBus, taskId, contextId, "No CID provided");
			return;
		}

		if (!payment) {
			await this.publishFailure(
				eventBus,
				taskId,
				contextId,
				"Attestation requires x402 payment. Provide a signed payment object.",
			);
			return;
		}

		// Real HTTP request through the x402 payment middleware
		const headers: Record<string, string> = {
			"payment-signature": Buffer.from(JSON.stringify(payment)).toString("base64"),
		};

		const response = await fetch(SERVER.getInternalUrl(`/attest/${cid}`), {
			method: "POST",
			headers,
		});

		const result = (await response.json()) as {
			success?: boolean;
			attestation?: {
				cid: string;
				pieceCid: string;
				sizeBytes: number;
				status: string;
				providers: unknown[];
				replicationStatus: {
					confirmed: number;
					total: number;
					fullyReplicated: boolean;
				};
				verification: {
					attestationHash: string;
					verificationHash: string;
					timestamp: string;
					verifier: string;
				};
			};
			error?: string;
			message?: string;
		};

		if (response.status === 200 && result.success) {
			await this.publishSuccess(eventBus, taskId, contextId, {
				success: true,
				attestation: result.attestation,
			});
		} else if (response.status === 402) {
			// x402 payment required — forward the 402 details so the calling agent
			// can complete the payment flow
			await this.publishFailure(
				eventBus,
				taskId,
				contextId,
				`Payment required for attestation. ${result.message || JSON.stringify(result)}`,
			);
		} else {
			await this.publishFailure(
				eventBus,
				taskId,
				contextId,
				`Attestation failed: ${result.message || result.error || "Unknown error"}`,
			);
		}
	}

	private async publishSuccess(
		eventBus: ExecutionEventBus,
		taskId: string,
		contextId: string,
		data: Record<string, unknown>,
	): Promise<void> {
		const completedStatus: TaskStatusUpdateEvent = {
			kind: "status-update",
			taskId,
			contextId,
			status: {
				state: "completed",
				message: {
					kind: "message",
					role: "agent",
					messageId: crypto.randomUUID(),
					parts: [{ kind: "text", text: JSON.stringify(data) }],
					taskId,
					contextId,
				},
				timestamp: new Date().toISOString(),
			},
			final: true,
		};
		eventBus.publish(completedStatus);
	}

	private async publishFailure(
		eventBus: ExecutionEventBus,
		taskId: string,
		contextId: string,
		errorMessage: string,
	): Promise<void> {
		const failedStatus: TaskStatusUpdateEvent = {
			kind: "status-update",
			taskId,
			contextId,
			status: {
				state: "failed",
				message: {
					kind: "message",
					role: "agent",
					messageId: crypto.randomUUID(),
					parts: [{ kind: "text", text: errorMessage }],
					taskId,
					contextId,
				},
				timestamp: new Date().toISOString(),
			},
			final: true,
		};
		eventBus.publish(failedStatus);
	}
}
