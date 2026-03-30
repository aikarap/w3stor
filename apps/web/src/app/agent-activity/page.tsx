"use client";

import { useState } from "react";
import { StorageChart } from "@/components/dashboard/storage-chart";
import { FileTable } from "@/components/files/file-table";
import { Skeleton } from "@/components/ui/skeleton";
import { usePlatformEvents } from "@/hooks/use-file-events";
import { usePlatformActivity, usePlatformMetrics } from "@/hooks/use-platform";
import { cn } from "@/lib/utils";

export default function AgentActivityPage() {
	const [tab, setTab] = useState<"activity" | "volume">("activity");
	const { data: activity, isLoading } = usePlatformActivity();
	const { data: metrics } = usePlatformMetrics();
	usePlatformEvents();

	const files = (activity?.activity ?? []).map((f: any) => ({
		cid: f.cid,
		piece_cid: f.piece_cid,
		size_bytes: f.size_bytes,
		status: f.status,
		sp_count: f.sp_count,
		created_at: f.created_at,
	}));

	const chartData = (metrics?.uploadVolume ?? []).map((d: any) => ({
		...d,
		date: new Date(d.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
	}));

	return (
		<div className="space-y-6">
			<h1 className="text-2xl font-bold">Agent Activity</h1>
			<p className="text-muted-foreground">
				Public view of storage agent operations on Filecoin. Verify any file on-chain.
			</p>

			<div className="flex gap-1 border-b border-border/50">
				{(["activity", "volume"] as const).map((t) => (
					<button
						key={t}
						type="button"
						onClick={() => setTab(t)}
						className={cn(
							"relative px-4 py-2.5 text-sm font-medium transition-colors",
							tab === t ? "text-foreground" : "text-muted-foreground hover:text-foreground",
						)}
					>
						{t === "activity" ? "Recent Activity" : "Upload Volume"}
						{tab === t && (
							<span className="absolute inset-x-0 bottom-0 h-0.5 bg-foreground rounded-full" />
						)}
					</button>
				))}
			</div>

			<div>
				{tab === "activity" ? (
					isLoading ? (
						<Skeleton className="h-64 rounded-xl" />
					) : (
						<FileTable files={files} variant="agent-activity" />
					)
				) : (
					<StorageChart data={chartData} />
				)}
			</div>
		</div>
	);
}
