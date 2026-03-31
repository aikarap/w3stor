import neo4j from "neo4j-driver";
import { getNeo4jDriver } from "../client";
import { GetGraphInput, type GetGraphInputType, type GraphNode, type GraphEdge } from "../schema";

export async function getGraph(
  input: GetGraphInputType
): Promise<{ nodes: GraphNode[]; edges: GraphEdge[] }> {
  const data = GetGraphInput.parse(input);
  const driver = getNeo4jDriver();
  const session = driver.session();

  try {
    const result = await session.executeRead(async (tx) => {
      const filesResult = await tx.run(
        `MATCH (a:Agent {walletAddress: $walletAddress})-[:HAS_FILE]->(f:File)
         RETURN f
         ORDER BY f.addedAt DESC
         LIMIT $limit`,
        { walletAddress: data.walletAddress, limit: neo4j.int(data.limit) }
      );

      const edgesResult = await tx.run(
        `MATCH (a:File {walletAddress: $walletAddress})-[r]->(b:File {walletAddress: $walletAddress})
         WHERE type(r) <> 'HAS_FILE'
         RETURN a.cid AS fromCid, b.cid AS toCid, type(r) AS relationship`,
        { walletAddress: data.walletAddress }
      );

      return { files: filesResult, edges: edgesResult };
    });

    const nodes: GraphNode[] = result.files.records.map((record) => {
      const f = record.get("f").properties;
      return {
        walletAddress: f.walletAddress,
        cid: f.cid,
        filename: f.filename,
        description: f.description,
        tags: f.tags,
        contentType: f.contentType,
        sizeBytes: f.sizeBytes?.toNumber?.() ?? f.sizeBytes,
        addedAt: f.addedAt?.toString() ?? "",
      };
    });

    const edges: GraphEdge[] = result.edges.records.map((record) => ({
      fromCid: record.get("fromCid"),
      toCid: record.get("toCid"),
      relationship: record.get("relationship"),
    }));

    return { nodes, edges };
  } finally {
    await session.close();
  }
}
