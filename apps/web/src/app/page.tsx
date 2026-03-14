"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { A2AConversationMock } from "@/components/landing/a2a-conversation-mock";
import { EcosystemMarquee } from "@/components/landing/ecosystem-marquee";
import { FinalCTA } from "@/components/landing/final-cta";
import { FrameworkIntegrations } from "@/components/landing/framework-integrations";
import { HowItWorks } from "@/components/landing/how-it-works";
import { PricingCalculator } from "@/components/landing/pricing-calculator";
import { ProtocolCards } from "@/components/landing/protocol-cards";
import { SwarmPreview } from "@/components/landing/swarm-preview";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { Badge } from "@/components/ui/badge";
import { BlurFade } from "@/components/ui/blur-fade";
import { Button } from "@/components/ui/button";
import { Particles } from "@/components/ui/particles";
import { ShimmerButton } from "@/components/ui/shimmer-button";

const protocolBadges = [
	"REST API",
	"MCP Server",
	"A2A Protocol",
	"ERC-8004",
	"x402 Payments",
	"Vercel AI SDK",
];

export default function Home() {
	return (
		<div className="min-h-screen bg-background">
			<SiteHeader />

			{/* Section 1: Hero */}
			<section className="relative overflow-hidden">
				<Particles className="absolute inset-0" color="#3b82f6" quantity={80} staticity={30} />
				<div className="relative mx-auto max-w-7xl px-4 pb-28 pt-36 text-center">
					<BlurFade delay={0.05}>
						<p className="mb-6 text-xs font-medium uppercase tracking-[0.2em] text-blue-400">
							w3stor.agent
						</p>
					</BlurFade>

					<BlurFade delay={0.1}>
						<h1 className="mx-auto max-w-4xl text-5xl font-bold tracking-tight sm:text-7xl">
							Decentralized Storage for{" "}
							<span className="bg-gradient-to-r from-blue-400 via-purple-400 to-emerald-400 bg-clip-text text-transparent">
								Autonomous Agents
							</span>
						</h1>
					</BlurFade>

					<BlurFade delay={0.2}>
						<p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
							Connect any AI framework. Pay from any L2 with x402. Store permanently on Filecoin.
							One unified API for every agent.
						</p>
					</BlurFade>

					<BlurFade delay={0.25}>
						<div className="mt-6 flex flex-wrap items-center justify-center gap-2">
							{protocolBadges.map((badge) => (
								<Badge
									key={badge}
									variant="outline"
									className="border-border/50 text-muted-foreground text-xs"
								>
									{badge}
								</Badge>
							))}
						</div>
					</BlurFade>

					<BlurFade delay={0.3}>
						<div className="mt-10 flex flex-wrap items-center justify-center gap-4">
							<Link href="/dashboard">
								<ShimmerButton className="px-8 py-3" shimmerColor="#06b6d4">
									<span className="text-sm font-medium text-white">Launch App</span>
								</ShimmerButton>
							</Link>
							<a href="#swarm-demo">
								<Button variant="outline" size="lg" className="gap-2">
									Watch Demo <ArrowRight className="h-4 w-4" />
								</Button>
							</a>
						</div>
					</BlurFade>
				</div>
			</section>

			{/* Section 2 — Framework Integrations */}
			<FrameworkIntegrations />

			{/* Section 3 — How It Works */}
			<HowItWorks />

			{/* Section 4 — Swarm Preview */}
			<SwarmPreview />

			{/* Section 5 — A2A Conversation Mock */}
			<A2AConversationMock />

			{/* Section 6 — Protocol Cards */}
			<ProtocolCards />

			{/* Section 7 — Pricing Calculator */}
			<PricingCalculator />

			{/* Section 8 — Ecosystem Marquee */}
			<EcosystemMarquee />

			{/* Section 9 — Final CTA */}
			<FinalCTA />

			<SiteFooter />
		</div>
	);
}
