import { config } from "@w3stor/shared";
import { randomBytes } from "crypto";

const nonceStore = new Map<string, number>();

let cleanupInterval: ReturnType<typeof setInterval> | null = null;

function ensureCleanup(): void {
  if (cleanupInterval) return;
  cleanupInterval = setInterval(() => {
    clearExpiredNonces();
  }, 60_000);
  if (cleanupInterval.unref) cleanupInterval.unref();
}

export function generateNonce(): string {
  ensureCleanup();
  const nonce = randomBytes(16).toString("hex");
  nonceStore.set(nonce, Date.now());
  return nonce;
}

export function consumeNonce(nonce: string): boolean {
  const created = nonceStore.get(nonce);
  if (!created) return false;

  const expiryMs = config.siwe.nonceExpiryMs;
  if (Date.now() - created > expiryMs) {
    nonceStore.delete(nonce);
    return false;
  }

  nonceStore.delete(nonce);
  return true;
}

export function clearExpiredNonces(): void {
  const now = Date.now();
  const expiryMs = config.siwe.nonceExpiryMs;
  for (const [nonce, created] of nonceStore) {
    if (now - created > expiryMs) {
      nonceStore.delete(nonce);
    }
  }
}
