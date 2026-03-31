import { SiweMessage } from "siwe";
import { config, logger } from "@w3stor/shared";
import { consumeNonce } from "./nonce";

export async function verifySiweMessage(
  message: string,
  signature: string
): Promise<{ address: string } | { error: string }> {
  try {
    const siweMessage = new SiweMessage(message);

    if (siweMessage.domain !== config.siwe.domain) {
      return { error: "Authentication failed" };
    }

    if (!siweMessage.nonce || !consumeNonce(siweMessage.nonce)) {
      return { error: "Authentication failed" };
    }

    const result = await siweMessage.verify({ signature });

    if (!result.success) {
      return { error: "Authentication failed" };
    }

    logger.info("SIWE verification successful", {
      address: result.data.address.toLowerCase(),
    });

    return { address: result.data.address.toLowerCase() };
  } catch (err) {
    logger.warn("SIWE verification failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return { error: "Authentication failed" };
  }
}
