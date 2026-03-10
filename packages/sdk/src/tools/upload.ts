import { tool } from "ai";
import { z } from "zod";

export const uploadTool = tool({
	description:
		"Upload a file to Filecoin storage. Client-side tool — the UI handles the actual upload with x402 payment signing.",
	inputSchema: z.object({
		filename: z.string().describe("Name of the file to upload"),
		size: z.number().optional().describe("File size in bytes, if known"),
	}),
	// No execute — this is a client-side tool (UI handles the upload flow)
});
