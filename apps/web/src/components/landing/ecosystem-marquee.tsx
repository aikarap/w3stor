"use client";

import { BlurFade } from "@/components/ui/blur-fade";
import { Marquee } from "@/components/ui/marquee";

const ecosystemItems = [
	{ name: "Filecoin", colorClass: "text-blue-400" },
	{ name: "IPFS", colorClass: "text-teal-400" },
	{ name: "Pinata", colorClass: "text-orange-400" },
	{ name: "Lighthouse", colorClass: "text-yellow-400" },
	{ name: "Akave", colorClass: "text-cyan-400" },
	{ name: "Vercel AI SDK", colorClass: "text-white" },
	{ name: "ElizaOS", colorClass: "text-purple-400" },
	{ name: "Mastra", colorClass: "text-indigo-400" },
	{ name: "Anthropic", colorClass: "text-amber-400" },
	{ name: "OpenAI", colorClass: "text-green-400" },
	{ name: "Base", colorClass: "text-blue-500" },
	{ name: "Optimism", colorClass: "text-red-400" },
	{ name: "Arbitrum", colorClass: "text-sky-400" },
	{ name: "x402", colorClass: "text-emerald-400" },
	{ name: "USDFC", colorClass: "text-violet-400" },
];

export function EcosystemMarquee() {
	return (
		<section className="py-20 overflow-hidden">
			<BlurFade delay={0.05}>
				<div className="mb-10 text-center">
					<h2 className="text-3xl font-bold">Built on the Open Stack</h2>
					<p className="mt-3 max-w-xl mx-auto text-muted-foreground">
						No vendor lock-in. w3stor integrates with the protocols, frameworks, and chains you
						already use.
					</p>
				</div>
			</BlurFade>

			<div className="relative">
				{/* Fade edges */}
				<div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-32 bg-gradient-to-r from-background to-transparent" />
				<div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-32 bg-gradient-to-l from-background to-transparent" />

				<Marquee pauseOnHover className="[--duration:40s] [--gap:2rem]">
					{ecosystemItems.map((item) => (
						<div
							key={item.name}
							className="flex items-center gap-2 rounded-full border border-border/40 bg-card/40 px-5 py-2.5 backdrop-blur-sm"
						>
							<span className={`h-2 w-2 rounded-full ${item.colorClass.replace("text-", "bg-")}`} />
							<span className={`text-sm font-medium ${item.colorClass}`}>{item.name}</span>
						</div>
					))}
				</Marquee>
			</div>
		</section>
	);
}
