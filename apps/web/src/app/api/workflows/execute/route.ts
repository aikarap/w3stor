import { executeWorkflow } from "./engine";

export const maxDuration = 120;

export async function POST(req: Request) {
	const body = await req.json();
	const { nodes, edges } = body;

	if (!nodes?.length || !edges) {
		return new Response(JSON.stringify({ error: "Invalid workflow" }), {
			status: 400,
			headers: { "Content-Type": "application/json" },
		});
	}

	const encoder = new TextEncoder();
	const stream = new ReadableStream({
		async start(controller) {
			function emit(event: Record<string, unknown>) {
				controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
			}

			try {
				await executeWorkflow(nodes, edges, emit);
				controller.enqueue(encoder.encode("data: [DONE]\n\n"));
			} catch (err) {
				emit({ type: "phase", phase: "error" });
				emit({ type: "error", message: err instanceof Error ? err.message : "Unknown error" });
				controller.enqueue(encoder.encode("data: [DONE]\n\n"));
			} finally {
				controller.close();
			}
		},
	});

	return new Response(stream, {
		headers: {
			"Content-Type": "text/event-stream",
			"Cache-Control": "no-cache",
			Connection: "keep-alive",
		},
	});
}
