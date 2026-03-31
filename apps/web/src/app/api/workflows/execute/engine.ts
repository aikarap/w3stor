import { gateway, generateImage, generateText } from "ai";
import { getModel } from "@/lib/workflow/models";

interface EngineNode {
	id: string;
	type: string;
	data: {
		type: "trigger" | "agent" | "storage";
		label: string;
		modelId?: string;
		role?: string;
		prompt?: string;
		[key: string]: unknown;
	};
}

interface EngineEdge {
	id: string;
	source: string;
	target: string;
}

type SSECallback = (event: Record<string, unknown>) => void;

function topologicalSort(nodes: EngineNode[], edges: EngineEdge[]): string[] {
	const inDegree = new Map<string, number>();
	const adj = new Map<string, string[]>();

	for (const node of nodes) {
		inDegree.set(node.id, 0);
		adj.set(node.id, []);
	}

	for (const edge of edges) {
		adj.get(edge.source)?.push(edge.target);
		inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1);
	}

	const queue: string[] = [];
	for (const [id, degree] of inDegree) {
		if (degree === 0) queue.push(id);
	}

	const sorted: string[] = [];
	while (queue.length > 0) {
		const current = queue.shift()!;
		sorted.push(current);

		for (const neighbor of adj.get(current) ?? []) {
			const newDegree = (inDegree.get(neighbor) ?? 1) - 1;
			inDegree.set(neighbor, newDegree);
			if (newDegree === 0) queue.push(neighbor);
		}
	}

	return sorted;
}

function buildPrompt(
	node: EngineNode,
	upstreamOutputs: Map<string, unknown>,
	edges: EngineEdge[],
): { systemPrompt: string; userMessage: string } {
	const upstreamNodes = edges.filter((e) => e.target === node.id).map((e) => e.source);

	const context = upstreamNodes
		.map((id) => {
			const output = upstreamOutputs.get(id);
			return output
				? `[From upstream node ${id}]: ${typeof output === "string" ? output : JSON.stringify(output)}`
				: "";
		})
		.filter(Boolean)
		.join("\n\n");

	const systemPrompt = node.data.prompt || node.data.role || "You are a helpful AI agent.";
	const userMessage = context
		? `${context}\n\nYour task: ${node.data.role ?? "Process the above information."}`
		: (node.data.role ?? "Execute your assigned task.");

	return { systemPrompt, userMessage };
}

async function executeAgentNode(
	node: EngineNode,
	upstreamOutputs: Map<string, unknown>,
	edges: EngineEdge[],
): Promise<{ output: unknown; durationMs: number }> {
	const start = Date.now();
	const modelId = node.data.modelId ?? "gpt-4o";
	const modelDef = getModel(modelId);
	const category = modelDef?.category ?? "llm";
	const gatewayId = modelDef?.gatewayId ?? modelId;

	const { systemPrompt, userMessage } = buildPrompt(node, upstreamOutputs, edges);

	if (category === "image") {
		const result = await generateImage({
			model: gateway.image(gatewayId),
			prompt: `${systemPrompt}\n\n${userMessage}`,
		});

		const image = result.images[0];
		return {
			output: image
				? { type: "image", base64: image.base64, mimeType: image.mediaType ?? "image/png" }
				: { type: "image", error: "No image generated" },
			durationMs: Date.now() - start,
		};
	}

	if (category === "multimodal") {
		const result = await generateText({
			model: gateway(gatewayId),
			system: systemPrompt,
			prompt: userMessage,
			maxOutputTokens: 2048,
		});

		const images = result.files.map((file) => ({
			base64: file.base64,
			mimeType: file.mediaType,
		}));

		return {
			output: {
				type: "multimodal",
				text: result.text || undefined,
				images,
			},
			durationMs: Date.now() - start,
		};
	}

	// LLM text generation
	const result = await generateText({
		model: gateway(gatewayId),
		system: systemPrompt,
		prompt: userMessage,
		maxOutputTokens: 2048,
	});

	return {
		output: result.text,
		durationMs: Date.now() - start,
	};
}

