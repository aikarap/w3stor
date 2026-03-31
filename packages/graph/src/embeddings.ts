import { embed, gateway } from "ai";
import { config, logger } from "@w3stor/shared";

export function buildEmbeddingText(meta: {
  filename?: string;
  description?: string;
  tags?: string[];
}): string {
  const parts: string[] = [];
  if (meta.filename) parts.push(meta.filename);
  if (meta.description) parts.push(meta.description);
  if (meta.tags?.length) parts.push(...meta.tags);
  return parts.join(" ");
}

export async function generateEmbedding(text: string): Promise<number[]> {
  if (!text.trim()) return [];

  const { embedding } = await embed({
    model: gateway.embedding(config.embedding.model),
    value: text,
  });

  logger.debug("Generated embedding", {
    textLength: text.length,
    dimensions: embedding.length,
  });

  return embedding;
}
