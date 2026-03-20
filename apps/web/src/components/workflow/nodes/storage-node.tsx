"use client";

import { Handle, type NodeProps, NodeResizer, Position } from "@xyflow/react";
import { Check, HardDrive, Loader2, XCircle } from "lucide-react";
import { memo } from "react";
import { cn } from "@/lib/utils";
import type { StorageNodeData } from "@/lib/workflow/types";

export const StorageNode = memo(({ data, selected }: NodeProps & { data: StorageNodeData }) => {
	const { status, label, storedCids } = data;
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
			<Handle
				type="target"
				position={Position.Top}
				id="top"
				className="!bg-emerald-500 !h-2.5 !w-2.5 !border-2 !border-background"
			/>
			<Handle
				type="target"
				position={Position.Left}
				id="left"
				className="!bg-emerald-500 !h-2.5 !w-2.5 !border-2 !border-background"
			/>
			<Handle
				type="target"
				position={Position.Right}
				id="right"
				className="!bg-emerald-500 !h-2.5 !w-2.5 !border-2 !border-background"
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

			<HardDrive className="mb-2 h-8 w-8 text-emerald-500" strokeWidth={1.5} />
			<span className="text-sm font-semibold">{label}</span>
			<span className="text-[10px] text-muted-foreground">Filecoin Storage</span>
			{storedCids && storedCids.length > 0 && (
				<span className="mt-1 text-[10px] text-green-400">{storedCids.length} CIDs stored</span>
			)}
		</div>
	);
});
StorageNode.displayName = "StorageNode";
