import neo4j from "neo4j-driver";
import { getNeo4jDriver } from "../client";
import { SemanticSearchInput, type SemanticSearchInputType, type SearchResult } from "../schema";
import { generateEmbedding } from "../embeddings";
import { config } from "@w3stor/shared";

export async function semanticSearch(input: SemanticSearchInputType): Promise<SearchResult[]> {
  const data = SemanticSearchInput.parse(input);
  const driver = getNeo4jDriver();
  const session = driver.session();

  try {
    const queryEmbedding = await generateEmbedding(data.query);
    if (!queryEmbedding.length) return [];

    const result = await session.executeRead(async (tx) => {
      return tx.run(
        `CALL db.index.vector.queryNodes('file_embedding', $candidates, $embedding)
         YIELD node, score
         WHERE node.walletAddress = $walletAddress AND score >= $threshold
         RETURN node, score
         ORDER BY score DESC
         LIMIT $limit`,
        {
          walletAddress: data.walletAddress,
          embedding: queryEmbedding,
          candidates: neo4j.int(Math.max(data.limit * 10, 500)),
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
