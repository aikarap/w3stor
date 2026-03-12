import { getModel } from "./models";
import type { CostEstimate, WorkflowNode } from "./types";

const STORAGE_COST_PER_MB = 0.0001;
const DEFAULT_ARTIFACT_SIZE_MB = 2;

export function estimateCost(nodes: WorkflowNode[]): CostEstimate {
	let compute = 0;
	let storage = 0;
	const breakdown: CostEstimate["breakdown"] = [];

	for (const node of nodes) {
		if (node.data.type === "agent") {
			const model = getModel(node.data.modelId);
			const cost = model?.costPerCall ?? 0.01;
			compute += cost;
			breakdown.push({ nodeId: node.id, label: node.data.label, cost });
		}

		if (node.data.type === "storage") {
			const upstreamAgents = nodes.filter((n) => n.data.type === "agent").length;
			storage = upstreamAgents * DEFAULT_ARTIFACT_SIZE_MB * STORAGE_COST_PER_MB;
		}
	}

	return { compute, storage, total: compute + storage, breakdown };
}
