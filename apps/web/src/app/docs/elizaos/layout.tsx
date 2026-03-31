import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "ElizaOS Plugin",
	description: "Give ElizaOS agents permanent decentralized storage on Filecoin. Three actions: store, list, and check status — all paid with x402 micropayments.",
	openGraph: {
		title: "ElizaOS Plugin | W3Stor",
		description: "Give ElizaOS agents permanent decentralized storage on Filecoin with x402 micropayments.",
		images: [{ url: "/images/logo-512.png", width: 512, height: 512, alt: "W3Stor" }],
	},
};

export default function Layout({ children }: { children: React.ReactNode }) {
	return children;
}
