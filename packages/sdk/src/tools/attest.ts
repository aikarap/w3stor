import { tool } from "ai";
import { z } from "zod";

interface ToolDeps {
	apiUrl?: string;
	db?: { findFileByCID: Function; getSPStatuses: Function; getConfirmedSPCount: Function };
}

export function createAttestTool(deps: ToolDeps) {
	return tool({
		description:
			"Generate a cryptographic attestation proving a file is replicated across Filecoin storage providers.",
		inputSchema: z.object({
			cid: z.string().describe("The CID of the file to attest"),
		}),
		execute: async ({ cid }) => {
			if (deps.apiUrl) {
				const res = await fetch(`${deps.apiUrl}/attest/${encodeURIComponent(cid)}`, { method: "POST" });
				if (!res.ok) return { error: "Failed to generate attestation" };
				return await res.json();
			}
			if (deps.db) {
				const file = await deps.db.findFileByCID(cid);
				if (!file) return { error: "File not found" };
				const spStatuses = await deps.db.getSPStatuses(cid);
				const confirmedCount = await deps.db.getConfirmedSPCount(cid);
				return {
					cid,
					status: file.status,
					confirmedProviders: confirmedCount,
					totalProviders: spStatuses.length,
					providers: spStatuses.map(
						(sp: { spId: string; status: string; verifiedAt: Date | null }) => ({
							spId: sp.spId,
							status: sp.status,
							verifiedAt: sp.verifiedAt,
						}),
					),
				};
			}
			return { error: "No backend configured" };
		},
	});
}
