import { getNeo4jDriver } from "../client";

export async function getTotalGraphNodes(): Promise<number> {
	const driver = getNeo4jDriver();
	const session = driver.session({ database: "neo4j" });

	try {
		const result = await session.run("MATCH (f:File) RETURN count(f) AS total");
		const record = result.records[0];
		return record ? record.get("total").toNumber?.() ?? Number(record.get("total")) : 0;
	} finally {
		await session.close();
	}
}
