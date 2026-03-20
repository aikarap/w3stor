"use client";

import {
	BaseEdge,
	EdgeLabelRenderer,
	type EdgeProps,
	getSmoothStepPath,
	useReactFlow,
} from "@xyflow/react";

export function DeletableEdge({
	id,
	sourceX,
	sourceY,
	targetX,
	targetY,
	sourcePosition,
	targetPosition,
	style,
	markerEnd,
	selected,
}: EdgeProps) {
	const { setEdges } = useReactFlow();
	const [edgePath, labelX, labelY] = getSmoothStepPath({
		sourceX,
		sourceY,
		sourcePosition,
		targetX,
		targetY,
		targetPosition,
	});

	return (
		<>
			<BaseEdge path={edgePath} markerEnd={markerEnd} style={style} />
			<EdgeLabelRenderer>
				<div
					className="edge-delete-btn"
					style={{
						position: "absolute",
						transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
						pointerEvents: "all",
					}}
				>
					<button
						type="button"
						className="nodrag nopan"
						onClick={(e) => {
							e.stopPropagation();
							setEdges((eds) => eds.filter((edge) => edge.id !== id));
						}}
					>
						×
					</button>
				</div>
			</EdgeLabelRenderer>
		</>
	);
}
