"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useMemo } from "react";
import * as THREE from "three";

const ForceGraph3D = dynamic(() => import("react-force-graph-3d"), {
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
	chargeStrength?: number;
}

const NODE_COLORS: Record<string, number> = {
	Agent: 0x6c63ff,
	File: 0x2ecc71,
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

function makeTextSprite(text: string, size: number, color: string): THREE.Sprite {
	const canvas = document.createElement("canvas");
	const ctx = canvas.getContext("2d")!;
	const fontSize = 64;
	ctx.font = `bold ${fontSize}px sans-serif`;
	const metrics = ctx.measureText(text);
	canvas.width = Math.ceil(metrics.width) + 16;
	canvas.height = fontSize + 16;
	// re-set font after resize
	ctx.font = `bold ${fontSize}px sans-serif`;
	ctx.fillStyle = color;
	ctx.textAlign = "center";
	ctx.textBaseline = "middle";
	ctx.fillText(text, canvas.width / 2, canvas.height / 2);

	const texture = new THREE.CanvasTexture(canvas);
	texture.minFilter = THREE.LinearFilter;
	const material = new THREE.SpriteMaterial({ map: texture, depthWrite: false, transparent: true });
	const sprite = new THREE.Sprite(material);
	sprite.scale.set(size * (canvas.width / canvas.height), size, 1);
	return sprite;
}

export function ForceGraph({ nodes, edges, onNodeClick, width, height, chargeStrength = -120 }: ForceGraphProps) {
	const fgRef = useRef<any>(null);

	const handleNodeClick = useCallback(
		(node: any) => {
			if (node.type === "File" && onNodeClick) {
				onNodeClick(node as GraphNode);
			}
		},
		[onNodeClick],
	);

	useEffect(() => {
		const fg = fgRef.current;
		if (!fg) return;
		fg.d3Force("charge")?.strength(chargeStrength);
		fg.d3ReheatSimulation();
	}, [chargeStrength]);


	const graphData = useMemo(
		() => ({
			nodes: nodes.map((n) => ({ ...n })),
			links: edges.map((e) => ({
				source: e.source,
				target: e.target,
				relationship: e.relationship,
				id: e.id,
			})),
		}),
		[nodes, edges],
	);

	return (
		<ForceGraph3D
			ref={fgRef}
			graphData={graphData}
			width={width}
			height={height}
			backgroundColor="rgba(0,0,0,0)"
			controlType="orbit"
			nodeThreeObject={(node: any) => {
				const n = node as GraphNode;
				const r = getNodeRadius(n);
				const color = NODE_COLORS[n.type] ?? 0x64748b;

				const group = new THREE.Group();

				// Sphere
				const geometry = new THREE.SphereGeometry(r, 24, 24);
				const material = new THREE.MeshLambertMaterial({
					color,
					transparent: true,
					opacity: 0.85,
				});
				const sphere = new THREE.Mesh(geometry, material);
				group.add(sphere);

				// Glow ring
				const ringGeo = new THREE.RingGeometry(r + 1, r + 2.5, 32);
				const ringMat = new THREE.MeshBasicMaterial({
					color,
					transparent: true,
					opacity: 0.25,
					side: THREE.DoubleSide,
				});
				const ring = new THREE.Mesh(ringGeo, ringMat);
				group.add(ring);

				// Type letter inside node
				const letter = makeTextSprite(n.type === "Agent" ? "A" : "F", r * 0.8, "white");
				group.add(letter);

				// Label below node
				const label = n.label.length > 20 ? `${n.label.slice(0, 20)}…` : n.label;
				const sprite = makeTextSprite(label, 4, "#e2e8f0");
				sprite.position.y = -(r + 6);
				group.add(sprite);

				return group;
			}}
			nodeLabel={(node: any) => {
				const n = node as GraphNode;
				const parts = [n.label];
				if (n.description) parts.push(n.description);
				if (n.tags?.length) parts.push(`Tags: ${n.tags.join(", ")}`);
				if (n.sizeBytes) {
					const kb = n.sizeBytes / 1024;
					parts.push(kb > 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb.toFixed(0)} KB`);
				}
				return parts.join("<br/>");
			}}
			linkColor={(link: any) => getEdgeColor(link.relationship)}
			linkWidth={1.5}
			linkDirectionalArrowLength={6}
			linkDirectionalArrowRelPos={1}
			linkLabel={(link: any) => link.relationship}
			linkCurvature={0.15}
			linkOpacity={0.6}
			onNodeClick={handleNodeClick}
			d3AlphaDecay={0.02}
			d3VelocityDecay={0.3}
			cooldownTime={3000}
		/>
	);
}
