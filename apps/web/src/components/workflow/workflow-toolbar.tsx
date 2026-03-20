"use client";

import { useAtom, useAtomValue } from "jotai";
import { Bot, CreditCard, DollarSign, HardDrive, Loader2, Play } from "lucide-react";
import { nanoid } from "nanoid";
import { useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
	costEstimateAtom,
	executionPhaseAtom,
	workflowEdgesAtom,
	workflowNodesAtom,
} from "@/lib/workflow/atoms";
import { estimateCost } from "@/lib/workflow/cost";
import type {
	AgentNodeData,
	StorageNodeData,
	TriggerNodeData,
	WorkflowNode,
} from "@/lib/workflow/types";

interface WorkflowToolbarProps {
	onExecute: () => void;
}

export function WorkflowToolbar({ onExecute }: WorkflowToolbarProps) {
	const [nodes, setNodes] = useAtom(workflowNodesAtom);
	const [_edges] = useAtom(workflowEdgesAtom);
	const phase = useAtomValue(executionPhaseAtom);
	const [, _setCostEstimate] = useAtom(costEstimateAtom);

	const cost = useMemo(() => estimateCost(nodes), [nodes]);

	const isExecuting = phase === "executing" || phase === "storing";
	const isIdle = phase === "idle";

	const hasTrigger = nodes.some((n) => n.data.type === "trigger");
	const hasAgent = nodes.some((n) => n.data.type === "agent");
	const hasStorage = nodes.some((n) => n.data.type === "storage");

	const getNextPosition = useCallback(() => {
		if (nodes.length === 0) return { x: 250, y: 50 };
		const maxY = Math.max(...nodes.map((n) => n.position.y));
		return { x: 250, y: maxY + 200 };
	}, [nodes]);

	const addTriggerNode = useCallback(() => {
		const node: WorkflowNode = {
			id: nanoid(),
			type: "trigger",
			position: { x: 250, y: 50 },
			data: {
				type: "trigger",
				label: "Start",
				triggerType: "manual",
				status: "idle",
			} as TriggerNodeData,
		};
		setNodes((prev) => [...prev, node]);
	}, [setNodes]);

	const addAgentNode = useCallback(() => {
		const pos = getNextPosition();
		const agentCount = nodes.filter((n) => n.data.type === "agent").length;
		const node: WorkflowNode = {
			id: nanoid(),
			type: "agent",
			position: pos,
			data: {
				type: "agent",
				label: `Agent ${agentCount + 1}`,
				role: "Describe this agent's task",
				modelId: "gpt-4o",
				prompt: "",
				status: "idle",
			} as AgentNodeData,
		};
		setNodes((prev) => [...prev, node]);
	}, [nodes, getNextPosition, setNodes]);

	const addStorageNode = useCallback(() => {
		const pos = getNextPosition();
		const node: WorkflowNode = {
			id: nanoid(),
			type: "storage",
			position: { x: pos.x, y: pos.y + 50 },
			data: { type: "storage", label: "Store on Filecoin", status: "idle" } as StorageNodeData,
		};
		setNodes((prev) => [...prev, node]);
	}, [getNextPosition, setNodes]);

	return (
		<div className="flex items-center justify-between gap-3 rounded-xl border border-border/50 bg-card/80 px-4 py-2.5 backdrop-blur-sm">
			<div className="flex items-center gap-2">
				<TooltipProvider>
					{!hasTrigger && (
						<Tooltip>
							<TooltipTrigger render={<span />}>
								<Button
									size="sm"
									variant="outline"
									onClick={addTriggerNode}
									disabled={!isIdle}
									className="gap-1.5 text-xs"
								>
									<Play className="h-3.5 w-3.5 text-blue-500" />
									Trigger
								</Button>
							</TooltipTrigger>
							<TooltipContent>Add a manual trigger to start the workflow</TooltipContent>
						</Tooltip>
					)}
					<Tooltip>
						<TooltipTrigger render={<span />}>
							<Button
								size="sm"
								variant="outline"
								onClick={addAgentNode}
								disabled={!isIdle}
								className="gap-1.5 text-xs"
							>
								<Bot className="h-3.5 w-3.5 text-violet-500" />
								Agent
							</Button>
						</TooltipTrigger>
						<TooltipContent>Add an AI agent node</TooltipContent>
					</Tooltip>
					{!hasStorage && (
						<Tooltip>
							<TooltipTrigger render={<span />}>
								<Button
									size="sm"
									variant="outline"
									onClick={addStorageNode}
									disabled={!isIdle}
									className="gap-1.5 text-xs"
								>
									<HardDrive className="h-3.5 w-3.5 text-emerald-500" />
									Storage
								</Button>
							</TooltipTrigger>
							<TooltipContent>Add Filecoin storage sink</TooltipContent>
						</Tooltip>
					)}
				</TooltipProvider>
			</div>

			{hasAgent && (
				<div className="flex items-center gap-2 rounded-lg border border-border/50 bg-muted/30 px-3 py-1.5">
					<DollarSign className="h-3.5 w-3.5 text-green-400" />
					<span className="text-xs font-medium">{cost.total.toFixed(4)}</span>
					<span className="text-[10px] text-muted-foreground">USDFC</span>
				</div>
			)}

			<Button
				size="sm"
				onClick={onExecute}
				disabled={!isIdle || !hasTrigger || !hasAgent}
				className="gap-1.5"
			>
				{isExecuting ? (
					<>
						<Loader2 className="h-3.5 w-3.5 animate-spin" />
						Executing...
					</>
				) : (
					<>
						<CreditCard className="h-3.5 w-3.5" />
						Pay &amp; Execute
					</>
				)}
			</Button>
		</div>
	);
}
