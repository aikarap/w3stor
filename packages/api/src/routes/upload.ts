import { createFile, createUserFile, findFileByCID, findOrCreateUser } from "@w3stor/db";
import { addFile } from "@w3stor/graph";
import { pinFileToIPFS } from "@w3stor/modules/pinata";
import { enqueueFilecoinUpload } from "@w3stor/modules/queue";
import { logger } from "@w3stor/shared";
import { Hono } from "hono";

export const uploadRoute = new Hono();

uploadRoute.post("/upload", async (c) => {
	try {
		// Wallet address is set by x402PaymentMiddleware after payment verification
		const walletAddress = c.get("walletAddress" as never) as string | undefined;

		if (!walletAddress) {
			// Should not reach here if x402 middleware is active — the middleware
			// returns 402 before this handler runs. This is a safety fallback.
			return c.json({ error: "Payment required" }, 402);
		}

		const formData = await c.req.formData();
		let file: File | null = formData.get("file") as File | null;

		if (!file || !(file instanceof File)) {
			return c.json({ error: "Missing 'file' field in form data" }, 400);
		}

		// Extract metadata before pinning — we'll release the file from memory after pin
		const filename = file.name;
		const contentType = file.type || "application/octet-stream";

		// Pin to IPFS via Pinata — this is the only step that needs the file bytes
		const pinResult = await pinFileToIPFS(file, filename);
		const cid = pinResult.IpfsHash;
		const sizeBytes = pinResult.PinSize;

		// Release file from memory — Pinata has it, workers will fetch from IPFS gateway
		file = null;

		// Ensure user exists
		await findOrCreateUser(walletAddress);

		// Check for duplicate
		const existing = await findFileByCID(cid);
		if (existing) {
			await createUserFile({
				walletAddress,
				cid,
				filename,
				metadata: {},
			});

			// Fire-and-forget: add to knowledge graph
			addFile({
				walletAddress,
				cid,
				filename,
				contentType,
				sizeBytes: Number(sizeBytes),
			}).catch((err) => {
				logger.warn("Graph add failed (non-blocking)", {
					cid,
					error: err instanceof Error ? err.message : String(err),
				});
			});

			return c.json({
				cid,
				status: existing.status,
				size: existing.sizeBytes,
				filename,
				duplicate: true,
			});
		}

		// Create file record
		const fileRecord = await createFile({
			cid,
			sizeBytes,
			contentType,
			pinataPinId: cid,
		});

		await createUserFile({
			walletAddress,
			cid,
			filename,
			metadata: {},
		});

		// Fire-and-forget: add to knowledge graph
		addFile({
			walletAddress,
			cid,
			filename,
			contentType,
			sizeBytes: Number(sizeBytes),
		}).catch((err) => {
			logger.warn("Graph add failed (non-blocking)", {
				cid,
				error: err instanceof Error ? err.message : String(err),
			});
		});

		// Enqueue Filecoin upload job
		await enqueueFilecoinUpload({
			cid,
			sizeBytes,
			walletAddress,
			pinataCid: cid,
			filename,
		});

		logger.info("File uploaded via /upload endpoint", { cid, filename, sizeBytes });

		return c.json({
			cid: fileRecord.cid,
			status: fileRecord.status,
			size: fileRecord.sizeBytes,
			filename,
			duplicate: false,
		});
	} catch (error) {
		logger.error("Upload failed", {
			error: error instanceof Error ? error.message : String(error),
		});
		return c.json(
			{ error: error instanceof Error ? error.message : "Upload failed" },
			500,
		);
	}
});
