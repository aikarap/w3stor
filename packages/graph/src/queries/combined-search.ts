import neo4j from "neo4j-driver";
import { getNeo4jDriver } from "../client";
import { generateEmbedding } from "../embeddings";
import { type SearchResult } from "../schema";
import { config } from "@w3stor/shared";
import { z } from "zod";

export const CombinedSearchInput = z.object({
  walletAddress: z.string(),
  query: z.string(),
  fromCid: z.string(),
  depth: z.number().default(2),
  limit: z.number().default(10),
  threshold: z.number().default(0.5),
});
export type CombinedSearchInputType = z.infer<typeof CombinedSearchInput>;

export async function combinedSearch(input: CombinedSearchInputType): Promise<SearchResult[]> {
  const data = CombinedSearchInput.parse(input);
  const driver = getNeo4jDriver();
  const session = driver.session();

  try {
    const queryEmbedding = await generateEmbedding(data.query);
    if (!queryEmbedding.length) return [];

    const result = await session.executeRead(async (tx) => {
      return tx.run(
        `MATCH (start:File {walletAddress: $walletAddress, cid: $fromCid})
         CALL apoc.path.subgraphNodes(start, {maxLevel: $depth})
         YIELD node
         WHERE node:File AND node.walletAddress = $walletAddress
         WITH collect(node) AS subgraphNodes
         CALL db.index.vector.queryNodes('file_embedding', $limit * 2, $embedding)
         YIELD node AS candidate, score
         WHERE candidate IN subgraphNodes AND score >= $threshold
         RETURN candidate AS node, score
         ORDER BY score DESC
         LIMIT $limit`,
        {
          walletAddress: data.walletAddress,
          fromCid: data.fromCid,
          depth: data.depth,
          embedding: queryEmbedding,
          limit: neo4j.int(data.limit),
          threshold: data.threshold,
        }
      );
    });

    const gatewayUrl = config.pinata.gatewayUrl;

    return result.records.map((record) => {
      const node = record.get("node").properties;
      const score = record.get("score");
      return {
        cid: node.cid,
        filename: node.filename,
        description: node.description,
        tags: node.tags,
        score,
        gatewayUrl: `${gatewayUrl}/ipfs/${node.cid}`,
      };
    });
  } finally {
    await session.close();
  }
}
