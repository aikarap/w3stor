import type { Edge, Node } from "@xyflow/react";

export type ModelCategory = "llm" | "image" | "multimodal" | "video";

export interface ModelDefinition {
	id: string;
	gatewayId: string; // provider-prefixed ID for AI SDK gateway (e.g. "openai/dall-e-3")
	label: string;
	provider: string;
	category: ModelCategory;
	costPerCall: number;
	description?: string;
}

export type WorkflowNodeType = "trigger" | "agent" | "storage";
export type NodeExecutionStatus = "idle" | "running" | "success" | "error";

export interface TriggerNodeData extends Record<string, unknown> {
	type: "trigger";
	label: string;
	triggerType: "manual";
	status: NodeExecutionStatus;
}

export interface AgentNodeData extends Record<string, unknown> {
	type: "agent";
	label: string;
	role: string;
	modelId: string;
	prompt: string;
	status: NodeExecutionStatus;
	output?: unknown;
	error?: string;
	durationMs?: number;
}

export interface StorageNodeData extends Record<string, unknown> {
	type: "storage";
	label: string;
	status: NodeExecutionStatus;
	storedCids?: string[];
}

export type WorkflowNodeData = TriggerNodeData | AgentNodeData | StorageNodeData;
export type WorkflowNode = Node<WorkflowNodeData>;
export type WorkflowEdge = Edge;

export type ExecutionPhase =
	| "idle"
	| "estimating"
	| "awaiting-payment"
	| "executing"
	| "storing"
	| "complete"
	| "error";

export interface ExecutionLogEntry {
	nodeId: string;
	nodeName: string;
	status: NodeExecutionStatus;
	startedAt?: number;
	completedAt?: number;
	durationMs?: number;
	output?: unknown;
	error?: string;
}

export interface StorageArtifact {
	nodeId: string;
	title: string;
	content: string;
	contentType: string; // "text/plain", "image/png", etc.
	size: number; // bytes
	cid?: string; // set after upload
}

export type StoragePhase = "idle" | "pending" | "uploading" | "stored" | "error";

export interface CostEstimate {
	compute: number;
	storage: number;
	total: number;
	breakdown: Array<{ nodeId: string; label: string; cost: number }>;
}
