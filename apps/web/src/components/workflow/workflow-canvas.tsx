"use client";

import {
	addEdge,
	applyEdgeChanges,
	applyNodeChanges,
	Background,
	BackgroundVariant,
	type Connection,
	ConnectionMode,
	Controls,
	type EdgeTypes,
	MiniMap,
	type NodeTypes,
	type OnConnect,
	ReactFlow,
} from "@xyflow/react";
import { useCallback, useState, useRef } from "react";
import "@xyflow/react/dist/style.css";
import { useAtom } from "jotai";
import { selectedNodeIdAtom, workflowEdgesAtom, workflowNodesAtom } from "@/lib/workflow/atoms";
import type { WorkflowNode } from "@/lib/workflow/types";
import { DeletableEdge } from "./edges/deletable-edge";
import { AgentNode } from "./nodes/agent-node";
import { StorageNode } from "./nodes/storage-node";
import { TriggerNode } from "./nodes/trigger-node";
import { ContextMenu } from "./context-menu";

const nodeTypes: NodeTypes = {
	trigger: TriggerNode as any,
	agent: AgentNode as any,
	storage: StorageNode as any,
};

const edgeTypes: EdgeTypes = {
	deletable: DeletableEdge as any,
};

interface MenuState {
	x: number;
	y: number;
	nodeId: string | null;
	canvasPosition: { x: number; y: number };
}

export function WorkflowCanvas() {
	const [nodes, setNodes] = useAtom(workflowNodesAtom);
	const [edges, setEdges] = useAtom(workflowEdgesAtom);
	const [, setSelectedNodeId] = useAtom(selectedNodeIdAtom);
	const [menu, setMenu] = useState<MenuState | null>(null);
	const reactFlowWrapper = useRef<HTMLDivElement>(null);

	const onNodesChange = useCallback(
		(changes: any) => {
			setNodes((nds) => applyNodeChanges(changes, nds as any) as unknown as WorkflowNode[]);
		},
		[setNodes],
	);

	const onEdgesChange = useCallback(
		(changes: any) => {
			setEdges((eds) => applyEdgeChanges(changes, eds));
		},
		[setEdges],
	);

	const onConnect: OnConnect = useCallback(
		(connection: Connection) => {
			setEdges((eds) => {
				// Prevent duplicate connections between same source and target
				const isDuplicate = eds.some(
					(e) => e.source === connection.source && e.target === connection.target,
				);
				if (isDuplicate || connection.source === connection.target) return eds;
				return addEdge({ ...connection, type: "deletable", animated: true }, eds);
			});
		},
		[setEdges],
	);

	const onPaneClick = useCallback(() => {
		setSelectedNodeId(null);
		setMenu(null);
	}, [setSelectedNodeId]);

	const onPaneContextMenu = useCallback(
		(event: any) => {
			event.preventDefault();
			if (!reactFlowWrapper.current) return;
			const bounds = reactFlowWrapper.current.getBoundingClientRect();
			const canvasX = event.clientX - bounds.left;
			const canvasY = event.clientY - bounds.top;
			setMenu({
				x: event.clientX,
				y: event.clientY,
				nodeId: null,
				canvasPosition: { x: canvasX, y: canvasY },
			});
		},
		[],
	);

	const onNodeContextMenu = useCallback(
		(event: any, node: any) => {
			event.preventDefault();
			setMenu({
				x: event.clientX,
				y: event.clientY,
				nodeId: node.id,
				canvasPosition: node.position,
			});
		},
		[],
	);

	return (
		<div className="h-full w-full" ref={reactFlowWrapper}>
			<ReactFlow
				nodes={nodes}
				edges={edges}
				onNodesChange={onNodesChange}
				onEdgesChange={onEdgesChange}
				onConnect={onConnect}
				onPaneClick={onPaneClick}
				onPaneContextMenu={onPaneContextMenu}
				onNodeContextMenu={onNodeContextMenu}
				nodeTypes={nodeTypes}
				edgeTypes={edgeTypes}
				connectionMode={ConnectionMode.Loose}
				fitView
				fitViewOptions={{ padding: 0.3, maxZoom: 1 }}
				deleteKeyCode="Backspace"
				defaultEdgeOptions={{ type: "deletable", animated: true, interactionWidth: 20 }}
				proOptions={{ hideAttribution: true }}
				edgesReconnectable
			>
				<Background
					variant={BackgroundVariant.Dots}
					gap={24}
					size={1}
					color="hsl(var(--muted-foreground) / 0.15)"
				/>
				<Controls className="!bg-card !border-border !shadow-lg" />
				<MiniMap
					className="!bg-card !border-border"
					nodeStrokeColor="hsl(var(--border))"
					nodeColor="hsl(var(--muted))"
					maskColor="hsl(var(--background) / 0.7)"
				/>
			</ReactFlow>

			{menu && (
				<ContextMenu
					x={menu.x}
					y={menu.y}
					nodeId={menu.nodeId}
					canvasPosition={menu.canvasPosition}
					onClose={() => setMenu(null)}
				/>
			)}
		</div>
	);
}
