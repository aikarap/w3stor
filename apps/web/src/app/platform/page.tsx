"use client";

import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { MetricsCard } from "@/components/dashboard/metrics-card";
import { StorageChart } from "@/components/dashboard/storage-chart";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { BlurFade } from "@/components/ui/blur-fade";
import { Skeleton } from "@/components/ui/skeleton";
import { usePlatformActivity, usePlatformMetrics, usePlatformStats } from "@/hooks/use-platform";

export default function PlatformPage() {
	const { data: stats, isLoading: statsLoading } = usePlatformStats();
	const { data: activity } = usePlatformActivity();
	const { data: metrics } = usePlatformMetrics();

	// Format upload volume dates for the chart
	const chartData = (metrics?.uploadVolume ?? []).map((d: any) => ({
		...d,
		date: new Date(d.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
	}));

	return (
		<div className="min-h-screen">
			<SiteHeader />
			<main className="mx-auto max-w-7xl px-4 py-12">
				<BlurFade>
					<h1 className="mb-8 text-3xl font-bold">Platform Metrics</h1>
				</BlurFade>

				{statsLoading ? (
					<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
						{[...Array(4)].map((_, i) => (
							<Skeleton key={i} className="h-28 rounded-xl" />
						))}
					</div>
				) : (
					<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
						<MetricsCard title="Total Users" value={stats?.users?.total ?? 0} color="blue" />
						<MetricsCard title="Total Files" value={stats?.files?.total ?? 0} color="green" />
						<MetricsCard
							title="Storage Used"
							value={Number(stats?.files?.total_bytes ?? 0)}
							format="bytes"
							color="purple"
						/>
						<MetricsCard
							title="Conversations"
							value={stats?.conversations?.total ?? 0}
							color="orange"
						/>
					</div>
				)}

				<div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
					<StorageChart data={chartData} />
					<ActivityFeed
						items={(activity?.activity ?? []).slice(0, 10).map((f: any) => ({
							cid: f.cid,
							filename: f.owners?.[0]?.filename ?? f.cid?.slice(0, 16),
							status: f.status,
							created_at: f.created_at,
						}))}
					/>
				</div>
			</main>
			<SiteFooter />
		</div>
	);
}
