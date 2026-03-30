"use client";

import { Play } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { DotPattern } from "@/components/ui/dot-pattern";
import { Ripple } from "@/components/ui/ripple";
import { type AgentDefinition, AgentNode, type AgentStatus } from "./agent-node";
import { type Artifact, ArtifactCard } from "./artifact-card";
import { CostAccrual } from "./cost-accrual";
import { SwarmTimeline, type TimelineStep } from "./swarm-timeline";

type StorageStatus = "waiting" | "requesting" | "stored";

// ---------------------------------------------------------------------------
// Agent definitions
// ---------------------------------------------------------------------------
const AGENTS: AgentDefinition[] = [
	{
		id: "scout",
		name: "Scout",
		role: "Literature Search",
		position: { x: "22%", y: "22%" },
		color: "#f59e0b",
	},
	{
		id: "analyst",
		name: "Analyst",
		role: "Data Analysis",
		position: { x: "78%", y: "22%" },
		color: "#a855f7",
	},
	{
		id: "builder",
		name: "Builder",
		role: "Code Generation",
		position: { x: "22%", y: "78%" },
		color: "#10b981",
	},
	{
		id: "critic",
		name: "Critic",
		role: "Peer Review",
		position: { x: "78%", y: "78%" },
		color: "#06b6d4",
	},
	{
		id: "synth",
		name: "Synth",
		role: "Synthesis & Writing",
		position: { x: "50%", y: "50%" },
		color: "#3b82f6",
	},
];

// ---------------------------------------------------------------------------
// Timeline step labels
// ---------------------------------------------------------------------------
const STEP_LABELS = [
	"Initialize",
	"Literature Search",
	"Data Analysis",
	"Code Generation",
	"Peer Review",
	"Synthesis",
	"Storage Request",
];

// ---------------------------------------------------------------------------
// Artifacts produced at each step
// ---------------------------------------------------------------------------
const STEP_ARTIFACTS: Record<number, Artifact> = {
	1: {
		id: "a1",
		title: "humanoid-locomotion-survey.pdf",
		type: "paper",
		agent: "Scout",
		size: "2.4 MB",
	},
	2: {
		id: "a2",
		title: "joint-torque-embeddings.npy",
		type: "dataset",
		agent: "Analyst",
		size: "8.1 MB",
	},
	3: {
		id: "a3",
		title: "reinforcement-learning-policy.py",
		type: "code",
		agent: "Builder",
		size: "0.3 MB",
	},
	4: {
		id: "a4",
		title: "sim2real-transfer-results.json",
		type: "experiment",
		agent: "Critic",
		size: "1.7 MB",
	},
	5: {
		id: "a5",
		title: "swarm-research-synthesis.md",
		type: "paper",
		agent: "Synth",
		size: "0.5 MB",
	},
};

// Which agent is active per step
const STEP_ACTIVE_AGENT: Record<number, string> = {
	1: "scout",
	2: "analyst",
	3: "builder",
	4: "critic",
	5: "synth",
};

// Step durations in ms
const STEP_DURATIONS = [1500, 3500, 3500, 3500, 2000, 4000, 1000];

// ---------------------------------------------------------------------------
// Connection lines between agents (pairs of position indices)
// ---------------------------------------------------------------------------
const CONNECTIONS: [number, number][] = [
	[0, 4], // scout -> synth
	[1, 4], // analyst -> synth
	[2, 4], // builder -> synth
	[3, 4], // critic -> synth
	[0, 1], // scout -> analyst
	[2, 3], // builder -> critic
];

