// Client
export { getNeo4jDriver, closeNeo4jDriver } from "./client";

// Schema
export {
  AddFileInput,
  ConnectFilesInput,
  DisconnectFilesInput,
  ConnectAgentInput,
  SemanticSearchInput,
  TraverseInput,
  GetGraphInput,
  type AddFileInputType,
  type ConnectFilesInputType,
  type DisconnectFilesInputType,
  type ConnectAgentInputType,
  type SemanticSearchInputType,
  type TraverseInputType,
  type GetGraphInputType,
  type GraphNode,
  type GraphEdge,
  type SearchResult,
} from "./schema";

// Embeddings
export { buildEmbeddingText, generateEmbedding } from "./embeddings";

// Indexes
export { initializeIndexes } from "./indexes";

// Mutations
export { addFile } from "./mutations/add-file";
export { removeFile } from "./mutations/remove-file";
export { connectFiles } from "./mutations/connect-files";
export { disconnectFiles } from "./mutations/disconnect-files";
export { connectAgent } from "./mutations/connect-agent";

// Queries
export { semanticSearch } from "./queries/semantic-search";
export { traverse } from "./queries/traverse";
export { combinedSearch, type CombinedSearchInputType } from "./queries/combined-search";
export { getGraph } from "./queries/get-graph";
