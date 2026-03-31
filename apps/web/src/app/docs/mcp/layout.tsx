import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "MCP Server",
	description: "Run W3Stor as a Model Context Protocol server for Claude, Cursor, and any MCP-compatible AI assistant. Every CLI command becomes an agent tool.",
	openGraph: {
		title: "MCP Server | W3Stor",
		description: "Run W3Stor as an MCP server — every CLI command becomes an AI agent tool.",
		images: [{ url: "/images/logo-512.png", width: 512, height: 512, alt: "W3Stor" }],
	},
};

export default function Layout({ children }: { children: React.ReactNode }) {
	return children;
}
