"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { useAccount } from "wagmi";
import { MetricsCard } from "@/components/dashboard/metrics-card";
import { FileTable } from "@/components/files/file-table";
import { UploadModal } from "@/components/files/upload-modal";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SpotlightGrid } from "@/components/ui/spotlight-grid";
import { usePlatformEvents } from "@/hooks/use-file-events";
import { useFiles } from "@/hooks/use-files";
import { useConversations } from "@/hooks/use-conversations";

export default function DashboardFilesPage() {
	const { isConnected } = useAccount();
	const [page, setPage] = useState(1);
	const { data: filesData, isLoading: filesLoading } = useFiles(page, 20);
	const { data: convData } = useConversations();
	usePlatformEvents();

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
	const replicated = files.filter((f: any) => Number(f.sp_count) >= 3).length;
	const conversations = convData?.conversations?.length ?? 0;

	return (
		<div className="space-y-6">
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

			<div className="flex items-center justify-between">
				<span className="text-sm text-muted-foreground">{totalFiles} files</span>
				<UploadModal />
			</div>

			<FileTable files={files} />

			<div className="flex items-center justify-between">
				<Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
					<ChevronLeft className="mr-1 h-4 w-4" /> Previous
				</Button>
				<span className="text-sm text-muted-foreground">Page {page}</span>
				<Button variant="outline" size="sm" disabled={!filesData?.hasMore} onClick={() => setPage((p) => p + 1)}>
					Next <ChevronRight className="ml-1 h-4 w-4" />
				</Button>
			</div>
		</div>
	);
}
