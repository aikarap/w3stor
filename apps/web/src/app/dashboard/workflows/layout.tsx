import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "Workflow Builder | W3S Agent",
	description: "Build and execute multi-agent storage workflows with x402 micropayments.",
};

export default function WorkflowsLayout({ children }: { children: React.ReactNode }) {
	return children;
}
