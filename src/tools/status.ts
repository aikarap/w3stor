import { tool } from "ai";
import { z } from "zod";

interface ToolDeps {
	apiUrl?: string;
	db?: { findFileByCID: Function; getSPStatuses: Function };
}

export function createCheckStatusTool(deps: ToolDeps) {
	return tool({
		description:
			"Check the replication status of a file by its CID. Returns provider details, deal status, and replication progress.",
		inputSchema: z.object({
			cid: z.string().describe("The content identifier (CID) of the file"),
		}),
		execute: async ({ cid }) => {
			if (deps.apiUrl) {
				const res = await fetch(`${deps.apiUrl}/status/${encodeURIComponent(cid)}`);
				if (!res.ok) return { error: "Failed to fetch status" };
				return await res.json();
			}
			if (deps.db) {
				const file = await deps.db.findFileByCID(cid);
				if (!file) return { error: "File not found" };
				const spStatuses = await deps.db.getSPStatuses(cid);
				return {
					cid: file.cid,
					status: file.status,
					sizeBytes: file.sizeBytes,
					contentType: file.contentType,
					pinataPinned: file.pinataPinned,
					providers: spStatuses.map(
						(sp: {
							spId: string;
							status: string;
							url: string | null;
							verifiedAt: Date | null;
						}) => ({
							spId: sp.spId,
							status: sp.status,
							url: sp.url,
							verifiedAt: sp.verifiedAt,
						}),
					),
				};
			}
			return { error: "No backend configured" };
		},
	});
}
