import { describe, expect, test } from "bun:test";
import { buildEmbeddingText } from "../src/embeddings";

describe("Embeddings", () => {
  test("buildEmbeddingText combines metadata fields", () => {
    const text = buildEmbeddingText({
      filename: "report.pdf",
      description: "Quarterly earnings report",
      tags: ["finance", "Q3"],
    });
    expect(text).toBe("report.pdf Quarterly earnings report finance Q3");
  });

  test("buildEmbeddingText handles missing fields", () => {
    const text = buildEmbeddingText({ filename: "photo.jpg" });
    expect(text).toBe("photo.jpg");
  });

  test("buildEmbeddingText handles empty input", () => {
    const text = buildEmbeddingText({});
    expect(text).toBe("");
  });
});
