import { getNeo4jDriver } from "../client";
import { ConnectFilesInput, type ConnectFilesInputType } from "../schema";
import { logger } from "@w3stor/shared";

export async function connectFiles(input: ConnectFilesInputType): Promise<{ success: boolean }> {
  const data = ConnectFilesInput.parse(input);
  const driver = getNeo4jDriver();
  const session = driver.session();

  try {
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(data.relationship)) {
      throw new Error(`Invalid relationship label: "${data.relationship}". Use only letters, numbers, and underscores.`);
    }

    await session.executeWrite(async (tx) => {
      const result = await tx.run(
        `MATCH (a:File {walletAddress: $wallet, cid: $fromCid})
         MATCH (b:File {walletAddress: $wallet, cid: $toCid})
         RETURN a, b`,
        { wallet: data.walletAddress, fromCid: data.fromCid, toCid: data.toCid }
      );

      if (result.records.length === 0) {
        throw new Error(`Files not found in wallet ${data.walletAddress}: ${data.fromCid} → ${data.toCid}`);
      }

      await tx.run(
        `MATCH (a:File {walletAddress: $wallet, cid: $fromCid})
         MATCH (b:File {walletAddress: $wallet, cid: $toCid})
         MERGE (a)-[:${data.relationship}]->(b)`,
        { wallet: data.walletAddress, fromCid: data.fromCid, toCid: data.toCid }
      );
    });

    logger.info("Files connected in graph", { from: data.fromCid, to: data.toCid, relationship: data.relationship });
    return { success: true };
  } finally {
    await session.close();
  }
}
