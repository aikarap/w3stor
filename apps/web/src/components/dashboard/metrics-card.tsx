"use client";

import { Card, CardContent } from "@/components/ui/card";
import { NumberTicker } from "@/components/ui/number-ticker";
import { cn } from "@/lib/utils";

interface MetricsCardProps {
	title: string;
	value: number;
	subtitle?: string;
	color?: "blue" | "green" | "purple" | "orange";
	format?: "number" | "bytes";
}

function formatBytes(bytes: number): string {
	if (bytes === 0) return "0 B";
	const sizes = ["B", "KB", "MB", "GB", "TB"];
	const i = Math.floor(Math.log(bytes) / Math.log(1024));
	return `${(bytes / 1024 ** i).toFixed(1)} ${sizes[i]}`;
}

const colorMap = {
	blue: "text-blue-400",
	green: "text-green-400",
	purple: "text-purple-400",
	orange: "text-orange-400",
};

export function MetricsCard({
	title,
	value,
	subtitle,
	color = "blue",
	format = "number",
	...rest
}: MetricsCardProps & Record<string, unknown>) {
	return (
		<Card data-spotlight-card {...rest}>
			<CardContent className="p-6">
				<div className="text-sm text-muted-foreground">{title}</div>
				<div className={cn("mt-2 text-3xl font-bold", colorMap[color])}>
					{format === "bytes" ? formatBytes(value) : <NumberTicker value={value} />}
				</div>
				{subtitle && <div className="mt-1 text-xs text-muted-foreground">{subtitle}</div>}
			</CardContent>
		</Card>
	);
}
