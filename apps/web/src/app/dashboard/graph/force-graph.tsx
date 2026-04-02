"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useMemo, useState } from "react";
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
	highlightIds?: Set<string>;
}

const NODE_COLORS: Record<string, number> = {
	Agent: 0x6c63ff,
	File: 0x2ecc71,
};

const EDGE_PALETTE = [
	"#e74c3c", "#3498db", "#2ecc71", "#f39c12", "#9b59b6",
	"#1abc9c", "#e67e22", "#ec407a", "#26c6da", "#ab47bc",
];

/** Deterministic color from any relationship string */
function hashRelColor(rel: string): string {
	let h = 0;
	for (let i = 0; i < rel.length; i++) h = (h * 31 + rel.charCodeAt(i)) | 0;
	return EDGE_PALETTE[Math.abs(h) % EDGE_PALETTE.length];
}

function getNodeRadius(node: GraphNode): number {
	if (node.type === "Agent") return 12;
	if (node.sizeBytes) {
		const mb = node.sizeBytes / (1024 * 1024);
		return Math.max(6, Math.min(14, 6 + mb * 2));
	}
	return 8;
}

function getEdgeColor(relationship: string): string {
	if (relationship === "HAS_FILE") return "#6c63ff";
	return hashRelColor(relationship);
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

export function ForceGraph({ nodes, edges, onNodeClick, width, height, chargeStrength = -120, highlightIds }: ForceGraphProps) {
	const highlighting = highlightIds != null;
	const fgRef = useRef<any>(null);
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		setMounted(true);
		return () => setMounted(false);
	}, []);

	const handleNodeClick = useCallback(
		(node: any) => {
			if (node.type !== "File" || !onNodeClick) return;
			// Block clicks on dimmed nodes during search
			if (highlighting && !highlightIds!.has(node.id)) return;
			onNodeClick(node as GraphNode);
		},
		[onNodeClick, highlighting, highlightIds],
	);

	useEffect(() => {
		const fg = fgRef.current;
		if (!fg) return;
		fg.d3Force("charge")?.strength(chargeStrength);
		fg.d3ReheatSimulation();
	}, [chargeStrength]);



	// Include highlightIds in the dep array so nodeThreeObject re-runs when search changes
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
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[nodes, edges, highlightIds],
	);

	if (!mounted || nodes.length === 0) return null;

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
				const isHit = !highlighting || highlightIds!.has(n.id);
				const nodeOpacity = isHit ? 0.85 : 0.08;
				const ringOpacity = isHit ? 0.25 : 0.03;
				const labelColor = isHit ? "#e2e8f0" : "rgba(226,232,240,0.1)";

				const group = new THREE.Group();

				// Sphere
				const geometry = new THREE.SphereGeometry(r, 24, 24);
				const material = new THREE.MeshLambertMaterial({
					color,
					transparent: true,
					opacity: nodeOpacity,
				});
				const sphere = new THREE.Mesh(geometry, material);
				group.add(sphere);

				// Glow ring
				const ringGeo = new THREE.RingGeometry(r + 1, r + 2.5, 32);
				const ringMat = new THREE.MeshBasicMaterial({
					color,
					transparent: true,
					opacity: ringOpacity,
					side: THREE.DoubleSide,
				});
				const ring = new THREE.Mesh(ringGeo, ringMat);
				group.add(ring);

				// Type letter inside node
				const letterColor = isHit ? "white" : "rgba(255,255,255,0.1)";
				const letter = makeTextSprite(n.type === "Agent" ? "A" : "F", r * 0.8, letterColor);
				group.add(letter);

				// Label below node — prefer filename stem, fall back to short CID
				let label = n.label;
				if (label.includes(".")) label = label.replace(/\.[^.]+$/, ""); // strip extension
				if (label.length > 18) label = `${label.slice(0, 16)}…`;
				const sprite = makeTextSprite(label, 3.5, labelColor);
				sprite.position.y = -(r + 5);
				group.add(sprite);

				return group;
			}}
			nodeLabel={(node: any) => {
				const n = node as GraphNode;
				if (highlighting && !highlightIds!.has(n.id)) return "";
				const parts = [n.label];
				if (n.description) parts.push(n.description);
				if (n.tags?.length) parts.push(`Tags: ${n.tags.join(", ")}`);
				if (n.sizeBytes) {
					const kb = n.sizeBytes / 1024;
					parts.push(kb > 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb.toFixed(0)} KB`);
				}
				return parts.join("<br/>");
			}}
			linkColor={(link: any) => {
				if (!highlighting) return getEdgeColor(link.relationship);
				const srcId = typeof link.source === "object" ? link.source.id : link.source;
				const tgtId = typeof link.target === "object" ? link.target.id : link.target;
				const isHit = highlightIds!.has(srcId) && highlightIds!.has(tgtId);
				return isHit ? getEdgeColor(link.relationship) : "rgba(100,116,139,0.08)";
			}}
			linkWidth={(link: any) => {
				if (!highlighting) return 1.5;
				const srcId = typeof link.source === "object" ? link.source.id : link.source;
				const tgtId = typeof link.target === "object" ? link.target.id : link.target;
				return (highlightIds!.has(srcId) && highlightIds!.has(tgtId)) ? 2.5 : 0.3;
			}}
			linkDirectionalArrowLength={6}
			linkDirectionalArrowRelPos={1}
			linkLabel={(link: any) => link.relationship}
			linkCurvature={0.15}
			linkOpacity={highlighting ? 1 : 0.6}
			onNodeClick={handleNodeClick}
			d3AlphaDecay={0.02}
			d3VelocityDecay={0.3}
			cooldownTime={3000}
		/>
	);
}
