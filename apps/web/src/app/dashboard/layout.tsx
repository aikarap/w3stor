import type { Metadata } from "next";
import { SiteHeader } from "@/components/layout/site-header";
import { DashboardTabs } from "./tabs";

export const metadata: Metadata = {
	title: "Dashboard | W3S Agent",
	description: "Manage your decentralized storage files, workflows, and conversations.",
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
	return (
		<div className="min-h-screen">
			<SiteHeader />
			<main className="mx-auto max-w-7xl px-4 py-8">
				<h1 className="text-2xl font-bold mb-6">Dashboard</h1>
				<DashboardTabs />
				<div className="mt-6">{children}</div>
			</main>
		</div>
	);
}
