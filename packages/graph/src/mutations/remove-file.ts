import { getNeo4jDriver } from "../client";
import { logger } from "@w3stor/shared";

export async function removeFile(input: {
  walletAddress: string;
  cid: string;
}): Promise<{ success: boolean }> {
  const driver = getNeo4jDriver();
  const session = driver.session();

  try {
    const result = await session.executeWrite(async (tx) => {
      return tx.run(
        `MATCH (f:File {walletAddress: $walletAddress, cid: $cid})
         DETACH DELETE f
         RETURN count(f) AS deleted`,
        { walletAddress: input.walletAddress, cid: input.cid }
      );
    });

    const deleted = result.records[0].get("deleted").toNumber();
    logger.info("File removed from graph", { cid: input.cid, deleted });
    return { success: deleted > 0 };
  } finally {
    await session.close();
  }
}
