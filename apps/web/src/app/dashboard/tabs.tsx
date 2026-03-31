"use client";

import { RouteTabs } from "@/components/ui/route-tabs";

const dashboardTabs = [
	{ href: "/dashboard", label: "Files" },
	{ href: "/dashboard/chat", label: "Chat" },
	{ href: "/dashboard/workflows", label: "Workflows" },
	{ href: "/dashboard/graph", label: "Knowledge Graph" },
];

export function DashboardTabs() {
	return <RouteTabs tabs={dashboardTabs} />;
}
