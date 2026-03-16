import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const statusConfig: Record<string, { label: string; className: string }> = {
	pinata_pinned: {
		label: "Pinned",
		className: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
	},
	uploading: { label: "Uploading", className: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
	stored: { label: "Stored", className: "bg-green-500/10 text-green-400 border-green-500/20" },
	fully_replicated: {
		label: "Replicated",
		className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
	},
	failed: { label: "Failed", className: "bg-red-500/10 text-red-400 border-red-500/20" },
	pending: { label: "Pending", className: "bg-gray-500/10 text-gray-400 border-gray-500/20" },
	verified: {
		label: "Verified",
		className: "bg-purple-500/10 text-purple-400 border-purple-500/20",
	},
};

export function StatusBadge({ status }: { status: string }) {
	const config = statusConfig[status] ?? {
		label: status,
		className: "bg-gray-500/10 text-gray-400 border-gray-500/20",
	};
	return (
		<Badge variant="outline" className={cn("text-xs", config.className)}>
			{config.label}
		</Badge>
	);
}
