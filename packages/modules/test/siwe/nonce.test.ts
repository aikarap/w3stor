import { describe, expect, test, beforeEach } from "bun:test";
import { generateNonce, consumeNonce, clearExpiredNonces } from "../../src/siwe/nonce";

describe("SIWE Nonce", () => {
  beforeEach(() => {
    clearExpiredNonces();
  });

  test("generateNonce returns a random string", () => {
    const nonce = generateNonce();
    expect(typeof nonce).toBe("string");
    expect(nonce.length).toBeGreaterThan(8);
  });

  test("generateNonce returns unique values", () => {
    const a = generateNonce();
    const b = generateNonce();
    expect(a).not.toBe(b);
  });

  test("consumeNonce returns true for valid nonce", () => {
    const nonce = generateNonce();
    expect(consumeNonce(nonce)).toBe(true);
  });

  test("consumeNonce returns false for already consumed nonce", () => {
    const nonce = generateNonce();
    consumeNonce(nonce);
    expect(consumeNonce(nonce)).toBe(false);
  });

  test("consumeNonce returns false for unknown nonce", () => {
    expect(consumeNonce("nonexistent")).toBe(false);
  });
});
