import { describe, expect, test } from "bun:test";
import {
  AddFileInput,
  ConnectFilesInput,
  DisconnectFilesInput,
  ConnectAgentInput,
  SemanticSearchInput,
  TraverseInput,
  type AddFileInputType,
} from "../src/schema";

describe("Schema validation", () => {
  test("AddFileInput validates correct input", () => {
    const input: AddFileInputType = {
      walletAddress: "0x1234567890abcdef1234567890abcdef12345678",
      cid: "QmTest123",
      filename: "test.txt",
      description: "A test file",
      tags: ["test", "demo"],
      contentType: "text/plain",
      sizeBytes: 1024,
    };
    expect(AddFileInput.parse(input)).toEqual(input);
  });

  test("AddFileInput requires walletAddress and cid", () => {
    expect(() => AddFileInput.parse({})).toThrow();
  });

  test("ConnectFilesInput validates correct input", () => {
    const input = { walletAddress: "0xabc", fromCid: "QmA", toCid: "QmB", relationship: "references" };
    expect(ConnectFilesInput.parse(input)).toEqual(input);
  });

  test("DisconnectFilesInput validates correct input", () => {
    const input = { walletAddress: "0xabc", fromCid: "QmA", toCid: "QmB", relationship: "references" };
    expect(DisconnectFilesInput.parse(input)).toEqual(input);
  });

  test("ConnectAgentInput validates correct input", () => {
    const input = { walletAddress: "0xabc", targetWallet: "0xdef" };
    expect(ConnectAgentInput.parse(input)).toEqual(input);
  });

  test("SemanticSearchInput validates with defaults", () => {
    const result = SemanticSearchInput.parse({ walletAddress: "0xabc", query: "find something" });
    expect(result.limit).toBe(10);
    expect(result.threshold).toBe(0.5);
  });

  test("TraverseInput validates with defaults", () => {
    const result = TraverseInput.parse({ walletAddress: "0xabc", cid: "QmTest" });
    expect(result.depth).toBe(2);
  });
});
