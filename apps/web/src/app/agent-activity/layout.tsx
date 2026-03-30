import type { Metadata } from "next";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";

export const metadata: Metadata = {
	title: "Agent Activity | W3S Agent",
	description: "Public view of storage agent activity on Filecoin.",
};

export default function AgentActivityLayout({ children }: { children: React.ReactNode }) {
	return (
		<div className="min-h-screen">
			<SiteHeader />
			<main className="mx-auto max-w-7xl px-4 py-8">{children}</main>
			<SiteFooter />
		</div>
	);
}
