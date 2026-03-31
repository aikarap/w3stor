import type { Metadata } from "next";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";

export const metadata: Metadata = {
	title: "Agent Activity",
	description: "Live feed of W3Stor agent operations — file uploads, Filecoin replication status, and on-chain storage proofs in real time.",
	openGraph: {
		title: "Agent Activity | W3Stor",
		description: "Live feed of W3Stor agent operations on Filecoin — uploads, replication, and on-chain proofs.",
		images: [{ url: "/images/logo-512.png", width: 512, height: 512, alt: "W3Stor" }],
	},
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
