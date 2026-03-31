import { createMiddleware } from "hono/factory";
import type { Context, Next } from "hono";
import { verifyJwt } from "@w3stor/modules/siwe";

export const siweMiddleware = createMiddleware(async (c: Context, next: Next) => {
  const authHeader = c.req.header("Authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "Authentication required" }, 401);
  }

  const token = authHeader.slice(7);
  const walletAddress = await verifyJwt(token);

  if (!walletAddress) {
    return c.json({ error: "Authentication failed" }, 401);
  }

  c.set("walletAddress" as never, walletAddress as never);
  await next();
});
