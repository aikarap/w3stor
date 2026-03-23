"use client";

import { Check, HardDrive, Loader2 } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { BorderBeam } from "@/components/ui/border-beam";
import { ShimmerButton } from "@/components/ui/shimmer-button";
import { cn } from "@/lib/utils";
import type { StorageArtifact, StoragePhase } from "@/lib/workflow/types";

interface StorageRequestProps {
	artifacts: StorageArtifact[];
	phase: StoragePhase;
	onStore: (selectedIds: string[]) => void;
	storedCids?: Record<string, string>;
}

function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function StorageRequest({ artifacts, phase, onStore, storedCids }: StorageRequestProps) {
	const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

	// Auto-select new artifacts as they appear
	useEffect(() => {
		setSelectedIds(new Set(artifacts.map((a) => a.nodeId)));
	}, [artifacts]);

	const selectedArtifacts = artifacts.filter((a) => selectedIds.has(a.nodeId));
	const selectedBytes = selectedArtifacts.reduce((sum, a) => sum + a.size, 0);
	const selectedCount = selectedArtifacts.length;

	// Cost: 0.0001 USDFC per MB, minimum 0.00001
	const estimatedCost = Math.max(0.00001, (selectedBytes / (1024 * 1024)) * 0.0001);

	function toggleArtifact(nodeId: string) {
		setSelectedIds((prev) => {
			const next = new Set(prev);
			if (next.has(nodeId)) next.delete(nodeId);
			else next.add(nodeId);
			return next;
		});
	}

	return (
		<motion.div
			initial={{ opacity: 0, y: 20 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.5 }}
			className="relative overflow-hidden rounded-xl border border-border/50 bg-card/80 p-4 backdrop-blur-sm"
		>
			<BorderBeam size={80} duration={8} colorFrom="#3b82f6" colorTo="#8b5cf6" />

			<div className="mb-3 flex items-center gap-2">
				<HardDrive className="h-4 w-4 text-blue-400" />
				<h3 className="text-sm font-semibold">Store on Filecoin</h3>
			</div>

			{/* Artifact list */}
			<div className="mb-3 space-y-2">
				{artifacts.map((a) => {
					const isImage = a.contentType.startsWith("image/");
					return (
						<div key={a.nodeId} className="space-y-1.5">
							<div className="flex items-center justify-between text-xs text-muted-foreground">
								<label className="flex items-center gap-2 cursor-pointer truncate">
									<input
										type="checkbox"
										checked={selectedIds.has(a.nodeId)}
										onChange={() => toggleArtifact(a.nodeId)}
										disabled={phase !== "pending"}
										className="accent-blue-500 h-3 w-3"
									/>
									<span className="truncate">{a.title}</span>
									{isImage && (
										<span className="rounded bg-purple-500/20 px-1 py-0.5 text-[10px] text-purple-400">
											{a.contentType.split("/")[1].toUpperCase()}
										</span>
									)}
								</label>
								<div className="ml-2 flex items-center gap-2 shrink-0">
									<span>{formatBytes(a.size)}</span>
									{storedCids?.[a.nodeId] && (
										<span className="text-green-400 font-mono text-[10px]">
											{storedCids[a.nodeId].slice(0, 12)}...
										</span>
									)}
								</div>
							</div>
							{/* Image preview */}
							{isImage && (
								<div className="ml-5 overflow-hidden rounded-md border border-border/30">
									{/* eslint-disable-next-line @next/next/no-img-element */}
									<img
										src={`data:${a.contentType};base64,${a.content}`}
										alt={a.title}
										className="max-h-48 w-full object-contain bg-black/20"
									/>
								</div>
							)}
							{/* Text preview (first 200 chars) */}
							{!isImage && a.content.length > 0 && (
								<div className="ml-5 rounded-md border border-border/30 bg-muted/30 px-2 py-1.5 text-[11px] text-muted-foreground font-mono line-clamp-3 whitespace-pre-wrap">
									{a.content.slice(0, 200)}
									{a.content.length > 200 ? "..." : ""}
								</div>
							)}
						</div>
					);
				})}
				<div className="border-t border-border/30 pt-1.5 flex items-center justify-between text-xs font-medium">
					<span>Total</span>
					<span>{formatBytes(selectedBytes)}</span>
				</div>
			</div>

			{/* Cost */}
			<div className="mb-3 flex items-center justify-between text-xs">
				<span className="text-muted-foreground">Estimated cost</span>
				<span className="font-medium text-green-400">{estimatedCost.toFixed(5)} USDFC</span>
			</div>

			{/* Action */}
			{phase === "pending" && (
				<ShimmerButton
					className="w-full text-sm"
					shimmerColor="#3b82f6"
					background="rgba(30, 58, 138, 0.5)"
					onClick={() => onStore(Array.from(selectedIds))}
					disabled={selectedCount === 0}
				>
					Store {selectedCount} Artifact{selectedCount !== 1 ? "s" : ""} on Filecoin
				</ShimmerButton>
			)}

			{phase === "uploading" && (
				<div className="flex items-center justify-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 py-2.5 text-sm text-blue-400">
					<Loader2 className="h-4 w-4 animate-spin" />
					Uploading via x402...
				</div>
			)}

			{phase === "stored" && (
				<motion.div
					initial={{ scale: 0.9, opacity: 0 }}
					animate={{ scale: 1, opacity: 1 }}
					className={cn(
						"flex items-center justify-center gap-2 rounded-full border border-green-500/30 bg-green-500/10 py-2.5 text-sm text-green-400",
					)}
				>
					<Check className="h-4 w-4" />
					All artifacts stored permanently
				</motion.div>
			)}

			{phase === "error" && (
				<div className="flex items-center justify-center gap-2 rounded-full border border-red-500/30 bg-red-500/10 py-2.5 text-sm text-red-400">
					Storage failed — check console for details
				</div>
			)}
		</motion.div>
	);
}
