import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import type {
	AgentNodeData,
	CostEstimate,
	ExecutionLogEntry,
	ExecutionPhase,
	StorageArtifact,
	StorageNodeData,
	StoragePhase,
	TriggerNodeData,
	WorkflowEdge,
	WorkflowNode,
} from "./types";

const DEFAULT_NODES: WorkflowNode[] = [
	{
		id: "trigger-1",
		type: "trigger",
		position: { x: 250, y: 50 },
		style: { width: 144, height: 144 },
		data: {
			type: "trigger",
			label: "Start",
			triggerType: "manual",
			status: "idle",
		} as TriggerNodeData,
	},
	{
		id: "agent-1",
		type: "agent",
		position: { x: 218, y: 250 },
		style: { width: 208, height: 140 },
		data: {
			type: "agent",
			label: "Research Agent",
			role: "Analyze and summarize a topic",
			modelId: "gpt-4o",
			prompt: "",
			status: "idle",
		} as AgentNodeData,
	},
	{
		id: "storage-1",
		type: "storage",
		position: { x: 250, y: 450 },
		style: { width: 144, height: 144 },
		data: { type: "storage", label: "Store on Filecoin", status: "idle" } as StorageNodeData,
	},
];

const DEFAULT_EDGES: WorkflowEdge[] = [
	{
		id: "e-trigger-agent",
		source: "trigger-1",
		sourceHandle: "bottom",
		target: "agent-1",
		targetHandle: "top",
		type: "deletable",
		animated: true,
	},
	{
		id: "e-agent-storage",
		source: "agent-1",
		sourceHandle: "bottom",
		target: "storage-1",
		targetHandle: "top",
		type: "deletable",
		animated: true,
	},
];

export const workflowNodesAtom = atomWithStorage<WorkflowNode[]>(
	"w3s-workflow-nodes-v2",
	DEFAULT_NODES,
);
export const workflowEdgesAtom = atomWithStorage<WorkflowEdge[]>(
	"w3s-workflow-edges-v2",
	DEFAULT_EDGES,
);
export const selectedNodeIdAtom = atom<string | null>(null);

export const executionPhaseAtom = atom<ExecutionPhase>("idle");
export const executionLogsAtom = atom<Record<string, ExecutionLogEntry>>({});
export const executionErrorAtom = atom<string | null>(null);

export const costEstimateAtom = atom<CostEstimate | null>(null);

export const selectedNodeAtom = atom((get) => {
	const id = get(selectedNodeIdAtom);
	if (!id) return null;
	return get(workflowNodesAtom).find((n) => n.id === id) ?? null;
});

export const workflowTaskAtom = atom<string>("");

export const storageArtifactsAtom = atom<StorageArtifact[]>([]);
export const storagePhaseAtom = atom<StoragePhase>("idle");
