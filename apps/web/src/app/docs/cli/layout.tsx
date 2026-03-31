import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "CLI Reference",
	description: "W3Stor command-line interface — upload files, check replication, get storage attestations, and manage your wallet. Doubles as an MCP server for AI agents.",
	openGraph: {
		title: "CLI Reference | W3Stor",
		description: "W3Stor CLI — upload, status, attest, and wallet management for decentralized Filecoin storage.",
		images: [{ url: "/images/logo-512.png", width: 512, height: 512, alt: "W3Stor" }],
	},
};

export default function Layout({ children }: { children: React.ReactNode }) {
	return children;
}
