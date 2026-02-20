import { tool } from "ai";
import { z } from "zod";

interface ToolDeps {
	apiUrl?: string;
	db?: { listUserFiles: Function };
}

export function createListFilesTool(deps: ToolDeps) {
	return tool({
		description:
			"List files uploaded by a wallet address. Returns filename, CID, size, upload date, and replication status.",
		inputSchema: z.object({
			wallet: z.string().describe("The wallet address (0x...) to list files for"),
		}),
		execute: async ({ wallet }) => {
			if (deps.apiUrl) {
				const res = await fetch(`${deps.apiUrl}/files?wallet=${encodeURIComponent(wallet)}`);
				if (!res.ok) return { error: "Failed to fetch files" };
				return await res.json();
			}
			if (deps.db) {
				const result = await deps.db.listUserFiles({ walletAddress: wallet, limit: 10 });
				return {
					files: result.files.map((f: Record<string, unknown>) => ({
						cid: f.cid,
						filename: f.filename ?? f.user_filename,
						sizeBytes: f.size_bytes ?? f.sizeBytes,
						status: f.status,
						createdAt: f.created_at ?? f.createdAt,
					})),
					total: result.total,
				};
			}
			return { error: "No backend configured" };
		},
	});
}