export async function executeWorkflow(
	nodes: EngineNode[],
	edges: EngineEdge[],
	emit: SSECallback,
): Promise<void> {
	const sorted = topologicalSort(nodes, edges);
	const nodeMap = new Map(nodes.map((n) => [n.id, n]));
	const outputs = new Map<string, unknown>();

	for (const nodeId of sorted) {
		const node = nodeMap.get(nodeId);
		if (!node) continue;

		if (node.data.type === "trigger") {
			emit({ type: "node-start", nodeId, nodeName: node.data.label });
			outputs.set(nodeId, { triggered: true, timestamp: Date.now() });
			emit({
				type: "node-complete",
				nodeId,
				nodeName: node.data.label,
				durationMs: 0,
				output: { triggered: true },
			});
			continue;
		}

		if (node.data.type === "agent") {
			emit({ type: "node-start", nodeId, nodeName: node.data.label });

			try {
				const { output, durationMs } = await executeAgentNode(node, outputs, edges);
				outputs.set(nodeId, output);
				emit({ type: "node-complete", nodeId, nodeName: node.data.label, durationMs, output });
			} catch (err) {
				const error = err instanceof Error ? err.message : "Unknown error";
				emit({ type: "node-error", nodeId, nodeName: node.data.label, error });
			}
			continue;
		}

		if (node.data.type === "storage") {
			emit({ type: "node-start", nodeId, nodeName: node.data.label });

			const upstreamNodes = edges.filter((e) => e.target === nodeId).map((e) => e.source);
			const artifacts = upstreamNodes.flatMap((id) => {
				const upstream = nodeMap.get(id);
				const data = outputs.get(id);
				if (!data) return [];
				const label = upstream?.data.label ?? id;

				// Handle image-only outputs
				if (
					typeof data === "object" &&
					data !== null &&
					"type" in data &&
					(data as Record<string, unknown>).type === "image"
				) {
					const img = data as { type: string; base64?: string; mimeType?: string };
					if (img.base64) {
						const size = Math.ceil(img.base64.length * 0.75);
						return [
							{
								nodeId: id,
								title: label,
								content: img.base64,
								contentType: img.mimeType ?? "image/png",
								size,
							},
						];
					}
				}

				// Handle multimodal outputs — one artifact per image + one for text
				if (
					typeof data === "object" &&
					data !== null &&
					"type" in data &&
					(data as Record<string, unknown>).type === "multimodal"
				) {
					const mm = data as {
						type: string;
						text?: string;
						images: Array<{ base64: string; mimeType: string }>;
					};
					const results: Array<{
						nodeId: string;
						title: string;
						content: string;
						contentType: string;
						size: number;
					}> = [];

					if (mm.text) {
						results.push({
							nodeId: id,
							title: `${label} — text`,
							content: mm.text,
							contentType: "text/plain",
							size: new TextEncoder().encode(mm.text).length,
						});
					}

					mm.images.forEach((img, idx) => {
						const size = Math.ceil(img.base64.length * 0.75);
						results.push({
							nodeId: id,
							title: `${label} — image ${idx + 1}`,
							content: img.base64,
							contentType: img.mimeType ?? "image/png",
							size,
						});
					});

					return results;
				}

				// Text/JSON outputs
				const content = typeof data === "string" ? data : JSON.stringify(data, null, 2);
				return [
					{
						nodeId: id,
						title: label,
						content,
						contentType: "text/plain",
						size: new TextEncoder().encode(content).length,
					},
				];
			});

			emit({
				type: "storage-ready",
				nodeId,
				nodeName: node.data.label,
				artifacts,
			});

			outputs.set(nodeId, { awaitingStorage: true, artifactCount: artifacts.length });
			emit({
				type: "node-complete",
				nodeId,
				nodeName: node.data.label,
				durationMs: 0,
				output: { awaitingStorage: true, artifactCount: artifacts.length },
			});
		}
	}

	emit({ type: "phase", phase: "complete" });
}
