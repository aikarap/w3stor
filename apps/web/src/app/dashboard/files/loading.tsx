import { Skeleton } from "@/components/ui/skeleton";

export default function FilesLoading() {
	return (
		<div className="space-y-4">
			<Skeleton className="h-8 w-32" />
			<div className="space-y-3">
				{Array.from({ length: 5 }).map((_, i) => (
					<Skeleton key={i} className="h-16 rounded-lg" />
				))}
			</div>
		</div>
	);
}
