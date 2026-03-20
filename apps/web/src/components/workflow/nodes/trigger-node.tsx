"use client";

import { Handle, type NodeProps, NodeResizer, Position } from "@xyflow/react";
import { Check, Loader2, Play, XCircle } from "lucide-react";
import { memo } from "react";
import { cn } from "@/lib/utils";
import type { TriggerNodeData } from "@/lib/workflow/types";

export const TriggerNode = memo(({ data, selected }: NodeProps & { data: TriggerNodeData }) => {
	const { status, label } = data;
	const isRunning = status === "running";

	return (
		<div
			className={cn(
				"relative flex min-h-36 min-w-36 h-full w-full flex-col items-center justify-center rounded-2xl border bg-card shadow-sm transition-all",
				selected && "ring-2 ring-primary ring-offset-2 ring-offset-background",
				isRunning && "border-blue-500/60",
				status === "success" && "border-green-500/40",
				status === "error" && "border-red-500/40",
			)}
		>
			<NodeResizer
				isVisible={selected}
				minWidth={144}
				minHeight={144}
				lineClassName="!border-primary/30"
				handleClassName="!h-2.5 !w-2.5 !rounded-full !border-2 !border-primary !bg-background"
			/>
			{status !== "idle" && (
				<div
					className={cn(
						"absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full",
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

			<Play className="mb-2 h-8 w-8 text-blue-500" strokeWidth={1.5} />
			<span className="max-w-[120px] text-sm font-semibold truncate">{label}</span>
			<span className="text-[10px] text-muted-foreground">Manual Trigger</span>

			<Handle
				type="source"
				position={Position.Bottom}
				id="bottom"
				className="!bg-blue-500 !h-2.5 !w-2.5 !border-2 !border-background"
			/>
			<Handle
				type="source"
				position={Position.Right}
				id="right"
				className="!bg-blue-500 !h-2.5 !w-2.5 !border-2 !border-background"
			/>
			<Handle
				type="source"
				position={Position.Left}
				id="left"
				className="!bg-blue-500 !h-2.5 !w-2.5 !border-2 !border-background"
			/>
		</div>
	);
});
TriggerNode.displayName = "TriggerNode";
