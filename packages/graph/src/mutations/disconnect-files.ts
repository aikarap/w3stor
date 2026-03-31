import { getNeo4jDriver } from "../client";
import { DisconnectFilesInput, type DisconnectFilesInputType } from "../schema";
import { logger } from "@w3stor/shared";

export async function disconnectFiles(input: DisconnectFilesInputType): Promise<{ success: boolean }> {
  const data = DisconnectFilesInput.parse(input);
  const driver = getNeo4jDriver();
  const session = driver.session();

  try {
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(data.relationship)) {
      throw new Error(`Invalid relationship label: "${data.relationship}". Use only letters, numbers, and underscores.`);
    }

    await session.executeWrite(async (tx) => {
      await tx.run(
        `MATCH (a:File {walletAddress: $wallet, cid: $fromCid})
               -[r:${data.relationship}]->
               (b:File {walletAddress: $wallet, cid: $toCid})
         DELETE r`,
        { wallet: data.walletAddress, fromCid: data.fromCid, toCid: data.toCid }
      );
    });

    logger.info("Files disconnected in graph", { from: data.fromCid, to: data.toCid, relationship: data.relationship });
    return { success: true };
  } finally {
    await session.close();
  }
}
