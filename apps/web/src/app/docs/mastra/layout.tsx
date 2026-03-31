import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "Mastra Integration",
	description: "Integrate W3Stor into Mastra framework agents for permanent file storage on Filecoin. Upload, list, status, and attest tools included.",
	openGraph: {
		title: "Mastra Integration | W3Stor",
		description: "Integrate W3Stor into Mastra framework agents for permanent Filecoin storage.",
		images: [{ url: "/images/logo-512.png", width: 512, height: 512, alt: "W3Stor" }],
	},
};

export default function Layout({ children }: { children: React.ReactNode }) {
	return children;
}
