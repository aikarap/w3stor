"use client";

import { Boxes, DollarSign, MessageSquare } from "lucide-react";
import { BlurFade } from "@/components/ui/blur-fade";
import { Card, CardContent } from "@/components/ui/card";
import { SpotlightGrid } from "@/components/ui/spotlight-grid";

const steps = [
	{
		num: 1,
		icon: MessageSquare,
		color: "text-blue-400",
		bg: "bg-blue-500/10",
		title: "Describe Your Task",
		description:
			"Tell any AI agent what you need stored — files, datasets, research artifacts. Use natural language through any protocol.",
	},
	{
		num: 2,
		icon: DollarSign,
		color: "text-emerald-400",
		bg: "bg-emerald-500/10",
		title: "Review Cost Estimate",
		description:
			"Unified pricing for compute + storage. One number in USDFC before execution starts.",
	},
	{
		num: 3,
		icon: Boxes,
		color: "text-purple-400",
		bg: "bg-purple-500/10",
		title: "Agents Execute & Store",
		description:
			"Agents run your workflow and store artifacts permanently on Filecoin. Track progress in real-time. Pay per-request with x402.",
	},
];

export function HowItWorks() {
	return (
		<section className="mx-auto max-w-7xl px-4 py-24">
			<BlurFade delay={0.1}>
				<p className="mb-3 text-center text-xs font-medium uppercase tracking-[0.2em] text-blue-400">
					How It Works
				</p>
				<h2 className="mb-4 text-center text-3xl font-bold">Know the Cost Before You Start</h2>
				<p className="mx-auto mb-12 max-w-xl text-center text-muted-foreground">
					Three steps from idea to permanent storage — with a transparent cost estimate at step two,
					before any agent runs.
				</p>
			</BlurFade>

			<SpotlightGrid glowColor="59, 130, 246" className="relative grid grid-cols-1 gap-6 sm:grid-cols-3">
				{/* Connector line visible on desktop */}
				<div className="absolute left-1/2 top-10 hidden h-px w-[calc(66.6%-3rem)] -translate-x-1/2 border-t border-dashed border-border/40 sm:block" />

				{steps.map((step, i) => {
					const Icon = step.icon;
					return (
						<BlurFade key={step.title} delay={0.15 + i * 0.1}>
							<Card data-spotlight-card className="relative overflow-hidden border-border/50">
								<CardContent className="p-6">
									<div className="mb-4 flex items-center gap-3">
										<div
											className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${step.bg}`}
										>
											<Icon className={`h-5 w-5 ${step.color}`} />
										</div>
										<span className="text-xs font-medium text-muted-foreground/60">
											Step {step.num}
										</span>
									</div>
									<h3 className="mb-2 text-lg font-semibold">{step.title}</h3>
									<p className="text-sm leading-relaxed text-muted-foreground">
										{step.description}
									</p>
								</CardContent>
							</Card>
						</BlurFade>
					);
				})}
			</SpotlightGrid>
		</section>
	);
}
