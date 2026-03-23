"use client";

import { Cpu, DollarSign, HardDrive } from "lucide-react";
import { motion } from "motion/react";
import { NumberTicker } from "@/components/ui/number-ticker";

interface CostAccrualProps {
	breakdown: { compute: number; storage: number };
	agentCount: number;
	isRunning: boolean;
}

export function CostAccrual({ breakdown, agentCount, isRunning }: CostAccrualProps) {
	const total = breakdown.compute + breakdown.storage;

	return (
		<motion.div
			initial={{ opacity: 0, x: 20 }}
			animate={{ opacity: 1, x: 0 }}
			transition={{ duration: 0.4 }}
			className="rounded-xl border border-border/50 bg-card/60 p-4 backdrop-blur-sm"
		>
			<div className="mb-3 flex items-center justify-between">
				<h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
					Cost Accrual
				</h3>
				<div className="flex items-center gap-1.5">
					{isRunning && (
						<span className="relative flex h-2 w-2">
							<span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
							<span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
						</span>
					)}
					<span className="text-xs text-muted-foreground">{agentCount} agents</span>
				</div>
			</div>

			{/* Total */}
			<div className="mb-4 flex items-baseline gap-1">
				<DollarSign className="h-4 w-4 text-green-400 shrink-0 self-center" />
				<NumberTicker
					value={total}
					decimalPlaces={4}
					className="text-2xl font-bold text-foreground"
				/>
				<span className="text-sm text-muted-foreground">USDFC</span>
			</div>

			{/* Breakdown */}
			<div className="space-y-2">
				<div className="flex items-center justify-between text-xs">
					<div className="flex items-center gap-1.5 text-muted-foreground">
						<Cpu className="h-3.5 w-3.5 text-amber-400" />
						<span>Compute</span>
					</div>
					<span className="font-medium tabular-nums">{breakdown.compute.toFixed(4)}</span>
				</div>
				<div className="flex items-center justify-between text-xs">
					<div className="flex items-center gap-1.5 text-muted-foreground">
						<HardDrive className="h-3.5 w-3.5 text-blue-400" />
						<span>Storage</span>
					</div>
					<span className="font-medium tabular-nums">{breakdown.storage.toFixed(4)}</span>
				</div>
			</div>
		</motion.div>
	);
}
