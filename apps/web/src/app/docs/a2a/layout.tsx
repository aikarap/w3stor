import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "A2A Protocol",
	description: "Connect to W3Stor via Agent-to-Agent protocol. Discover the agent card, send JSON-RPC messages, and use natural language to store files on Filecoin.",
	openGraph: {
		title: "A2A Protocol | W3Stor",
		description: "Connect to W3Stor via Agent-to-Agent protocol for decentralized Filecoin storage.",
		images: [{ url: "/images/logo-512.png", width: 512, height: 512, alt: "W3Stor" }],
	},
};

export default function Layout({ children }: { children: React.ReactNode }) {
	return children;
}
