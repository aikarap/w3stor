import type { Metadata } from "next";
import { DocsSidebar } from "@/components/layout/docs-sidebar";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";

export const metadata: Metadata = {
	title: "Documentation | W3S Agent",
	description: "Integration guides for REST API, CLI, AI SDK, A2A Protocol, MCP, and more.",
};

export default function DocsLayout({ children }: { children: React.ReactNode }) {
	return (
		<div className="min-h-screen">
			<SiteHeader />
			<div className="mx-auto flex max-w-7xl gap-8 px-4 py-12">
				<DocsSidebar />
				<main className="min-w-0 flex-1">{children}</main>
			</div>
			<SiteFooter />
		</div>
	);
}
