import { sign, verify } from "hono/jwt";
import { config } from "@w3stor/shared";
import { randomUUID } from "crypto";

export async function signJwt(walletAddress: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  const payload = {
    sub: walletAddress.toLowerCase(),
    iat: now,
    exp: now + config.siwe.tokenExpirySeconds,
    iss: "w3stor",
    jti: randomUUID(),
  };

  return sign(payload, config.siwe.jwtSecret);
}

export async function verifyJwt(token: string): Promise<string | null> {
  try {
    const payload = await verify(token, config.siwe.jwtSecret, "HS256");
    if (typeof payload.sub !== "string") return null;
    return payload.sub;
  } catch {
    return null;
  }
}
