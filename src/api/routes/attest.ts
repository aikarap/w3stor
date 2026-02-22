import { findFileByCID, getConfirmedSPCount, getSPStatuses } from "@w3stor/db";
import { config } from "@w3stor/shared";
import { Hono } from "hono";
import { extractPayer } from "../middleware/x402";

export const attestRoute = new Hono();

/** POST /attest/:cid — x402 protected */
attestRoute.post("/attest/:cid", async (c) => {
	const cid = c.req.param("cid");
	const walletAddress =
		(c.get("walletAddress" as never) as string | undefined) ??
		extractPayer(c.req);

	if (!walletAddress) {
		return c.json({ error: "Payment required" }, 402);
	}

	const file = await findFileByCID(cid);
	if (!file) return c.json({ error: "File not found" }, 404);

	const spStatuses = await getSPStatuses(cid);
	const confirmedCount = await getConfirmedSPCount(cid);

	const minReplication = config.filecoin.replicationMinProviders;
	if (confirmedCount < minReplication) {
		return c.json(
			{
				error: `Insufficient replication: ${confirmedCount}/${minReplication} confirmed providers`,
			},
			412,
		);
	}

	const providers = spStatuses.map((sp: any) => ({
		id: sp.spId,
		url: sp.url,
		status: sp.status,
		verifiedAt: sp.verifiedAt,
		pieceCid: sp.pieceCid ?? file.pieceCid,
	}));

	const attestationData = JSON.stringify({
		cid,
		pieceCid: file.pieceCid,
		sizeBytes: file.sizeBytes,
		providers: providers.map((p: any) => p.id),
		timestamp: new Date().toISOString(),
	});

	const encoder = new TextEncoder();
	const attestationHash = Buffer.from(
		await crypto.subtle.digest("SHA-256", encoder.encode(attestationData)),
	).toString("hex");

	const verificationData = JSON.stringify({
		attestationHash,
		payer: walletAddress,
		timestamp: new Date().toISOString(),
	});

	const verificationHash = Buffer.from(
		await crypto.subtle.digest("SHA-256", encoder.encode(verificationData)),
	).toString("hex");

	return c.json({
		success: true,
		attestation: {
			cid,
			pieceCid: file.pieceCid,
			sizeBytes: file.sizeBytes,
			status: file.status,
			providers,
			replicationStatus: {
				confirmed: confirmedCount,
				total: spStatuses.length,
				fullyReplicated: confirmedCount >= spStatuses.length,
			},
			verification: {
				attestationHash,
				verificationHash,
				timestamp: new Date().toISOString(),
				verifier: "web3-storage-agent-v0.1.0",
			},
		},
	});
});
