"use client";

import { Check, Loader2 } from "lucide-react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

export type StepStatus = "pending" | "active" | "done";

export interface TimelineStep {
	label: string;
	status: StepStatus;
}

interface SwarmTimelineProps {
	steps: TimelineStep[];
}

export function SwarmTimeline({ steps }: SwarmTimelineProps) {
	return (
		<div className="flex flex-col gap-0">
			{steps.map((step, i) => (
				<motion.div
					key={step.label}
					initial={{ opacity: 0, x: -12 }}
					animate={{ opacity: 1, x: 0 }}
					transition={{ duration: 0.3, delay: i * 0.06 }}
					className="flex items-start gap-3"
				>
					{/* Indicator column */}
					<div className="flex flex-col items-center">
						<div
							className={cn(
								"flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-medium",
								step.status === "done" && "border-green-500/60 bg-green-500/10 text-green-400",
								step.status === "active" && "border-blue-500/60 bg-blue-500/10 text-blue-400",
								step.status === "pending" && "border-border/60 bg-card text-muted-foreground",
							)}
						>
							{step.status === "done" ? (
								<Check className="h-3.5 w-3.5" />
							) : step.status === "active" ? (
								<Loader2 className="h-3.5 w-3.5 animate-spin" />
							) : (
								<span>{i + 1}</span>
							)}
						</div>
						{/* Connector line */}
						{i < steps.length - 1 && (
							<div
								className={cn(
									"h-4 w-px",
									step.status === "done" ? "bg-green-500/30" : "bg-border/30",
								)}
							/>
						)}
					</div>

					{/* Label */}
					<p
						className={cn(
							"pt-0.5 text-sm leading-tight",
							step.status === "done" && "text-foreground",
							step.status === "active" && "font-medium text-blue-400",
							step.status === "pending" && "text-muted-foreground",
						)}
					>
						{step.label}
					</p>
				</motion.div>
			))}
		</div>
	);
}
