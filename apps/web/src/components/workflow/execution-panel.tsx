"use client";

import { useAtomValue } from "jotai";
import { Check, ChevronDown, ChevronRight, Clock, Loader2, RotateCcw, XCircle } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { costEstimateAtom, executionLogsAtom, executionPhaseAtom } from "@/lib/workflow/atoms";
import type { ExecutionLogEntry } from "@/lib/workflow/types";

function StatusIcon({ status }: { status: string }) {
	switch (status) {
		case "success":
			return <Check className="h-3 w-3 text-white" />;
		case "error":
			return <XCircle className="h-3 w-3 text-white" />;
		case "running":
			return <Loader2 className="h-3 w-3 animate-spin text-white" />;
		default:
			return <Clock className="h-3 w-3 text-white" />;
	}
}

function statusDotClass(status: string) {
	switch (status) {
		case "success":
			return "bg-green-600";
		case "error":
			return "bg-red-600";
		case "running":
			return "bg-blue-600";
		default:
			return "bg-muted-foreground";
	}
}

function LogEntry({ entry }: { entry: ExecutionLogEntry }) {
	const [expanded, setExpanded] = useState(false);

	return (
		<div className="flex gap-3">
			<div className="flex flex-col items-center pt-1">
				<div
					className={cn(
						"flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
						statusDotClass(entry.status),
					)}
				>
					<StatusIcon status={entry.status} />
				</div>
				<div className="flex-1 w-px bg-border" />
			</div>
			<div className="min-w-0 flex-1 pb-4">
				<button
					onClick={() => setExpanded(!expanded)}
					className="flex w-full items-center gap-2 text-left"
				>
					{expanded ? (
						<ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
					) : (
						<ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
					)}
					<span className="text-sm font-medium truncate">{entry.nodeName}</span>
					{entry.durationMs != null && (
						<span className="ml-auto text-[10px] text-muted-foreground tabular-nums shrink-0">
							{entry.durationMs < 1000
								? `${entry.durationMs}ms`
								: `${(entry.durationMs / 1000).toFixed(1)}s`}
						</span>
					)}
				</button>
				<AnimatePresence>
					{expanded && !!entry.output && (
						<motion.div
							initial={{ height: 0, opacity: 0 }}
							animate={{ height: "auto", opacity: 1 }}
							exit={{ height: 0, opacity: 0 }}
							className="mt-2 overflow-hidden"
						>
							<pre className="overflow-auto rounded-lg border bg-muted/50 p-2 text-[10px] font-mono leading-relaxed max-h-40">
								{typeof entry.output === "string"
									? entry.output
									: JSON.stringify(entry.output, null, 2)}
							</pre>
						</motion.div>
					)}
					{expanded && entry.error && (
						<motion.div
							initial={{ height: 0, opacity: 0 }}
							animate={{ height: "auto", opacity: 1 }}
							exit={{ height: 0, opacity: 0 }}
							className="mt-2 overflow-hidden"
						>
							<pre className="overflow-auto rounded-lg border border-red-500/20 bg-red-500/5 p-2 text-[10px] font-mono text-red-400 leading-relaxed max-h-40">
								{entry.error}
							</pre>
						</motion.div>
					)}
				</AnimatePresence>
			</div>
		</div>
	);
}

interface ExecutionPanelProps {
	onRetry?: () => void;
}

export function ExecutionPanel({ onRetry }: ExecutionPanelProps) {
	const logs = useAtomValue(executionLogsAtom);
	const phase = useAtomValue(executionPhaseAtom);
	const cost = useAtomValue(costEstimateAtom);

	const entries = Object.values(logs).sort((a, b) => (a.startedAt ?? 0) - (b.startedAt ?? 0));
	const isActive = phase !== "idle" && phase !== "complete" && phase !== "error";

	if (entries.length === 0 && !isActive) return null;

	return (
		<motion.div
			initial={{ opacity: 0, x: 20 }}
			animate={{ opacity: 1, x: 0 }}
			className="flex h-full flex-col overflow-hidden rounded-xl border border-border/50 bg-card/80 backdrop-blur-sm"
		>
			<div className="flex items-center justify-between border-b border-border/50 px-4 py-3">
				<h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
					Execution
				</h3>
				{isActive && (
					<span className="relative flex h-2 w-2">
						<span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
						<span className="relative inline-flex h-2 w-2 rounded-full bg-blue-500" />
					</span>
				)}
			</div>

			{cost && (
				<div className="border-b border-border/50 px-4 py-2.5">
					<div className="flex items-baseline gap-1">
						<span className="text-lg font-bold">${cost.total.toFixed(4)}</span>
						<span className="text-xs text-muted-foreground">USDFC</span>
					</div>
					<div className="mt-1 flex gap-4 text-[10px] text-muted-foreground">
						<span>Compute: ${cost.compute.toFixed(4)}</span>
						<span>Storage: ${cost.storage.toFixed(4)}</span>
					</div>
				</div>
			)}

			<div className="flex-1 overflow-y-auto p-4">
				{entries.map((entry) => (
					<LogEntry key={entry.nodeId} entry={entry} />
				))}
			</div>

			{phase !== "idle" && (
				<div className="border-t border-border/50 px-4 py-2.5">
					<div className="flex items-center justify-between">
						<div
							className={cn(
								"text-xs font-medium",
								phase === "complete" && "text-green-400",
								phase === "error" && "text-red-400",
								(phase === "executing" ||
									phase === "storing" ||
									phase === "awaiting-payment" ||
									phase === "estimating") &&
									"text-blue-400",
							)}
						>
							{phase === "estimating" && "Estimating cost..."}
							{phase === "awaiting-payment" && "Awaiting x402 payment..."}
							{phase === "executing" && "Executing workflow..."}
							{phase === "storing" && "Storing artifacts on Filecoin..."}
							{phase === "complete" && "Workflow complete"}
							{phase === "error" && "Execution failed"}
						</div>
						{(phase === "error" || phase === "complete") && onRetry && (
							<Button size="sm" variant="outline" onClick={onRetry} className="gap-1.5 h-7 text-xs">
								<RotateCcw className="h-3 w-3" />
								Retry
							</Button>
						)}
					</div>
				</div>
			)}
		</motion.div>
	);
}

