import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "./status-badge";

interface ActivityItem {
	cid: string;
	filename: string;
	status: string;
	created_at: string;
}

function timeAgo(date: string): string {
	const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
	if (seconds < 60) return "just now";
	if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
	if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
	return `${Math.floor(seconds / 86400)}d ago`;
}

export function ActivityFeed({ items }: { items: ActivityItem[] }) {
	return (
		<Card data-spotlight-card>
			<CardHeader>
				<CardTitle className="text-sm font-medium text-muted-foreground">Recent Activity</CardTitle>
			</CardHeader>
			<CardContent>
				<div className="space-y-3">
					{items.length === 0 && (
						<p className="text-sm text-muted-foreground">No recent activity</p>
					)}
					{items.map((item) => (
						<div
							key={item.cid}
							className="flex items-center justify-between rounded-lg border border-border/50 p-3"
						>
							<div className="min-w-0 flex-1">
								<div className="truncate text-sm font-medium">{item.filename}</div>
								<div className="text-xs text-muted-foreground">{timeAgo(item.created_at)}</div>
							</div>
							<StatusBadge status={item.status} />
						</div>
					))}
				</div>
			</CardContent>
		</Card>
	);
}
