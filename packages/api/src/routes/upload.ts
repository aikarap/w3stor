import { createFile, createUserFile, findFileByCID, findOrCreateUser } from "@w3stor/db";
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
		const file = formData.get("file");

		if (!file || !(file instanceof File)) {
			return c.json({ error: "Missing 'file' field in form data" }, 400);
		}

		// Pin to IPFS via Pinata
		const pinResult = await pinFileToIPFS(file, file.name);
		const cid = pinResult.IpfsHash;
		const sizeBytes = pinResult.PinSize;

		// Ensure user exists
		await findOrCreateUser(walletAddress);

		// Check for duplicate
		const existing = await findFileByCID(cid);
		if (existing) {
			await createUserFile({
				walletAddress,
				cid,
				filename: file.name,
				metadata: {},
			});

			return c.json({
				cid,
				status: existing.status,
				size: existing.sizeBytes,
				filename: file.name,
				duplicate: true,
			});
		}

		// Create file record
		const fileRecord = await createFile({
			cid,
			sizeBytes,
			contentType: file.type || "application/octet-stream",
			pinataPinId: cid,
		});

		await createUserFile({
			walletAddress,
			cid,
			filename: file.name,
			metadata: {},
		});

		// Enqueue Filecoin upload job
		await enqueueFilecoinUpload({
			cid,
			sizeBytes,
			walletAddress,
			pinataCid: cid,
			filename: file.name,
		});

		logger.info("File uploaded via /upload endpoint", { cid, filename: file.name, sizeBytes });

		return c.json({
			cid: fileRecord.cid,
			status: fileRecord.status,
			size: fileRecord.sizeBytes,
			filename: file.name,
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
