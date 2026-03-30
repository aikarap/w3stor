"use client";

import dynamic from "next/dynamic";

const ReactFlowProvider = dynamic(
	() => import("@xyflow/react").then((mod) => mod.ReactFlowProvider),
	{ ssr: false },
);

import { useAtom, useAtomValue, useSetAtom } from "jotai";
import type { Metadata } from "next";
import { useCallback, useEffect, useState } from "react";
import { StorageRequest } from "@/components/swarm/storage-request";
import { ExecutionPanel } from "@/components/workflow/execution-panel";
import { NodeConfigModal } from "@/components/workflow/node-config-sheet";
import { WorkflowCanvas } from "@/components/workflow/workflow-canvas";
import { WorkflowToolbar } from "@/components/workflow/workflow-toolbar";
import { useX402 } from "@/hooks/use-x402";
import {
	costEstimateAtom,
	executionLogsAtom,
	executionPhaseAtom,
	storageArtifactsAtom,
	storagePhaseAtom,
	workflowEdgesAtom,
	workflowNodesAtom,
} from "@/lib/workflow/atoms";
import { estimateCost } from "@/lib/workflow/cost";
import type { StorageArtifact } from "@/lib/workflow/types";

export const metadata: Metadata = {
	title: "Workflow Builder | W3S Agent",
	description: "Build and execute multi-agent storage workflows with x402 micropayments.",
};
export default function SwarmPage() {
	const nodes = useAtomValue(workflowNodesAtom);
	const edges = useAtomValue(workflowEdgesAtom);
	const [phase, setPhase] = useAtom(executionPhaseAtom);
	const [logs, setLogs] = useAtom(executionLogsAtom);
	const setCost = useSetAtom(costEstimateAtom);
	const setNodes = useSetAtom(workflowNodesAtom);
	const [storageArtifacts, setStorageArtifacts] = useAtom(storageArtifactsAtom);
	const [storagePhase, setStoragePhase] = useAtom(storagePhaseAtom);
	const [storedCids, setStoredCids] = useState<Record<string, string>>({});
	const { x402Fetch, isReady } = useX402();

	// Sync execution status back to canvas nodes
	useEffect(() => {
		const logEntries = Object.values(logs);
		if (logEntries.length === 0) return;

		setNodes((prev) =>
			prev.map((node) => {
				const log = logs[node.id];
				if (!log) return node;
				return {
					...node,
					data: { ...node.data, status: log.status },
				};
			}),
		);
	}, [logs, setNodes]);

	const showPanel = phase !== "idle";

	const handleExecute = useCallback(async () => {
		// Reset all state
		setNodes((prev) => prev.map((n) => ({ ...n, data: { ...n.data, status: "idle" } })));
		setLogs({});
		setStorageArtifacts([]);
		setStoragePhase("idle");
		setStoredCids({});

		// 1. Estimate cost
		setPhase("estimating");
		const cost = estimateCost(nodes);
		setCost(cost);

		// 2. Prepare execution payload
		const payload = {
			nodes: nodes.map((n) => ({ id: n.id, type: n.type, data: n.data })),
			edges: edges.map((e) => ({
				id: e.id,
				source: e.source,
				target: e.target,
			})),
		};

		// 3. x402 payment gate (Express returns { authorized: true } after payment)
		setPhase("awaiting-payment");
		try {
			const authRes = await x402Fetch("/workflows/execute", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(payload),
			});

			if (!authRes.ok) {
				const err = await authRes.text();
				throw new Error(err || `HTTP ${authRes.status}`);
			}

			// 4. Stream SSE directly from Next.js API (x402 wrapper consumes response body, killing SSE)
			setPhase("executing");
			const sseRes = await fetch("/api/workflows/execute", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(payload),
			});

			if (!sseRes.ok) {
				const err = await sseRes.text();
				throw new Error(err || `HTTP ${sseRes.status}`);
			}

			const reader = sseRes.body?.getReader();
			const decoder = new TextDecoder();

			if (reader) {
				let buffer = "";
				while (true) {
					const { done, value } = await reader.read();
					if (done) break;
					buffer += decoder.decode(value, { stream: true });

					const lines = buffer.split("\n");
					buffer = lines.pop() ?? "";

					for (const line of lines) {
						if (!line.startsWith("data: ")) continue;
						const data = line.slice(6).trim();
						if (data === "[DONE]") continue;

						try {
							const event = JSON.parse(data);
							if (event.type === "node-start") {
								setLogs((prev) => ({
									...prev,
									[event.nodeId]: {
										nodeId: event.nodeId,
										nodeName: event.nodeName,
										status: "running",
										startedAt: Date.now(),
									},
								}));
							} else if (event.type === "node-complete") {
								setLogs((prev) => ({
									...prev,
									[event.nodeId]: {
										...prev[event.nodeId],
										status: "success",
										completedAt: Date.now(),
										durationMs: event.durationMs,
										output: event.output,
									},
								}));
							} else if (event.type === "node-error") {
								setLogs((prev) => ({
									...prev,
									[event.nodeId]: {
										...prev[event.nodeId],
										status: "error",
										completedAt: Date.now(),
										error: event.error,
									},
								}));
							} else if (event.type === "storage-ready") {
								// Artifacts ready for storage — show StorageRequest
								setStorageArtifacts(event.artifacts as StorageArtifact[]);
								setStoragePhase("pending");
							} else if (event.type === "phase") {
								setPhase(event.phase);
							}
						} catch {
							// ignore malformed SSE lines
						}
					}
				}
			}

			setPhase("complete");
		} catch (err) {
			setPhase("error");
			console.error("Workflow execution failed:", err);
		}
	}, [
		nodes,
		edges,
		x402Fetch,
		setPhase,
		setLogs,
		setCost,
		setNodes,
		setStorageArtifacts,
		setStoragePhase,
	]);

	const handleStore = useCallback(
		async (selectedIds: string[]) => {
			const selected = storageArtifacts.filter((a) => selectedIds.includes(a.nodeId));
			if (selected.length === 0) return;

			setStoragePhase("uploading");

			try {
				for (const artifact of selected) {
					const isImage = artifact.contentType.startsWith("image/");
					const ext = isImage ? artifact.contentType.split("/")[1] : "txt";
					const filename = `${artifact.title.replace(/\s+/g, "-").toLowerCase()}.${ext}`;

					// Decode base64 for images, use raw text for others
					const blob = isImage
						? new Blob([Uint8Array.from(atob(artifact.content), (c) => c.charCodeAt(0))], {
								type: artifact.contentType,
							})
						: new Blob([artifact.content], { type: artifact.contentType });
					const file = new File([blob], filename, {
						type: artifact.contentType,
					});

					const formData = new FormData();
					formData.append("file", file);

					const res = await x402Fetch("/upload", {
						method: "POST",
						body: formData,
					});

					if (!res.ok) {
						const err = await res.text();
						throw new Error(`Upload failed for ${artifact.title}: ${err}`);
					}

					const result = await res.json();
					setStoredCids((prev) => ({ ...prev, [artifact.nodeId]: result.cid }));
				}

				setStoragePhase("stored");

				// Update storage node status on canvas
				setNodes((prev) =>
					prev.map((n) =>
						n.data.type === "storage" ? { ...n, data: { ...n.data, status: "success" } } : n,
					),
				);
			} catch (err) {
				setStoragePhase("error");
				console.error("Storage upload failed:", err);
			}
		},
		[storageArtifacts, x402Fetch, setStoragePhase, setNodes],
	);

	return (
		<div className="flex flex-col min-h-[600px]">
			<main className="flex flex-1 flex-col px-0 pb-4">
				{/* Toolbar */}
				<div className="mb-3">
					<WorkflowToolbar onExecute={handleExecute} />
				</div>

				{/* Canvas + Panel */}
				<div className="flex flex-1 gap-4 min-h-0">
					<div className="flex-1 overflow-hidden rounded-xl border border-border/50">
						<ReactFlowProvider>
							<WorkflowCanvas />
						</ReactFlowProvider>
					</div>

					{/* Execution panel + Storage request (slides in) */}
					{showPanel && (
						<div className="w-80 shrink-0 flex flex-col gap-4 max-h-[calc(100vh-220px)] overflow-y-auto">
							<ExecutionPanel onRetry={handleExecute} />
							{storagePhase !== "idle" && storageArtifacts.length > 0 && (
								<StorageRequest
									artifacts={storageArtifacts}
									phase={storagePhase}
									onStore={handleStore}
									storedCids={storedCids}
								/>
							)}
						</div>
					)}
				</div>
			</main>
			<NodeConfigModal />
		</div>
	);
}
