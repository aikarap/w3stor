"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { FileTable } from "@/components/files/file-table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useFiles } from "@/hooks/use-files";

export default function FilesPage() {
	const [page, setPage] = useState(1);
	const { data, isLoading } = useFiles(page, 20);

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<h1 className="text-2xl font-bold">My Files</h1>
				<span className="text-sm text-muted-foreground">{data?.total ?? 0} files</span>
			</div>

			{isLoading ? (
				<Skeleton className="h-64 rounded-xl" />
			) : (
				<FileTable files={data?.files ?? []} />
			)}

			<div className="flex items-center justify-between">
				<Button
					variant="outline"
					size="sm"
					disabled={page <= 1}
					onClick={() => setPage((p) => p - 1)}
				>
					<ChevronLeft className="mr-1 h-4 w-4" /> Previous
				</Button>
				<span className="text-sm text-muted-foreground">Page {page}</span>
				<Button
					variant="outline"
					size="sm"
					disabled={!data?.hasMore}
					onClick={() => setPage((p) => p + 1)}
				>
					Next <ChevronRight className="ml-1 h-4 w-4" />
				</Button>
			</div>
		</div>
	);
}
