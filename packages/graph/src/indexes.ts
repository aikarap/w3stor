import { getNeo4jDriver } from "./client";
import { logger } from "@w3stor/shared";

const INDEXES = [
  `CREATE CONSTRAINT agent_wallet IF NOT EXISTS FOR (a:Agent) REQUIRE a.walletAddress IS UNIQUE`,
  `CREATE CONSTRAINT file_scope IF NOT EXISTS FOR (f:File) REQUIRE (f.walletAddress, f.cid) IS UNIQUE`,
  `CREATE INDEX file_wallet IF NOT EXISTS FOR (f:File) ON (f.walletAddress)`,
];

const VECTOR_INDEX = `
  CREATE VECTOR INDEX file_embedding IF NOT EXISTS
  FOR (f:File) ON (f.embedding)
  OPTIONS {indexConfig: {
    \`vector.dimensions\`: 1536,
    \`vector.similarity_function\`: 'cosine'
  }}
`;

export async function initializeIndexes(): Promise<void> {
  const driver = getNeo4jDriver();
  const session = driver.session();

  try {
    for (const query of INDEXES) {
      await session.run(query);
    }
    await session.run(VECTOR_INDEX);
    logger.info("Neo4j indexes initialized");
  } finally {
    await session.close();
  }
}
