"use client";

import { useAtom } from "jotai";
import { useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { selectedNodeIdAtom, workflowNodesAtom } from "@/lib/workflow/atoms";

export function NodeConfigModal() {
	const [selectedId, setSelectedId] = useAtom(selectedNodeIdAtom);
	const [nodes, setNodes] = useAtom(workflowNodesAtom);

	const node = selectedId ? nodes.find((n) => n.id === selectedId) : null;

	const updateNodeData = useCallback(
		(field: string, value: string) => {
			if (!selectedId) return;
			setNodes((prev) =>
				prev.map((n) => (n.id === selectedId ? { ...n, data: { ...n.data, [field]: value } } : n)),
			);
		},
		[selectedId, setNodes],
	);

	const isOpen = !!node && node.data.type === "agent" && node.data.status === "idle";

	return (
		<Dialog
			open={isOpen}
			onOpenChange={(open) => {
				if (!open) setSelectedId(null);
			}}
		>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Configure Agent</DialogTitle>
				</DialogHeader>

				{node && node.data.type === "agent" && (
					<div className="space-y-4 pt-2">
						<div>
							<label className="text-xs font-medium text-muted-foreground">Name</label>
							<Input
								value={node.data.label}
								onChange={(e) => updateNodeData("label", e.target.value)}
								className="mt-1 h-9"
							/>
						</div>
						<div>
							<label className="text-xs font-medium text-muted-foreground">Role</label>
							<Input
								value={node.data.role}
								onChange={(e) => updateNodeData("role", e.target.value)}
								className="mt-1 h-9"
							/>
						</div>
						<div>
							<label className="text-xs font-medium text-muted-foreground">System Prompt</label>
							<textarea
								value={node.data.prompt}
								onChange={(e) => updateNodeData("prompt", e.target.value)}
								rows={6}
								className="mt-1 w-full resize-none rounded-lg border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
								placeholder="Instructions for this agent..."
							/>
						</div>
					</div>
				)}
			</DialogContent>
		</Dialog>
	);
}
