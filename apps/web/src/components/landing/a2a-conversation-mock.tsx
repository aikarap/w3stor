"use client";

import { BarChart3, ChevronDown, ChevronRight, HardDrive, Search } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { BlurFade } from "@/components/ui/blur-fade";
import { BorderBeam } from "@/components/ui/border-beam";
import { Card, CardContent } from "@/components/ui/card";

interface Message {
	id: string;
	agentName: string;
	icon: React.ElementType;
	iconColor: string;
	ringColor: string;
	content: string;
	envelope: object;
}

const MESSAGES: Message[] = [
	{
		id: "research",
		agentName: "Research Agent",
		icon: Search,
		iconColor: "text-amber-400",
		ringColor: "bg-amber-400/10 border-amber-400/30",
		content:
			"Found 47 papers on humanoid locomotion and sim-to-real transfer. Compiled a structured literature review with citations, key findings, and research gaps. Ready to hand off to Analysis Agent.",
		envelope: {
			jsonrpc: "2.0",
			method: "tasks/send",
			id: "msg-001",
			params: {
				taskId: "swarm-session-7f3a",
				message: {
					role: "agent",
					parts: [
						{
							type: "text",
							text: "literature_review compiled, 47 sources indexed",
						},
						{
							type: "data",
							mimeType: "application/json",
							data: { paperCount: 47, artifact: "humanoid-locomotion-survey.pdf" },
						},
					],
				},
				metadata: { agentId: "research-agent", capability: "literature-search" },
			},
		},
	},
	{
		id: "analysis",
		agentName: "Analysis Agent",
		icon: BarChart3,
		iconColor: "text-purple-400",
		ringColor: "bg-purple-400/10 border-purple-400/30",
		content:
			"Processed 47 papers into dense vector embeddings (1536-dim). Clustered by methodology and identified 3 dominant research paradigms. Requesting storage for embeddings dataset — 8.1 MB.",
		envelope: {
			jsonrpc: "2.0",
			method: "tasks/send",
			id: "msg-002",
			params: {
				taskId: "swarm-session-7f3a",
				message: {
					role: "agent",
					parts: [
						{
							type: "text",
							text: "embeddings ready, requesting storage",
						},
						{
							type: "data",
							mimeType: "application/json",
							data: {
								artifact: "joint-torque-embeddings.npy",
								sizeMB: 8.1,
								dimensions: 1536,
								clusters: 3,
							},
						},
					],
				},
				metadata: { agentId: "analysis-agent", capability: "data-analysis" },
			},
		},
	},
	{
		id: "w3stor",
		agentName: "w3stor Agent",
		icon: HardDrive,
		iconColor: "text-blue-400",
		ringColor: "bg-blue-400/10 border-blue-400/30",
		content:
			"Stored 2 artifacts on Filecoin via 3 storage providers. Ephemeral Pinata pin created for instant access. Total cost: 0.0031 USDFC. CIDs: bafybei…a4k2 (survey), bafybei…9xm1 (embeddings).",
		envelope: {
			jsonrpc: "2.0",
			method: "tasks/send",
			id: "msg-003",
			params: {
				taskId: "swarm-session-7f3a",
				message: {
					role: "agent",
					parts: [
						{
							type: "text",
							text: "storage confirmed, 2 artifacts pinned",
						},
						{
							type: "data",
							mimeType: "application/json",
							data: {
								artifacts: [
									{
										file: "humanoid-locomotion-survey.pdf",
										cid: "bafybeig3p7xj2vkqzn5o4ywlmca7ibe2i3qp6dta5r8nfhz2ska4k2",
										providers: 3,
									},
									{
										file: "joint-torque-embeddings.npy",
										cid: "bafybeihw6mxn3fvpqe2d7kcjlrt4z8onp1ybsw5uigqxmdv7f89xm1",
										providers: 3,
									},
								],
								totalCostUSDFC: 0.0031,
								pinataEphemeral: true,
							},
						},
					],
				},
				metadata: { agentId: "w3stor-agent", capability: "filecoin-storage" },
			},
		},
	},
];

function MessageCard({ message, index }: { message: Message; index: number }) {
	const [expanded, setExpanded] = useState(false);
	const Icon = message.icon;

	return (
		<BlurFade delay={0.1 + index * 0.12}>
			<Card className="relative overflow-hidden border-border/50 bg-card/60 backdrop-blur-sm">
				{index === MESSAGES.length - 1 && (
					<BorderBeam size={80} duration={10} colorFrom="#3b82f6" colorTo="#8b5cf6" />
				)}
				<CardContent className="p-4">
					{/* Header */}
					<div className="mb-3 flex items-center gap-2.5">
						<div
							className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border ${message.ringColor}`}
						>
							<Icon className={`h-4 w-4 ${message.iconColor}`} />
						</div>
						<div className="flex items-center gap-2">
							<span className="text-sm font-semibold">{message.agentName}</span>
							<Badge variant="outline" className="h-4 px-1.5 text-[10px] font-medium">
								A2A
							</Badge>
						</div>
					</div>

					{/* Content */}
					<p className="mb-3 text-sm text-muted-foreground leading-relaxed">{message.content}</p>

					{/* Collapsible JSON-RPC */}
					<button
						onClick={() => setExpanded((v) => !v)}
						className="flex items-center gap-1.5 text-xs text-muted-foreground/70 hover:text-muted-foreground transition-colors"
					>
						{expanded ? (
							<ChevronDown className="h-3.5 w-3.5" />
						) : (
							<ChevronRight className="h-3.5 w-3.5" />
						)}
						JSON-RPC envelope
					</button>

					<AnimatePresence>
						{expanded && (
							<motion.div
								initial={{ height: 0, opacity: 0 }}
								animate={{ height: "auto", opacity: 1 }}
								exit={{ height: 0, opacity: 0 }}
								transition={{ duration: 0.25, ease: "easeInOut" }}
								className="overflow-hidden"
							>
								<pre className="mt-2 overflow-x-auto rounded-lg border border-border/40 bg-muted/40 p-3 text-[11px] leading-relaxed text-muted-foreground">
									{JSON.stringify(message.envelope, null, 2)}
								</pre>
							</motion.div>
						)}
					</AnimatePresence>
				</CardContent>
			</Card>
		</BlurFade>
	);
}

export function A2AConversationMock() {
	return (
		<section className="mx-auto max-w-3xl px-4 py-24">
			<BlurFade delay={0.05}>
				<div className="mb-10 text-center">
					<h2 className="text-3xl font-bold">Agents Talking to Agents</h2>
					<p className="mt-3 max-w-xl mx-auto text-muted-foreground">
						Every inter-agent message is a signed JSON-RPC 2.0 call over the A2A protocol. Click any
						message to inspect the raw envelope.
					</p>
				</div>
			</BlurFade>

			<div className="space-y-4">
				{MESSAGES.map((msg, i) => (
					<MessageCard key={msg.id} message={msg} index={i} />
				))}
			</div>
		</section>
	);
}
