"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { MetricsCard } from "@/components/dashboard/metrics-card";
import { StorageChart } from "@/components/dashboard/storage-chart";
import { FileTable } from "@/components/files/file-table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SpotlightGrid } from "@/components/ui/spotlight-grid";
import { usePlatformEvents } from "@/hooks/use-file-events";
import { usePlatformActivity, usePlatformMetrics } from "@/hooks/use-platform";
import { cn } from "@/lib/utils";

export default function AgentActivityPage() {
	const [tab, setTab] = useState<"activity" | "volume">("activity");
	const [page, setPage] = useState(1);
	const limit = 50;
	const { data: activity, isLoading } = usePlatformActivity(page, limit);
	const { data: metrics, isLoading: metricsLoading } = usePlatformMetrics();
	usePlatformEvents();

	const files = (activity?.activity ?? []).map((f: any) => ({
		cid: f.cid,
		piece_cid: f.piece_cid,
		size_bytes: f.size_bytes,
		status: f.status,
		sp_count: f.sp_count,
		created_at: f.created_at,
	}));

	const totalFiles = metrics?.files?.total ?? 0;
	const storageUsed = metrics?.files?.total_bytes ?? 0;
	const fullyReplicated = metrics?.replicatedCount ?? 0;
	const memoryGraphs = metrics?.memoryGraphs ?? 0;

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

			{metricsLoading ? (
				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
					{[...Array(4)].map((_, i) => (
						<Skeleton key={i} className="h-28 rounded-xl" />
					))}
				</div>
			) : (
				<SpotlightGrid glowColor="59, 130, 246" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
					<MetricsCard data-spotlight-card title="Total Files" value={totalFiles} color="blue" />
					<MetricsCard data-spotlight-card title="Storage Used" value={storageUsed} format="bytes" color="green" />
					<MetricsCard data-spotlight-card title="Fully Replicated" value={fullyReplicated} color="purple" />
					<MetricsCard data-spotlight-card title="Memory Graphs" value={memoryGraphs} color="orange" />
				</SpotlightGrid>
			)}

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
						<>
							<FileTable files={files} variant="agent-activity" />
							<div className="flex items-center justify-between mt-4">
								<Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
									<ChevronLeft className="mr-1 h-4 w-4" /> Previous
								</Button>
								<span className="text-sm text-muted-foreground">Page {page}</span>
								<Button variant="outline" size="sm" disabled={!activity?.hasMore} onClick={() => setPage((p) => p + 1)}>
									Next <ChevronRight className="ml-1 h-4 w-4" />
								</Button>
							</div>
						</>
					)
				) : (
					<StorageChart data={chartData} />
				)}
			</div>
		</div>
	);
}
