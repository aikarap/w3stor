"use client";

import { PlusIcon, RocketIcon, XIcon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface Agent {
	id: string;
	name: string;
	role: string;
	model: string;
}

const DEFAULT_AGENTS: Agent[] = [
	{ id: "1", name: "Researcher", role: "Search and gather information", model: "gpt-4o" },
	{ id: "2", name: "Analyst", role: "Process and analyze data", model: "claude-sonnet-4" },
	{ id: "3", name: "Writer", role: "Synthesize findings into reports", model: "gpt-4o" },
];

const MODELS = [
	{ value: "gpt-4o", label: "GPT-4o", provider: "OpenAI" },
	{ value: "claude-sonnet-4", label: "Claude Sonnet 4", provider: "Anthropic" },
	{ value: "gemini-2.5-pro", label: "Gemini 2.5 Pro", provider: "Google" },
	{ value: "llama-3.1-70b", label: "Llama 3.1 70B", provider: "Meta" },
];

const AGENT_COLORS = [
	"bg-blue-500",
	"bg-violet-500",
	"bg-emerald-500",
	"bg-amber-500",
	"bg-rose-500",
	"bg-cyan-500",
	"bg-fuchsia-500",
	"bg-orange-500",
];

function getModelLabel(value: string) {
	return MODELS.find((m) => m.value === value)?.label ?? value;
}

function getModelProvider(value: string) {
	return MODELS.find((m) => m.value === value)?.provider ?? "";
}

export function SwarmCreator() {
	const [agents, setAgents] = useState<Agent[]>(DEFAULT_AGENTS);
	const [task, setTask] = useState("");

	const estimatedCost = agents.length * 2 * 0.014;

	function updateAgent(id: string, field: keyof Agent, value: string) {
		setAgents((prev) => prev.map((a) => (a.id === id ? { ...a, [field]: value } : a)));
	}

	function addAgent() {
		if (agents.length >= 8) return;
		const newId = String(Date.now());
		setAgents((prev) => [
			...prev,
			{ id: newId, name: "Agent", role: "Describe this agent's role", model: "gpt-4o" },
		]);
	}

	function removeAgent(id: string) {
		if (agents.length <= 2) return;
		setAgents((prev) => prev.filter((a) => a.id !== id));
	}

	return (
		<div className="space-y-8">
			{/* Agent grid */}
			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				<AnimatePresence mode="popLayout">
					{agents.map((agent, index) => (
						<motion.div
							key={agent.id}
							layout
							initial={{ opacity: 0, scale: 0.92, y: 12 }}
							animate={{ opacity: 1, scale: 1, y: 0 }}
							exit={{ opacity: 0, scale: 0.88, y: -8 }}
							transition={{ duration: 0.18, ease: "easeOut" }}
						>
							<Card className="relative">
								{/* Color dot + remove button */}
								<div className="absolute top-3 right-3 flex items-center gap-2">
									<span
										className={`inline-block size-2.5 rounded-full ${AGENT_COLORS[index % AGENT_COLORS.length]}`}
									/>
									{agents.length > 2 && (
										<button
											type="button"
											onClick={() => removeAgent(agent.id)}
											className="text-muted-foreground transition-colors hover:text-destructive"
											aria-label="Remove agent"
										>
											<XIcon className="size-3.5" />
										</button>
									)}
								</div>

								<CardHeader className="pb-0 pr-14">
									<CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
										Agent {index + 1}
									</CardTitle>
								</CardHeader>

								<CardContent className="space-y-3">
									<Input
										value={agent.name}
										onChange={(e) => updateAgent(agent.id, "name", e.target.value)}
										placeholder="Agent name"
										className="font-medium"
									/>
									<Input
										value={agent.role}
										onChange={(e) => updateAgent(agent.id, "role", e.target.value)}
										placeholder="Role description"
										className="text-sm"
									/>
									<div>
										<Select
											value={agent.model}
											onValueChange={(val) => val && updateAgent(agent.id, "model", val)}
										>
											<SelectTrigger className="w-full">
												<SelectValue>
													<span className="flex items-center gap-1.5">
														<span>{getModelLabel(agent.model)}</span>
														<Badge variant="outline" className="text-[10px] h-4 px-1">
															{getModelProvider(agent.model)}
														</Badge>
													</span>
												</SelectValue>
											</SelectTrigger>
											<SelectContent>
												{MODELS.map((m) => (
													<SelectItem key={m.value} value={m.value}>
														<span className="flex items-center gap-2">
															<span>{m.label}</span>
															<Badge variant="outline" className="text-[10px] h-4 px-1">
																{m.provider}
															</Badge>
														</span>
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</div>
								</CardContent>
							</Card>
						</motion.div>
					))}
				</AnimatePresence>

				{/* Add Agent card */}
				{agents.length < 8 && (
					<motion.div
						layout
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						transition={{ duration: 0.15 }}
					>
						<button
							type="button"
							onClick={addAgent}
							className="flex h-full min-h-40 w-full items-center justify-center rounded-xl border-2 border-dashed border-border text-muted-foreground transition-colors hover:border-primary hover:text-primary"
						>
							<div className="flex flex-col items-center gap-2">
								<PlusIcon className="size-5" />
								<span className="text-sm font-medium">Add Agent</span>
							</div>
						</button>
					</motion.div>
				)}
			</div>

			{/* Task description */}
			<div className="space-y-2">
				<label className="text-sm font-medium" htmlFor="swarm-task">
					Task Description
				</label>
				<textarea
					id="swarm-task"
					value={task}
					onChange={(e) => setTask(e.target.value)}
					placeholder="Describe what this swarm should accomplish…"
					rows={4}
					className="w-full resize-none rounded-lg border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
				/>
			</div>

			{/* Cost estimate + launch row */}
			<div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
				{/* Cost panel */}
				<div className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm">
					<div className="text-muted-foreground mb-0.5">Estimated cost</div>
					<div className="flex items-baseline gap-2">
						<span className="text-xl font-semibold">${estimatedCost.toFixed(3)}</span>
						<span className="text-xs text-muted-foreground">
							{agents.length} agents × 2 min × $0.014/agent-min
						</span>
					</div>
				</div>

				{/* Launch button */}
				<TooltipProvider>
					<Tooltip>
						<TooltipTrigger>
							<Button disabled className="gap-2 opacity-60 cursor-not-allowed">
								<RocketIcon className="size-4" />
								Launch Swarm
							</Button>
						</TooltipTrigger>
						<TooltipContent side="top">
							Coming Soon — execution engine in development
						</TooltipContent>
					</Tooltip>
				</TooltipProvider>
			</div>
		</div>
	);
}
