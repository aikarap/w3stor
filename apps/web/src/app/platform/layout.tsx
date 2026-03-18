import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "Platform Metrics | W3S Agent",
	description: "Real-time platform statistics — users, files, storage providers, and replication status.",
};

export default function PlatformLayout({ children }: { children: React.ReactNode }) {
	return children;
}
