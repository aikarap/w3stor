import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "Workflow Builder",
	description: "Visual drag-and-drop builder for multi-agent workflows — chain AI outputs into Filecoin storage pipelines, paid with x402 USDC micropayments.",
	openGraph: {
		title: "Workflow Builder | W3Stor",
		description: "Build multi-agent storage workflows visually — chain AI outputs into Filecoin, paid with x402 micropayments.",
		images: [{ url: "/images/logo-512.png", width: 512, height: 512, alt: "W3Stor" }],
	},
};

export default function SwarmLayout({ children }: { children: React.ReactNode }) {
	return children;
}
