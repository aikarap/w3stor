"use client";

import dynamic from "next/dynamic";

const SwarmPage = dynamic(() => import("@/app/swarm/page"), { ssr: false });

export default function WorkflowsPage() {
	return <SwarmPage />;
}