export function SwarmVisualizer() {
	const [started, setStarted] = useState(false);
	const [currentStep, setCurrentStep] = useState(-1);
	const [artifacts, setArtifacts] = useState<Artifact[]>([]);
	const [storageStatus, setStorageStatus] = useState<StorageStatus>("waiting");
	const [agentStatuses, setAgentStatuses] = useState<Record<string, AgentStatus>>(
		Object.fromEntries(AGENTS.map((a) => [a.id, "idle" as AgentStatus])),
	);
	const [costBreakdown, setCostBreakdown] = useState({ compute: 0, storage: 0 });

	const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	// Derive timeline steps from currentStep
	const timelineSteps: TimelineStep[] = STEP_LABELS.map((label, i) => ({
		label,
		status: i < currentStep ? "done" : i === currentStep ? "active" : "pending",
	}));

	// ---------------------------------------------------------------------------
	// Run a single step
	// ---------------------------------------------------------------------------
	const runStep = useCallback((step: number) => {
		setCurrentStep(step);

		// Set the active agent for this step
		const activeId = STEP_ACTIVE_AGENT[step];
		setAgentStatuses((prev) => {
			const next = { ...prev };
			// Mark previous active agents as done
			for (const id of Object.keys(next)) {
				if (next[id] === "thinking" || next[id] === "producing") {
					next[id] = "done";
				}
			}
			if (activeId) next[activeId] = "thinking";
			return next;
		});

		// Accrue compute cost when agent activates
		if (activeId) {
			setCostBreakdown((prev) => ({ ...prev, compute: prev.compute + 0.014 }));
		}

		// Midway through the step, switch to "producing" and add artifact
		if (activeId) {
			const midDelay = STEP_DURATIONS[step] * 0.45;
			setTimeout(() => {
				setAgentStatuses((prev) => ({
					...prev,
					[activeId]: "producing",
				}));
				const artifact = STEP_ARTIFACTS[step];
				if (artifact) {
					setArtifacts((prev) => [...prev, artifact]);
					setCostBreakdown((prev) => ({
						...prev,
						storage: prev.storage + parseFloat(artifact.size) * 0.0001,
					}));
				}
			}, midDelay);
		}

		// Schedule next step
		if (step < STEP_LABELS.length - 1) {
			timerRef.current = setTimeout(() => runStep(step + 1), STEP_DURATIONS[step]);
		} else {
			// Final step: mark all agents done
			setTimeout(() => {
				setAgentStatuses((prev) => {
					const next = { ...prev };
					for (const id of Object.keys(next)) next[id] = "done";
					return next;
				});
				setCurrentStep(STEP_LABELS.length); // past last index -> all done
			}, STEP_DURATIONS[step]);
		}
	}, []);

	// ---------------------------------------------------------------------------
	// Start the demo
	// ---------------------------------------------------------------------------
	const startDemo = useCallback(() => {
		setStarted(true);
		setArtifacts([]);
		setStorageStatus("waiting");
		setAgentStatuses(Object.fromEntries(AGENTS.map((a) => [a.id, "idle" as AgentStatus])));
		setCostBreakdown({ compute: 0, storage: 0 });
		// Small delay so agents can spring in first
		timerRef.current = setTimeout(() => runStep(0), 400);
	}, [runStep]);

	// Cleanup
	useEffect(() => {
		return () => {
			if (timerRef.current) clearTimeout(timerRef.current);
		};
	}, []);

	// ---------------------------------------------------------------------------
	// Store handler
	// ---------------------------------------------------------------------------
	const handleStore = useCallback(() => {
		setStorageStatus("requesting");
		setTimeout(() => setStorageStatus("stored"), 3000);
	}, []);

	const showStoragePanel = currentStep >= 6;

	return (
		<div className="grid gap-6 lg:grid-cols-3">
			{/* ------------------------------------------------------------------ */}
			{/* Left: Agent visualization canvas                                    */}
			{/* ------------------------------------------------------------------ */}
			<div className="relative min-h-[480px] overflow-hidden rounded-2xl border border-border/50 bg-background lg:col-span-2">
				<DotPattern className="text-neutral-700/40" cr={0.8} width={24} height={24} />

				{/* Connection lines */}
				{started && (
					<svg className="pointer-events-none absolute inset-0 h-full w-full">
						{CONNECTIONS.map(([a, b]) => {
							const from = AGENTS[a].position;
							const to = AGENTS[b].position;
							return (
								<motion.line
									key={`${a}-${b}`}
									x1={from.x}
									y1={from.y}
									x2={to.x}
									y2={to.y}
									stroke="currentColor"
									strokeWidth={1}
									className="text-muted-foreground"
									initial={{ pathLength: 0, opacity: 0 }}
									animate={{ pathLength: 1, opacity: 0.1 }}
									transition={{ duration: 1.2, delay: 0.3 }}
								/>
							);
						})}
					</svg>
				)}

				{/* Ripple at center when running */}
				{started && currentStep >= 0 && currentStep < STEP_LABELS.length && (
					<div className="pointer-events-none absolute inset-0">
						<Ripple mainCircleSize={80} mainCircleOpacity={0.08} numCircles={5} />
					</div>
				)}

				{/* Agent nodes */}
				<AnimatePresence>
					{started &&
						AGENTS.map((agent, i) => (
							<AgentNode
								key={agent.id}
								agent={agent}
								status={agentStatuses[agent.id]}
								delay={i * 0.12}
							/>
						))}
				</AnimatePresence>

				{/* Launch button (before start) */}
				{!started && (
					<div className="absolute inset-0 flex items-center justify-center">
						<motion.button
							onClick={startDemo}
							className="flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-6 py-3 text-sm font-medium text-blue-400 backdrop-blur-sm transition-colors hover:bg-blue-500/20"
							whileHover={{ scale: 1.05 }}
							whileTap={{ scale: 0.97 }}
						>
							<Play className="h-4 w-4" />
							Launch Swarm
						</motion.button>
					</div>
				)}
			</div>

			{/* ------------------------------------------------------------------ */}
			{/* Right: Timeline + Artifacts + Storage                               */}
			{/* ------------------------------------------------------------------ */}
			<div className="flex flex-col gap-5">
				{/* Cost accrual */}
				{started && (
					<CostAccrual
						breakdown={costBreakdown}
						agentCount={AGENTS.length}
						isRunning={currentStep >= 0 && currentStep < STEP_LABELS.length}
					/>
				)}

				{/* Timeline */}
				<div className="rounded-xl border border-border/50 bg-card/60 p-4 backdrop-blur-sm">
					<h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
						Progress
					</h3>
					<SwarmTimeline steps={timelineSteps} />
				</div>

				{/* Artifacts */}
				{artifacts.length > 0 && (
					<div className="rounded-xl border border-border/50 bg-card/60 p-4 backdrop-blur-sm">
						<h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
							Artifacts ({artifacts.length})
						</h3>
						<div className="space-y-2">
							{artifacts.map((a, i) => (
								<ArtifactCard key={a.id} artifact={a} index={i} />
							))}
						</div>
					</div>
				)}

				{/* Storage request (demo) */}
				{showStoragePanel && (
					<div className="relative overflow-hidden rounded-xl border border-border/50 bg-card/80 p-4 backdrop-blur-sm">
						<div className="mb-2 text-sm font-semibold">Store on Filecoin</div>
						<div className="mb-2 text-xs text-muted-foreground">
							{artifacts.length} artifacts ready
						</div>
						{storageStatus === "waiting" && (
							<button
								onClick={handleStore}
								className="w-full rounded-lg bg-blue-600 py-2 text-sm text-white hover:bg-blue-700"
							>
								Store Artifacts
							</button>
						)}
						{storageStatus === "requesting" && (
							<div className="py-2 text-center text-sm text-blue-400">Storing...</div>
						)}
						{storageStatus === "stored" && (
							<div className="py-2 text-center text-sm text-green-400">All artifacts stored</div>
						)}
					</div>
				)}

				{/* Build your own workflow CTA */}
				{started && (
					<a
						href="/dashboard"
						className="flex items-center justify-center gap-2 rounded-xl border border-cyan-500/30 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 px-4 py-3 text-sm font-medium text-cyan-400 backdrop-blur-sm transition-all hover:from-cyan-500/20 hover:to-blue-500/20 hover:border-cyan-500/50"
					>
						<svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
						</svg>
						Build Your Own Workflow
					</a>
				)}
			</div>
		</div>
	);
}
