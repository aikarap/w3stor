"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";
import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { MetricsCard } from "@/components/dashboard/metrics-card";
import { StorageChart } from "@/components/dashboard/storage-chart";
import { Skeleton } from "@/components/ui/skeleton";
import { SpotlightGrid } from "@/components/ui/spotlight-grid";
import { useConversations } from "@/hooks/use-conversations";
import { useFiles } from "@/hooks/use-files";

export default function DashboardPage() {
	const { isConnected } = useAccount();
	const { data: filesData, isLoading: filesLoading } = useFiles(1, 100);
	const { data: convData } = useConversations();

	if (!isConnected) {
		return (
			<div className="flex flex-col items-center justify-center gap-6 py-24">
				<h1 className="text-2xl font-bold">Connect to view your dashboard</h1>
				<p className="text-muted-foreground text-center max-w-md">
					Connect a wallet to see your files, storage metrics, and conversations.
				</p>
				<ConnectButton />
			</div>
		);
	}

	const files = filesData?.files ?? [];
	const totalFiles = filesData?.total ?? 0;
	const storageUsed = files.reduce((sum: number, f: any) => sum + (Number(f.size_bytes) || f.size || 0), 0);
	const replicated = files.filter((f: any) => f.status === "fully_replicated").length;
	const conversations = convData?.conversations?.length ?? 0;

	// Build chart data
	const byDate: Record<string, number> = {};
	for (const f of files) {
		const ts = f.created_at;
		const d = new Date(ts).toLocaleDateString("en-US", {
			month: "short",
			day: "numeric",
		});
		if (d === "Invalid Date") continue;
		byDate[d] = (byDate[d] ?? 0) + 1;
	}
	const chartData = Object.entries(byDate).map(([date, count]) => ({ date, count }));

	return (
		<div className="space-y-8">
			<h1 className="text-2xl font-bold">Dashboard</h1>

			{filesLoading ? (
				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
					{[...Array(4)].map((_, i) => (
						<Skeleton key={i} className="h-28 rounded-xl" />
					))}
				</div>
			) : (
				<SpotlightGrid glowColor="59, 130, 246" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
					<MetricsCard data-spotlight-card title="Total Files" value={totalFiles} color="blue" />
					<MetricsCard data-spotlight-card title="Storage Used" value={storageUsed} format="bytes" color="green" />
					<MetricsCard data-spotlight-card title="Fully Replicated" value={replicated} color="purple" />
					<MetricsCard data-spotlight-card title="Conversations" value={conversations} color="orange" />
				</SpotlightGrid>
			)}

			<SpotlightGrid glowColor="16, 185, 129" className="grid grid-cols-1 gap-4 lg:grid-cols-2">
				<StorageChart data={chartData} />
				<ActivityFeed
					items={files.slice(0, 5).map((f: any) => ({
						cid: f.cid,
						filename: f.user_filename ?? f.filename ?? f.cid?.slice(0, 16),
						status: f.status,
						created_at: f.created_at,
					}))}
				/>
			</SpotlightGrid>
		</div>
	);
}
