import neo4j from "neo4j-driver";
import { getNeo4jDriver } from "../client";
import { TraverseInput, type TraverseInputType, type GraphNode, type GraphEdge } from "../schema";

export async function traverse(
  input: TraverseInputType
): Promise<{ nodes: GraphNode[]; edges: GraphEdge[] }> {
  const data = TraverseInput.parse(input);
  const driver = getNeo4jDriver();
  const session = driver.session();

  try {
    const relFilter = data.relationship
      ? `relationshipFilter: "${data.relationship}"`
      : "";

    const result = await session.executeRead(async (tx) => {
      return tx.run(
        `MATCH (start:File {walletAddress: $walletAddress, cid: $cid})
         CALL apoc.path.subgraphAll(start, {maxLevel: $depth ${relFilter ? `, ${relFilter}` : ""}})
         YIELD nodes, relationships
         RETURN nodes, relationships`,
        {
          walletAddress: data.walletAddress,
          cid: data.cid,
          depth: neo4j.int(data.depth),
        }
      );
    });

    if (result.records.length === 0) {
      return { nodes: [], edges: [] };
    }

    const record = result.records[0];
    const rawNodes = record.get("nodes");
    const rawRels = record.get("relationships");

    const nodes: GraphNode[] = rawNodes
      .filter((n: any) => n.labels.includes("File"))
      .map((n: any) => ({
        walletAddress: n.properties.walletAddress,
        cid: n.properties.cid,
        filename: n.properties.filename,
        description: n.properties.description,
        tags: n.properties.tags,
        contentType: n.properties.contentType,
        sizeBytes: n.properties.sizeBytes?.toNumber?.() ?? n.properties.sizeBytes,
        addedAt: n.properties.addedAt?.toString() ?? "",
      }));

    const nodeIdToCid = new Map<string, string>();
    for (const n of rawNodes) {
      if (n.properties.cid) {
        nodeIdToCid.set(n.identity.toString(), n.properties.cid);
      }
    }

    const edges: GraphEdge[] = rawRels
      .filter((r: any) => r.type !== "HAS_FILE")
      .map((r: any) => ({
        fromCid: nodeIdToCid.get(r.start.toString()) ?? "",
        toCid: nodeIdToCid.get(r.end.toString()) ?? "",
        relationship: r.type,
      }))
      .filter((e: GraphEdge) => e.fromCid && e.toCid);

    return { nodes, edges };
  } finally {
    await session.close();
  }
}
