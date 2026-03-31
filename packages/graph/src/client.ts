import neo4j, { type Driver } from "neo4j-driver";
import { config, logger } from "@w3stor/shared";

let driver: Driver | null = null;

export function getNeo4jDriver(): Driver {
  if (!driver) {
    const { uri, user, password } = config.neo4j;
    driver = neo4j.driver(uri, neo4j.auth.basic(user, password));
    logger.info("Neo4j driver initialized", { uri });
  }
  return driver;
}

export async function closeNeo4jDriver(): Promise<void> {
  if (driver) {
    await driver.close();
    driver = null;
    logger.info("Neo4j driver closed");
  }
}
