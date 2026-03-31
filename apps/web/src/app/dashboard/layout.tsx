import type { Metadata } from "next";
import { SiteHeader } from "@/components/layout/site-header";
import { DashboardTabs } from "./tabs";

export const metadata: Metadata = {
	title: "Dashboard",
	description: "Manage your files stored on Filecoin — track replication status, view storage proofs, and execute multi-agent workflows.",
	robots: { index: false, follow: false },
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
