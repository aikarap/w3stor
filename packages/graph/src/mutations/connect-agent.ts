import { getNeo4jDriver } from "../client";
import { ConnectAgentInput, type ConnectAgentInputType } from "../schema";
import { logger } from "@w3stor/shared";

export async function connectAgent(input: ConnectAgentInputType): Promise<{ success: boolean }> {
  const data = ConnectAgentInput.parse(input);
  const driver = getNeo4jDriver();
  const session = driver.session();

  try {
    await session.executeWrite(async (tx) => {
      await tx.run(
        `MERGE (a:Agent {walletAddress: $walletAddress})
         ON CREATE SET a.createdAt = datetime()
         MERGE (b:Agent {walletAddress: $targetWallet})
         ON CREATE SET b.createdAt = datetime()
         MERGE (a)-[:KNOWS_AGENT]->(b)`,
        { walletAddress: data.walletAddress, targetWallet: data.targetWallet }
      );
    });

    logger.info("Agent connected in graph", { from: data.walletAddress, to: data.targetWallet });
    return { success: true };
  } finally {
    await session.close();
  }
}
