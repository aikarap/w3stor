import { z } from "zod";

// -- Mutation inputs --

export const AddFileInput = z.object({
  walletAddress: z.string(),
  cid: z.string(),
  filename: z.string().optional(),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  contentType: z.string().optional(),
  sizeBytes: z.number().optional(),
});
export type AddFileInputType = z.infer<typeof AddFileInput>;

export const ConnectFilesInput = z.object({
  walletAddress: z.string(),
  fromCid: z.string(),
  toCid: z.string(),
  relationship: z.string(),
});
export type ConnectFilesInputType = z.infer<typeof ConnectFilesInput>;

export const DisconnectFilesInput = z.object({
  walletAddress: z.string(),
  fromCid: z.string(),
  toCid: z.string(),
  relationship: z.string(),
});
export type DisconnectFilesInputType = z.infer<typeof DisconnectFilesInput>;

export const ConnectAgentInput = z.object({
  walletAddress: z.string(),
  targetWallet: z.string(),
});
export type ConnectAgentInputType = z.infer<typeof ConnectAgentInput>;

// -- Query inputs --

export const SemanticSearchInput = z.object({
  walletAddress: z.string(),
  query: z.string(),
  limit: z.number().default(10),
  threshold: z.number().default(0.5),
});
export type SemanticSearchInputType = z.infer<typeof SemanticSearchInput>;

export const TraverseInput = z.object({
  walletAddress: z.string(),
  cid: z.string(),
  depth: z.number().default(2),
  relationship: z.string().optional(),
});
export type TraverseInputType = z.infer<typeof TraverseInput>;

export const GetGraphInput = z.object({
  walletAddress: z.string(),
  limit: z.number().default(2000),
});
export type GetGraphInputType = z.infer<typeof GetGraphInput>;

// -- Output types --

export interface GraphNode {
  walletAddress: string;
  cid: string;
  filename?: string;
  description?: string;
  tags?: string[];
  contentType?: string;
  sizeBytes?: number;
  addedAt: string;
}

export interface GraphEdge {
  fromCid: string;
  toCid: string;
  relationship: string;
}

export interface SearchResult {
  cid: string;
  filename?: string;
  description?: string;
  tags?: string[];
  score: number;
  gatewayUrl: string;
}
