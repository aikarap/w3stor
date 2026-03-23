"use client";

import { Code, Database, FileText, FlaskConical } from "lucide-react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

export interface Artifact {
	id: string;
	title: string;
	type: "paper" | "dataset" | "code" | "experiment";
	agent: string;
	size: string;
}

const typeConfig: Record<Artifact["type"], { icon: React.ElementType; color: string; bg: string }> =
	{
		paper: { icon: FileText, color: "text-orange-400", bg: "bg-orange-400/10" },
		dataset: { icon: Database, color: "text-purple-400", bg: "bg-purple-400/10" },
		code: { icon: Code, color: "text-emerald-400", bg: "bg-emerald-400/10" },
		experiment: { icon: FlaskConical, color: "text-cyan-400", bg: "bg-cyan-400/10" },
	};

interface ArtifactCardProps {
	artifact: Artifact;
	index: number;
}

export function ArtifactCard({ artifact, index }: ArtifactCardProps) {
	const { icon: Icon, color, bg } = typeConfig[artifact.type];

	return (
		<motion.div
			initial={{ opacity: 0, y: 16 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.4, delay: index * 0.05 }}
			className={cn(
				"flex items-center gap-3 rounded-lg border border-border/50 bg-card/80 px-3 py-2.5 backdrop-blur-sm",
				"shadow-[0_0_12px_-4px] shadow-blue-500/10",
			)}
		>
			<div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-md", bg)}>
				<Icon className={cn("h-4 w-4", color)} />
			</div>
			<div className="min-w-0 flex-1">
				<p className="truncate text-sm font-medium">{artifact.title}</p>
				<p className="text-xs text-muted-foreground">
					{artifact.agent} &middot; {artifact.size}
				</p>
			</div>
		</motion.div>
	);
}
