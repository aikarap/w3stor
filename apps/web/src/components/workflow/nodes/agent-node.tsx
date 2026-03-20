"use client";

import { Handle, type NodeProps, NodeResizer, Position } from "@xyflow/react";
import { useSetAtom } from "jotai";
import {
	Bot,
	Check,
	ImageIcon,
	Loader2,
	MessageSquare,
	Pencil,
	VideoIcon,
	XCircle,
} from "lucide-react";
import { memo, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { selectedNodeIdAtom, workflowNodesAtom } from "@/lib/workflow/atoms";
import { getModel } from "@/lib/workflow/models";
import type { AgentNodeData } from "@/lib/workflow/types";
import { ModelSelector } from "../model-selector";

const categoryIcon: Record<string, React.ElementType> = {
	llm: MessageSquare,
	image: ImageIcon,
	multimodal: Bot,
	video: VideoIcon,
};

export const AgentNode = memo(
	({ data, selected, id }: NodeProps & { data: AgentNodeData; id: string }) => {
		const { status, label, role, modelId } = data;
		const model = getModel(modelId);
		const isRunning = status === "running";
		const CategoryIcon = categoryIcon[model?.category ?? "llm"] ?? Bot;

		const setNodes = useSetAtom(workflowNodesAtom);
		const setSelectedNodeId = useSetAtom(selectedNodeIdAtom);

		const handleModelChange = useCallback(
			(newModelId: string) => {
				setNodes((prev) =>
					prev.map((n) => (n.id === id ? { ...n, data: { ...n.data, modelId: newModelId } } : n)),
				);
			},
			[id, setNodes],
		);

		return (
			<div
				className={cn(
					"relative flex min-w-52 w-full h-full flex-col rounded-2xl border bg-card shadow-sm transition-all",
					selected && "ring-2 ring-primary ring-offset-2 ring-offset-background",
					isRunning && "border-blue-500/60 shadow-blue-500/10 shadow-lg",
					status === "success" && "border-green-500/40",
					status === "error" && "border-red-500/40",
				)}
			>
				<NodeResizer
					isVisible={selected}
					minWidth={208}
					minHeight={120}
					lineClassName="!border-primary/30"
					handleClassName="!h-2.5 !w-2.5 !rounded-full !border-2 !border-primary !bg-background"
				/>
				<Handle
					type="target"
					position={Position.Top}
					id="top"
					className="!bg-violet-500 !h-2.5 !w-2.5 !border-2 !border-background"
				/>
				<Handle
					type="target"
					position={Position.Left}
					id="left"
					className="!bg-violet-500 !h-2.5 !w-2.5 !border-2 !border-background"
				/>

				{status !== "idle" && (
					<div
						className={cn(
							"absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full z-10",
							status === "running" && "bg-blue-500",
							status === "success" && "bg-green-500",
							status === "error" && "bg-red-500",
						)}
					>
						{status === "running" && <Loader2 className="h-3 w-3 animate-spin text-white" />}
						{status === "success" && <Check className="h-3 w-3 text-white" />}
						{status === "error" && <XCircle className="h-3 w-3 text-white" />}
					</div>
				)}

				<div className="p-3">
					<div className="mb-2 flex items-center gap-2">
						<CategoryIcon className="h-5 w-5 text-violet-400 shrink-0" strokeWidth={1.5} />
						<div className="min-w-0 flex-1">
							<div className="text-sm font-semibold truncate">{label}</div>
							<div className="text-[10px] text-muted-foreground truncate">{role}</div>
						</div>
						{status === "idle" && (
							<button
								onClick={(e) => {
									e.stopPropagation();
									setSelectedNodeId(id);
								}}
								className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
								title="Edit agent details"
							>
								<Pencil className="h-3 w-3" />
							</button>
						)}
					</div>

					{status === "idle" ? (
						<ModelSelector value={modelId} onValueChange={handleModelChange} />
					) : (
						<div className="flex items-center gap-1.5">
							<Badge variant="outline" className="text-[9px] h-4 px-1.5">
								{model?.label ?? modelId}
							</Badge>
							{model && (
								<span className="text-[9px] text-muted-foreground">
									${model.costPerCall.toFixed(4)}
								</span>
							)}
						</div>
					)}

					{model && status === "idle" && (
						<div className="mt-1.5 text-[10px] text-muted-foreground">
							~${model.costPerCall.toFixed(4)}/call
						</div>
					)}
				</div>

				<Handle
					type="source"
					position={Position.Bottom}
					id="bottom"
					className="!bg-violet-500 !h-2.5 !w-2.5 !border-2 !border-background"
				/>
				<Handle
					type="source"
					position={Position.Right}
					id="right"
					className="!bg-violet-500 !h-2.5 !w-2.5 !border-2 !border-background"
				/>
			</div>
		);
	},
);
AgentNode.displayName = "AgentNode";
