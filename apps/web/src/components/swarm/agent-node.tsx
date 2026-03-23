"use client";

import { motion } from "motion/react";
import { cn } from "@/lib/utils";

export type AgentStatus = "idle" | "thinking" | "producing" | "done";

export interface AgentDefinition {
	id: string;
	name: string;
	role: string;
	position: { x: string; y: string };
	color: string;
}

interface AgentNodeProps {
	agent: AgentDefinition;
	status: AgentStatus;
	delay?: number;
}

const statusDotColor: Record<AgentStatus, string> = {
	idle: "bg-neutral-500",
	thinking: "bg-yellow-400",
	producing: "bg-blue-400",
	done: "bg-green-400",
};

export function AgentNode({ agent, status, delay = 0 }: AgentNodeProps) {
	const isActive = status === "thinking" || status === "producing";

	return (
		<motion.div
			className="absolute flex flex-col items-center gap-2"
			style={{ left: agent.position.x, top: agent.position.y, translate: "-50% -50%" }}
			initial={{ scale: 0, opacity: 0 }}
			animate={{ scale: 1, opacity: 1 }}
			transition={{ type: "spring", stiffness: 260, damping: 20, delay }}
		>
			{/* Glow ring */}
			<div className="relative">
				{isActive && (
					<motion.div
						className="absolute inset-0 rounded-full"
						style={{
							boxShadow: `0 0 20px 4px ${agent.color}40`,
							background: `radial-gradient(circle, ${agent.color}15 0%, transparent 70%)`,
						}}
						animate={{ scale: [1, 1.3, 1], opacity: [0.6, 1, 0.6] }}
						transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
					/>
				)}

				{/* Agent circle */}
				<div
					className={cn(
						"relative flex h-16 w-16 items-center justify-center rounded-full border border-border/50 bg-card text-xl font-bold shadow-lg",
						status === "done" && "border-green-500/40",
					)}
					style={{
						borderColor: isActive ? `${agent.color}60` : undefined,
					}}
				>
					{agent.name[0]}
				</div>

				{/* Status dot */}
				<span className="absolute -right-0.5 -top-0.5 flex h-3.5 w-3.5 items-center justify-center">
					{isActive && (
						<span
							className={cn(
								"absolute inline-flex h-full w-full animate-ping rounded-full opacity-75",
								statusDotColor[status],
							)}
						/>
					)}
					<span
						className={cn("relative inline-flex h-2.5 w-2.5 rounded-full", statusDotColor[status])}
					/>
				</span>
			</div>

			{/* Labels */}
			<div className="text-center">
				<p className="text-sm font-semibold leading-tight">{agent.name}</p>
				<p className="text-xs text-muted-foreground">{agent.role}</p>
			</div>
		</motion.div>
	);
}
