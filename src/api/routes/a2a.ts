import {
	DefaultRequestHandler,
	InMemoryTaskStore,
	JsonRpcTransportHandler,
	ServerCallContext,
} from "@a2a-js/sdk/server";
import { web3StorageAgentCard, Web3StorageAgentExecutor } from "@w3stor/sdk/a2a";
import { logger } from "@w3stor/shared";
import { Hono } from "hono";

// Singleton A2A handler — initialized once on first request
let jsonRpcHandler: JsonRpcTransportHandler | null = null;
let requestHandler: DefaultRequestHandler | null = null;

function getA2AHandler() {
	if (!jsonRpcHandler) {
		const taskStore = new InMemoryTaskStore();
		const executor = new Web3StorageAgentExecutor();
		requestHandler = new DefaultRequestHandler(
			web3StorageAgentCard,
			taskStore,
			executor,
		);
		jsonRpcHandler = new JsonRpcTransportHandler(requestHandler);
		logger.info("A2A JSON-RPC handler initialized");
	}
	return { jsonRpcHandler, requestHandler: requestHandler! };
}

export const a2aRoutes = new Hono();

a2aRoutes.get("/.well-known/agent-card.json", (c) => {
	return c.json(web3StorageAgentCard);
});

/** GET /.well-known/a2a — A2A 1.0 discovery endpoint (forward-compat) */
a2aRoutes.get("/.well-known/a2a", (c) => {
	return c.json(web3StorageAgentCard);
});

/** POST /a2a/jsonrpc — A2A JSON-RPC 2.0 protocol */
a2aRoutes.post("/a2a/jsonrpc", async (c) => {
	try {
		const { jsonRpcHandler: handler } = getA2AHandler();
		const body = await c.req.json();

		const context = new ServerCallContext(undefined, undefined);
		const result = await handler.handle(body, context);

		// Streaming response (AsyncGenerator)
		if (result && typeof (result as any)[Symbol.asyncIterator] === "function") {
			const stream = result as AsyncGenerator<any>;
			const encoder = new TextEncoder();

			const readable = new ReadableStream({
				async start(controller) {
					try {
						for await (const event of stream) {
							controller.enqueue(
								encoder.encode(`data: ${JSON.stringify(event)}\n\n`),
							);
						}
					} catch (err) {
						logger.error("A2A SSE stream error", {
							error: err instanceof Error ? err.message : String(err),
						});
					} finally {
						controller.close();
					}
				},
			});

			return new Response(readable, {
				headers: {
					"Content-Type": "text/event-stream",
					"Cache-Control": "no-cache",
					Connection: "keep-alive",
				},
			});
		}

		// Single response
		return c.json(result);
	} catch (err) {
		logger.error("A2A JSON-RPC error", {
			error: err instanceof Error ? err.message : String(err),
		});
		return c.json(
			{
				jsonrpc: "2.0",
				error: { code: -32603, message: "Internal error" },
				id: null,
			},
			500,
		);
	}
});

/** POST /a2a/rest — A2A REST protocol (message/send) */
a2aRoutes.post("/a2a/rest", async (c) => {
	try {
		const { requestHandler: handler } = getA2AHandler();
		const body = await c.req.json();
		const context = new ServerCallContext(undefined, undefined);

		const result = await handler.sendMessage(body, context);
		return c.json(result);
	} catch (err) {
		logger.error("A2A REST error", {
			error: err instanceof Error ? err.message : String(err),
		});
		return c.json(
			{ error: err instanceof Error ? err.message : "Internal error" },
			500,
		);
	}
});
