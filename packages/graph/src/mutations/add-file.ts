import neo4j from "neo4j-driver";
import { getNeo4jDriver } from "../client";
import { AddFileInput, type AddFileInputType, type GraphNode } from "../schema";
import { buildEmbeddingText, generateEmbedding } from "../embeddings";
import { logger } from "@w3stor/shared";

export async function addFile(input: AddFileInputType): Promise<GraphNode> {
  const data = AddFileInput.parse(input);
  const driver = getNeo4jDriver();
  const session = driver.session();

  try {
    const text = buildEmbeddingText({
      filename: data.filename,
      description: data.description,
      tags: data.tags,
    });

    let embedding: number[] | null = null;
    try {
      embedding = text ? await generateEmbedding(text) : null;
    } catch (err) {
      logger.warn("Embedding generation failed, file will be added without embedding", {
        cid: data.cid,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    const result = await session.executeWrite(async (tx) => {
      await tx.run(
        `MERGE (a:Agent {walletAddress: $walletAddress})
         ON CREATE SET a.createdAt = datetime()`,
        { walletAddress: data.walletAddress }
      );

      const fileResult = await tx.run(
        `MERGE (f:File {walletAddress: $walletAddress, cid: $cid})
         ON CREATE SET
           f.filename = $filename,
           f.description = $description,
           f.tags = $tags,
           f.contentType = $contentType,
           f.sizeBytes = $sizeBytes,
           f.addedAt = datetime()
         ON MATCH SET
           f.filename = coalesce($filename, f.filename),
           f.description = coalesce($description, f.description),
           f.tags = coalesce($tags, f.tags),
           f.contentType = coalesce($contentType, f.contentType),
           f.sizeBytes = coalesce($sizeBytes, f.sizeBytes)
         RETURN f`,
        {
          walletAddress: data.walletAddress,
          cid: data.cid,
          filename: data.filename ?? null,
          description: data.description ?? null,
          tags: data.tags ?? null,
          contentType: data.contentType ?? null,
          sizeBytes: data.sizeBytes != null ? neo4j.int(data.sizeBytes) : null,
        }
      );

      if (embedding?.length) {
        await tx.run(
          `MATCH (f:File {walletAddress: $walletAddress, cid: $cid})
           SET f.embedding = $embedding`,
          { walletAddress: data.walletAddress, cid: data.cid, embedding }
        );
      }

      await tx.run(
        `MATCH (a:Agent {walletAddress: $walletAddress})
         MATCH (f:File {walletAddress: $walletAddress, cid: $cid})
         MERGE (a)-[:HAS_FILE]->(f)`,
        { walletAddress: data.walletAddress, cid: data.cid }
      );

      return fileResult.records[0].get("f").properties;
    });

    logger.info("File added to graph", { cid: data.cid, wallet: data.walletAddress });

    return {
      walletAddress: result.walletAddress,
      cid: result.cid,
      filename: result.filename,
      description: result.description,
      tags: result.tags,
      contentType: result.contentType,
      sizeBytes: result.sizeBytes?.toNumber?.() ?? result.sizeBytes,
      addedAt: result.addedAt?.toString() ?? new Date().toISOString(),
    };
  } finally {
    await session.close();
  }
}
