import { Skeleton } from "@/components/ui/skeleton";

export default function PlatformLoading() {
	return (
		<div className="space-y-6">
			<Skeleton className="h-8 w-48" />
			<div className="grid gap-4 md:grid-cols-4">
				<Skeleton className="h-24 rounded-xl" />
				<Skeleton className="h-24 rounded-xl" />
				<Skeleton className="h-24 rounded-xl" />
				<Skeleton className="h-24 rounded-xl" />
			</div>
			<Skeleton className="h-80 rounded-xl" />
		</div>
	);
}
