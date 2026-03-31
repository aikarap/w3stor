"use client";

import dynamic from "next/dynamic";
import { useCallback, useRef } from "react";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), {
	ssr: false,
});

export interface GraphNode {
	id: string;
	label: string;
	type: "Agent" | "File";
	sizeBytes?: number;
	cid?: string;
	mimeType?: string;
	status?: string;
	createdAt?: string;
	wallet?: string;
	description?: string;
	tags?: string[];
}

export interface GraphEdge {
	id: string;
	source: string;
	target: string;
	relationship: string;
}

interface ForceGraphProps {
	nodes: GraphNode[];
	edges: GraphEdge[];
	onNodeClick?: (node: GraphNode) => void;
	width?: number;
	height?: number;
}

const NODE_COLORS: Record<string, string> = {
	Agent: "#6c63ff",
	File: "#2ecc71",
};

const EDGE_COLORS: Record<string, string> = {
	HAS_FILE: "#6c63ff",
	uses_sensor_data: "#e74c3c",
	uses_perception_data: "#f39c12",
	related_sensor_data: "#3498db",
	provides_environment_context: "#9b59b6",
	DEFAULT: "#64748b",
};

function getNodeRadius(node: GraphNode): number {
	if (node.type === "Agent") return 12;
	if (node.sizeBytes) {
		const mb = node.sizeBytes / (1024 * 1024);
		return Math.max(6, Math.min(14, 6 + mb * 2));
	}
	return 8;
}

function getEdgeColor(relationship: string): string {
	return EDGE_COLORS[relationship] ?? EDGE_COLORS.DEFAULT;
}

export function ForceGraph({ nodes, edges, onNodeClick, width, height }: ForceGraphProps) {
	const fgRef = useRef<any>(null);

	const handleNodeClick = useCallback(
		(node: any) => {
			if (node.type === "File" && onNodeClick) {
				onNodeClick(node as GraphNode);
			}
		},
		[onNodeClick],
	);

	const graphData = {
		nodes: nodes.map((n) => ({ ...n })),
		links: edges.map((e) => ({
			source: e.source,
			target: e.target,
			relationship: e.relationship,
			id: e.id,
		})),
	};

	return (
		<ForceGraph2D
			ref={fgRef}
			graphData={graphData}
			width={width}
			height={height}
			backgroundColor="transparent"
			nodeRelSize={1}
			nodeVal={(node: any) => getNodeRadius(node) * 2}
			nodeColor={(node: any) => NODE_COLORS[node.type] ?? "#64748b"}
			nodeLabel={(node: any) => {
				const n = node as GraphNode;
				const parts = [n.label];
				if (n.description) parts.push(n.description);
				if (n.tags?.length) parts.push(`Tags: ${n.tags.join(", ")}`);
				if (n.sizeBytes) {
					const kb = n.sizeBytes / 1024;
					parts.push(kb > 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb.toFixed(0)} KB`);
				}
				return parts.join("\n");
			}}
			nodeCanvasObject={(node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
				const n = node as GraphNode & { x: number; y: number };
				const r = getNodeRadius(n);
				const fontSize = Math.max(10 / globalScale, 3);

				// Draw node circle
				ctx.beginPath();
				ctx.arc(n.x, n.y, r, 0, 2 * Math.PI);
				ctx.fillStyle = NODE_COLORS[n.type] ?? "#64748b";
				ctx.globalAlpha = 0.85;
				ctx.fill();
				ctx.globalAlpha = 0.4;
				ctx.strokeStyle = NODE_COLORS[n.type] ?? "#64748b";
				ctx.lineWidth = 2 / globalScale;
				ctx.stroke();
				ctx.globalAlpha = 1;

				// Draw label below
				const label = n.label.length > 20 ? `${n.label.slice(0, 20)}…` : n.label;
				ctx.font = `${fontSize}px sans-serif`;
				ctx.fillStyle = "#e2e8f0";
				ctx.textAlign = "center";
				ctx.textBaseline = "top";
				ctx.fillText(label, n.x, n.y + r + 2);

				// Type letter inside node
				ctx.font = `bold ${Math.max(r * 0.8, fontSize)}px sans-serif`;
				ctx.fillStyle = "white";
				ctx.textAlign = "center";
				ctx.textBaseline = "middle";
				ctx.fillText(n.type === "Agent" ? "A" : "F", n.x, n.y);
			}}
			nodePointerAreaPaint={(node: any, color: string, ctx: CanvasRenderingContext2D) => {
				const r = getNodeRadius(node as GraphNode);
				ctx.beginPath();
				ctx.arc(node.x, node.y, r + 2, 0, 2 * Math.PI);
				ctx.fillStyle = color;
				ctx.fill();
			}}
			linkColor={(link: any) => getEdgeColor(link.relationship)}
			linkWidth={1.5}
			linkDirectionalArrowLength={6}
			linkDirectionalArrowRelPos={1}
			linkLabel={(link: any) => link.relationship}
			linkCurvature={0.15}
			onNodeClick={handleNodeClick}
			d3AlphaDecay={0.02}
			d3VelocityDecay={0.3}
			cooldownTime={3000}
		/>
	);
}
