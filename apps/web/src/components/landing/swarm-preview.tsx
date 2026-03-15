"use client";

import { SwarmVisualizer } from "@/components/swarm/swarm-visualizer";
import { BlurFade } from "@/components/ui/blur-fade";

export function SwarmPreview() {
	return (
		<section id="swarm-demo" className="mx-auto max-w-7xl px-4 py-24">
			<BlurFade delay={0.1}>
				<div className="mb-8 text-center">
					<h2 className="text-3xl font-bold">Live Agent Demo</h2>
					<p className="mt-3 max-w-2xl mx-auto text-muted-foreground">
						Watch 5 AI agents collaborate on robotics research, produce artifacts, and store
						everything on Filecoin — with live cost tracking.
					</p>
				</div>
			</BlurFade>
			<BlurFade delay={0.15}>
				<SwarmVisualizer />
			</BlurFade>
		</section>
	);
}
