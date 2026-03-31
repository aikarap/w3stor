import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "Workflows",
	description: "Build and execute multi-agent storage workflows with x402 USDC micropayments on Filecoin.",
	robots: { index: false, follow: false },
};

export default function WorkflowsLayout({ children }: { children: React.ReactNode }) {
	return children;
}
