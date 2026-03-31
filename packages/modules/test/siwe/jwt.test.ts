import { describe, expect, test } from "bun:test";
import { signJwt, verifyJwt } from "../../src/siwe/jwt";

describe("SIWE JWT", () => {
  const wallet = "0x1234567890abcdef1234567890abcdef12345678";

  test("signJwt returns a string token", async () => {
    const token = await signJwt(wallet);
    expect(typeof token).toBe("string");
    expect(token.split(".")).toHaveLength(3);
  });

  test("verifyJwt returns wallet from valid token", async () => {
    const token = await signJwt(wallet);
    const result = await verifyJwt(token);
    expect(result).toBe(wallet);
  });

  test("verifyJwt returns null for invalid token", async () => {
    const result = await verifyJwt("invalid.token.here");
    expect(result).toBeNull();
  });

  test("wallet address is lowercased in token", async () => {
    const token = await signJwt("0xABCDEF1234567890ABCDEF1234567890ABCDEF12");
    const result = await verifyJwt(token);
    expect(result).toBe("0xabcdef1234567890abcdef1234567890abcdef12");
  });
});
