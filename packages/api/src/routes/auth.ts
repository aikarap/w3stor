import { generateNonce, verifySiweMessage, signJwt } from "@w3stor/modules/siwe";
import { logger } from "@w3stor/shared";
import { Hono } from "hono";

export const authRoute = new Hono();

authRoute.get("/auth/siwe/nonce", (c) => {
  const nonce = generateNonce();
  return c.json({ nonce });
});

authRoute.post("/auth/siwe/verify", async (c) => {
  try {
    const { message, signature } = await c.req.json();

    if (!message || !signature) {
      return c.json({ error: "Missing message or signature" }, 400);
    }

    const result = await verifySiweMessage(message, signature);

    if ("error" in result) {
      return c.json({ error: result.error }, 401);
    }

    const token = await signJwt(result.address);

    logger.info("SIWE auth successful", { address: result.address });

    return c.json({ token, address: result.address });
  } catch (error) {
    logger.error("SIWE auth error", {
      error: error instanceof Error ? error.message : String(error),
    });
    return c.json({ error: "Authentication failed" }, 401);
  }
});
