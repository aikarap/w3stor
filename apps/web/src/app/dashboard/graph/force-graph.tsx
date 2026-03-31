"use client";

import * as d3 from "d3";
import { useEffect, useRef } from "react";

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
	// d3 simulation fields
	x?: number;
	y?: number;
	vx?: number;
	vy?: number;
	fx?: number | null;
	fy?: number | null;
}

export interface GraphEdge {
	id: string;
	source: string | GraphNode;
	target: string | GraphNode;
	relationship: string;
}

interface ForceGraphProps {
	nodes: GraphNode[];
	edges: GraphEdge[];
	onNodeClick?: (node: GraphNode) => void;
}

const NODE_COLORS: Record<string, string> = {
	Agent: "#6c63ff",
	File: "#2ecc71",
};

const EDGE_COLORS: Record<string, string> = {
	OWNS: "#6c63ff",
	SIMILAR_TO: "#f39c12",
	RELATED_TO: "#3498db",
	REFERENCES: "#e74c3c",
	DEFAULT: "#64748b",
};

function getNodeRadius(node: GraphNode): number {
	if (node.type === "Agent") return 20;
	if (node.sizeBytes) {
		// Scale file nodes: 8px min, 18px max based on size
		const mb = node.sizeBytes / (1024 * 1024);
		return Math.max(8, Math.min(18, 8 + mb * 2));
	}
	return 10;
}

function getEdgeColor(relationship: string): string {
	return EDGE_COLORS[relationship] ?? EDGE_COLORS.DEFAULT;
}

export function ForceGraph({ nodes, edges, onNodeClick }: ForceGraphProps) {
	const svgRef = useRef<SVGSVGElement>(null);

	useEffect(() => {
		if (!svgRef.current || nodes.length === 0) return;

		const container = svgRef.current.parentElement;
		const width = container?.clientWidth ?? 800;
		const height = container?.clientHeight ?? 600;

		// Clear previous render
		d3.select(svgRef.current).selectAll("*").remove();

		const svg = d3
			.select(svgRef.current)
			.attr("width", width)
			.attr("height", height)
			.attr("viewBox", `0 0 ${width} ${height}`);

		// Zoom + pan
		const g = svg.append("g");
		const zoom = d3
			.zoom<SVGSVGElement, unknown>()
			.scaleExtent([0.2, 5])
			.on("zoom", (event) => {
				g.attr("transform", event.transform);
			});
		svg.call(zoom);

		// Arrow marker defs
		const defs = svg.append("defs");
		const relationships = [...new Set(edges.map((e) => e.relationship))];
		for (const rel of relationships) {
			defs
				.append("marker")
				.attr("id", `arrow-${rel}`)
				.attr("viewBox", "0 -5 10 10")
				.attr("refX", 20)
				.attr("refY", 0)
				.attr("markerWidth", 6)
				.attr("markerHeight", 6)
				.attr("orient", "auto")
				.append("path")
				.attr("d", "M0,-5L10,0L0,5")
				.attr("fill", getEdgeColor(rel))
				.attr("opacity", 0.8);
		}

		// Clone nodes/edges for simulation (d3 mutates)
		const simNodes: GraphNode[] = nodes.map((n) => ({ ...n }));
		const simEdges = edges.map((e) => ({
			...e,
			source: typeof e.source === "string" ? e.source : e.source.id,
			target: typeof e.target === "string" ? e.target : e.target.id,
		}));

		// Force simulation
		const simulation = d3
			.forceSimulation<GraphNode>(simNodes)
			.force(
				"link",
				d3
					.forceLink<GraphNode, (typeof simEdges)[number]>(simEdges as never)
					.id((d) => d.id)
					.distance(120),
			)
			.force("charge", d3.forceManyBody().strength(-300))
			.force("center", d3.forceCenter(width / 2, height / 2))
			.force("collide", d3.forceCollide<GraphNode>().radius((d) => getNodeRadius(d) + 8));

		// Edges
		const link = g
			.append("g")
			.attr("class", "links")
			.selectAll("line")
			.data(simEdges)
			.join("line")
			.attr("stroke", (d) => getEdgeColor(d.relationship))
			.attr("stroke-opacity", 0.6)
			.attr("stroke-width", 1.5)
			.attr("marker-end", (d) => `url(#arrow-${d.relationship})`);

		// Edge labels
		const edgeLabel = g
			.append("g")
			.attr("class", "edge-labels")
			.selectAll("text")
			.data(simEdges)
			.join("text")
			.attr("font-size", "9px")
			.attr("fill", (d) => getEdgeColor(d.relationship))
			.attr("text-anchor", "middle")
			.attr("dominant-baseline", "central")
			.attr("pointer-events", "none")
			.attr("opacity", 0.85)
			.text((d) => d.relationship);

		// Node groups
		const nodeGroup = g
			.append("g")
			.attr("class", "nodes")
			.selectAll<SVGGElement, GraphNode>("g")
			.data(simNodes)
			.join("g")
			.attr("cursor", (d) => (d.type === "File" ? "pointer" : "grab"))
			.on("click", (_event, d) => {
				if (d.type === "File" && onNodeClick) {
					onNodeClick(d);
				}
			});

		// Drag behaviour
		const drag = d3
			.drag<SVGGElement, GraphNode>()
			.on("start", (event, d) => {
				if (!event.active) simulation.alphaTarget(0.3).restart();
				d.fx = d.x;
				d.fy = d.y;
			})
			.on("drag", (event, d) => {
				d.fx = event.x;
				d.fy = event.y;
			})
			.on("end", (event, d) => {
				if (!event.active) simulation.alphaTarget(0);
				d.fx = null;
				d.fy = null;
			});

		nodeGroup.call(drag);

		// Node circles
		nodeGroup
			.append("circle")
			.attr("r", (d) => getNodeRadius(d))
			.attr("fill", (d) => NODE_COLORS[d.type] ?? "#64748b")
			.attr("fill-opacity", 0.85)
			.attr("stroke", (d) => NODE_COLORS[d.type] ?? "#64748b")
			.attr("stroke-width", 2)
			.attr("stroke-opacity", 0.4);

		// Node labels
		nodeGroup
			.append("text")
			.attr("font-size", "10px")
			.attr("fill", "#e2e8f0")
			.attr("text-anchor", "middle")
			.attr("dy", (d) => getNodeRadius(d) + 13)
			.attr("pointer-events", "none")
			.text((d) => {
				const maxLen = 18;
				return d.label.length > maxLen ? `${d.label.slice(0, maxLen)}…` : d.label;
			});

		// Tick update
		simulation.on("tick", () => {
			link
				.attr("x1", (d) => ((d.source as unknown as GraphNode).x ?? 0))
				.attr("y1", (d) => ((d.source as unknown as GraphNode).y ?? 0))
				.attr("x2", (d) => ((d.target as unknown as GraphNode).x ?? 0))
				.attr("y2", (d) => ((d.target as unknown as GraphNode).y ?? 0));

			edgeLabel
				.attr("x", (d) => ((((d.source as unknown as GraphNode).x ?? 0) + ((d.target as unknown as GraphNode).x ?? 0)) / 2))
				.attr("y", (d) => ((((d.source as unknown as GraphNode).y ?? 0) + ((d.target as unknown as GraphNode).y ?? 0)) / 2));

			nodeGroup.attr("transform", (d) => `translate(${d.x ?? 0},${d.y ?? 0})`);
		});

		return () => {
			simulation.stop();
		};
	}, [nodes, edges, onNodeClick]);

	return <svg ref={svgRef} className="w-full h-full" />;
}
