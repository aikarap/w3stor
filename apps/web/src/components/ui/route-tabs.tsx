"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface RouteTab {
	href: string;
	label: string;
}

interface RouteTabsProps {
	tabs: RouteTab[];
	className?: string;
}

export function RouteTabs({ tabs, className }: RouteTabsProps) {
	const pathname = usePathname();

	return (
		<div className={cn("flex gap-1 border-b border-border/50", className)}>
			{tabs.map((tab) => {
				const isActive =
					tab.href === "/dashboard"
						? pathname === "/dashboard" || pathname === "/dashboard/"
						: pathname.startsWith(tab.href);

				return (
					<Link
						key={tab.href}
						href={tab.href}
						className={cn(
							"relative px-4 py-2.5 text-sm font-medium transition-colors",
							isActive
								? "text-foreground"
								: "text-muted-foreground hover:text-foreground",
						)}
					>
						{tab.label}
						{isActive && (
							<span className="absolute inset-x-0 bottom-0 h-0.5 bg-foreground rounded-full" />
						)}
					</Link>
				);
			})}
		</div>
	);
}
