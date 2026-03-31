import { createFile, createUserFile, findFileByCID, findOrCreateUser } from "@w3stor/db";
import { pinFileToIPFS } from "@w3stor/modules/pinata";
import { enqueueFilecoinUpload } from "@w3stor/modules/queue";
import { addFile, connectFiles } from "@w3stor/graph";
import { logger } from "@w3stor/shared";
import { Hono } from "hono";
import { z } from "zod";

const BatchMetadataSchema = z.object({
  files: z.array(z.object({
    index: z.number(),
    description: z.string().optional(),
    tags: z.array(z.string()).optional(),
    connections: z.array(z.object({
      toCid: z.string().optional(),
      toIndex: z.number().optional(),
      relationship: z.string(),
    })).optional(),
  })),
});

const MAX_FILES = 10;
const MAX_SIZE_BYTES = 100 * 1024 * 1024;
const MAX_CONNECTIONS = 50;

export const batchUploadRoute = new Hono();

batchUploadRoute.post("/upload/batch", async (c) => {
  try {
    const walletAddress = c.get("walletAddress" as never) as string | undefined;
    if (!walletAddress) return c.json({ error: "Payment required" }, 402);

    const formData = await c.req.formData();
    const metadataRaw = formData.get("metadata");
    if (!metadataRaw || typeof metadataRaw !== "string") {
      return c.json({ error: "Missing metadata field" }, 400);
    }

    const metadata = BatchMetadataSchema.parse(JSON.parse(metadataRaw));

    // Collect files
    const files: { index: number; file: File }[] = [];
    let totalSize = 0;
    for (let i = 0; ; i++) {
      const file = formData.get(`file_${i}`);
      if (!file || !(file instanceof File)) break;
      files.push({ index: i, file });
      totalSize += file.size;
    }

    if (files.length === 0) return c.json({ error: "No files provided" }, 400);
    if (files.length > MAX_FILES) return c.json({ error: `Max ${MAX_FILES} files per batch` }, 400);
    if (totalSize > MAX_SIZE_BYTES) return c.json({ error: `Max 100MB per batch` }, 400);

    // Validate declared counts match actual
    const declaredFiles = parseInt(c.req.header("x-batch-files") || "0", 10);
    const declaredSize = parseInt(c.req.header("x-batch-size") || "0", 10);
    if (files.length > declaredFiles || totalSize > declaredSize) {
      return c.json({ error: "Actual batch exceeds declared headers" }, 400);
    }

    const totalConnections = metadata.files.reduce(
      (sum, f) => sum + (f.connections?.length || 0), 0
    );
    if (totalConnections > MAX_CONNECTIONS) {
      return c.json({ error: `Max ${MAX_CONNECTIONS} connections per batch` }, 400);
    }

    await findOrCreateUser(walletAddress);

    // 1. Upload all files to IPFS (parallel)
    const uploadResults = await Promise.allSettled(
      files.map(async ({ file }) => {
        const pinResult = await pinFileToIPFS(file, file.name);
        return { cid: pinResult.IpfsHash, sizeBytes: pinResult.PinSize, filename: file.name, contentType: file.type };
      })
    );

    // 2. Process results, create DB records
    const cidMap = new Map<number, string>();
    const fileResults: any[] = [];

    for (let i = 0; i < uploadResults.length; i++) {
      const result = uploadResults[i];
      if (result.status === "rejected") {
        fileResults.push({ index: i, error: result.reason?.message || "Upload failed", graphAdded: false });
        continue;
      }

      const { cid, sizeBytes, filename, contentType } = result.value;
      cidMap.set(i, cid);

      const existing = await findFileByCID(cid);
      if (!existing) {
        await createFile({ cid, sizeBytes, contentType: contentType || "application/octet-stream", pinataPinId: cid });
      }
      await createUserFile({ walletAddress, cid, filename, metadata: {} });

      const fileMeta = metadata.files.find((f) => f.index === i);

      // 3. Add to graph
      let graphAdded = true;
      try {
        await addFile({
          walletAddress,
          cid,
          filename,
          description: fileMeta?.description,
          tags: fileMeta?.tags,
          contentType: contentType || "application/octet-stream",
          sizeBytes: Number(sizeBytes),
        });
      } catch {
        graphAdded = false;
      }

      await enqueueFilecoinUpload({ cid, sizeBytes, walletAddress, pinataCid: cid, filename });

      fileResults.push({ cid, status: "pinata_pinned", size: sizeBytes, filename, graphAdded });
    }

    // 4-5. Resolve connections and create edges
    const connectionResults: any[] = [];
    for (const fileMeta of metadata.files) {
      if (!fileMeta.connections?.length) continue;
      const fromCid = cidMap.get(fileMeta.index);
      if (!fromCid) continue;

      for (const conn of fileMeta.connections) {
        const toCid = conn.toCid || (conn.toIndex !== undefined ? cidMap.get(conn.toIndex) : undefined);
        if (!toCid) {
          connectionResults.push({ fromCid, toCid: null, relationship: conn.relationship, success: false, error: "Target not found" });
          continue;
        }

        try {
          await connectFiles({ walletAddress, fromCid, toCid, relationship: conn.relationship });
          connectionResults.push({ fromCid, toCid, relationship: conn.relationship, success: true });
        } catch (err) {
          connectionResults.push({ fromCid, toCid, relationship: conn.relationship, success: false, error: err instanceof Error ? err.message : "Failed" });
        }
      }
    }

    logger.info("Batch upload complete", { total: fileResults.length, connections: connectionResults.length, wallet: walletAddress });

    return c.json({
      files: fileResults,
      connections: connectionResults,
      total: fileResults.filter((f: any) => f.cid).length,
      totalConnections: connectionResults.filter((c: any) => c.success).length,
    });
  } catch (error) {
    logger.error("Batch upload failed", { error: error instanceof Error ? error.message : String(error) });
    return c.json({ error: error instanceof Error ? error.message : "Batch upload failed" }, 500);
  }
});
