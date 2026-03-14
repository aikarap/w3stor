"use client";

import { useAtom } from "jotai";
import { BlurFade } from "@/components/ui/blur-fade";
import { BorderBeam } from "@/components/ui/border-beam";
import { Card, CardContent } from "@/components/ui/card";
import { NumberTicker } from "@/components/ui/number-ticker";
import {
	pricingAgentsAtom,
	pricingRuntimeMinAtom,
	pricingStorageMBAtom,
	pricingTotalAtom,
} from "@/lib/store";

function Slider({
	label,
	value,
	onChange,
	min,
	max,
	step,
	unit,
}: {
	label: string;
	value: number;
	onChange: (v: number) => void;
	min: number;
	max: number;
	step: number;
	unit: string;
}) {
	return (
		<div className="space-y-2">
			<div className="flex items-center justify-between text-sm">
				<span className="text-muted-foreground">{label}</span>
				<span className="font-mono font-medium">
					{value} {unit}
				</span>
			</div>
			<input
				type="range"
				min={min}
				max={max}
				step={step}
				value={value}
				onChange={(e) => onChange(Number(e.target.value))}
				className="w-full h-1.5 appearance-none rounded-full bg-border cursor-pointer accent-blue-500
          [&::-webkit-slider-thumb]:appearance-none
          [&::-webkit-slider-thumb]:h-4
          [&::-webkit-slider-thumb]:w-4
          [&::-webkit-slider-thumb]:rounded-full
          [&::-webkit-slider-thumb]:bg-blue-500
          [&::-webkit-slider-thumb]:shadow-sm
          [&::-webkit-slider-thumb]:transition-transform
          [&::-webkit-slider-thumb]:hover:scale-110"
			/>
		</div>
	);
}

export function PricingCalculator() {
	const [agents, setAgents] = useAtom(pricingAgentsAtom);
	const [runtime, setRuntime] = useAtom(pricingRuntimeMinAtom);
	const [storage, setStorage] = useAtom(pricingStorageMBAtom);
	const [total] = useAtom(pricingTotalAtom);

	const compute = agents * runtime * 0.014;
	const storageCost = storage * 0.0001;

	return (
		<section className="mx-auto max-w-3xl px-4 py-24">
			<BlurFade delay={0.05}>
				<div className="mb-10 text-center">
					<h2 className="text-3xl font-bold">Unified Pricing</h2>
					<p className="mt-3 max-w-xl mx-auto text-muted-foreground">
						Compute + storage in one number. Know the cost before execution.
					</p>
				</div>
			</BlurFade>

			<BlurFade delay={0.1}>
				<Card className="relative overflow-hidden border-border/50 bg-card/60 backdrop-blur-sm">
					<BorderBeam size={100} duration={14} colorFrom="#3b82f6" colorTo="#8b5cf6" />
					<CardContent className="p-8 space-y-8">
						{/* Total display */}
						<div className="text-center">
							<p className="text-xs font-medium uppercase tracking-widest text-muted-foreground mb-2">
								Estimated Cost
							</p>
							<div className="flex items-baseline justify-center gap-2">
								<NumberTicker
									value={total}
									decimalPlaces={4}
									className="text-5xl font-bold tracking-tight text-foreground"
								/>
								<span className="text-lg font-medium text-muted-foreground">USDFC</span>
							</div>
						</div>

						{/* Sliders */}
						<div className="space-y-6">
							<Slider
								label="Agents"
								value={agents}
								onChange={setAgents}
								min={1}
								max={10}
								step={1}
								unit="agents"
							/>
							<Slider
								label="Runtime"
								value={runtime}
								onChange={setRuntime}
								min={1}
								max={30}
								step={1}
								unit="min"
							/>
							<Slider
								label="Storage"
								value={storage}
								onChange={setStorage}
								min={1}
								max={1000}
								step={1}
								unit="MB"
							/>
						</div>

						{/* Breakdown */}
						<div className="grid grid-cols-2 gap-4 rounded-xl border border-border/40 bg-muted/30 p-4">
							<div className="text-center">
								<p className="text-xs text-muted-foreground mb-1">Compute cost</p>
								<p className="font-mono text-sm font-semibold">
									{compute.toFixed(4)}{" "}
									<span className="text-muted-foreground font-normal">USDFC</span>
								</p>
								<p className="text-[10px] text-muted-foreground/60 mt-0.5">$0.014 / agent·min</p>
							</div>
							<div className="text-center">
								<p className="text-xs text-muted-foreground mb-1">Storage cost</p>
								<p className="font-mono text-sm font-semibold">
									{storageCost.toFixed(4)}{" "}
									<span className="text-muted-foreground font-normal">USDFC</span>
								</p>
								<p className="text-[10px] text-muted-foreground/60 mt-0.5">$0.0001 / MB</p>
							</div>
						</div>
					</CardContent>
				</Card>
			</BlurFade>
		</section>
	);
}
