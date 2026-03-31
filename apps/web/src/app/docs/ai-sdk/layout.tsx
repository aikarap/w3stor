import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "Vercel AI SDK Integration",
	description: "Add permanent Filecoin storage to any Vercel AI SDK agent in 3 lines of code. Supports GPT-4, Claude, and any LLM with tool calling.",
	openGraph: {
		title: "Vercel AI SDK Integration | W3Stor",
		description: "Add permanent Filecoin storage to any Vercel AI SDK agent in 3 lines of code.",
		images: [{ url: "/images/logo-512.png", width: 512, height: 512, alt: "W3Stor" }],
	},
};

export default function Layout({ children }: { children: React.ReactNode }) {
	return children;
}
