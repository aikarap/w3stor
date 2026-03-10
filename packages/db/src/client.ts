import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/index";

let db: ReturnType<typeof drizzle<typeof schema>> | null = null;
let sql: ReturnType<typeof postgres> | null = null;

export function getDatabase() {
	if (!db) {
		const databaseUrl = process.env.DATABASE_URL;
		if (!databaseUrl) throw new Error("DATABASE_URL is required");

		sql = postgres(databaseUrl, {
			max: parseInt(process.env.DATABASE_MAX_CONNECTIONS ?? "10", 10),
			idle_timeout: parseInt(process.env.DATABASE_IDLE_TIMEOUT ?? "20", 10),
			connect_timeout: parseInt(process.env.DATABASE_CONNECT_TIMEOUT ?? "10", 10),
		});

		db = drizzle(sql, { schema });
	}
	return db;
}

export async function closeDatabaseConnection() {
	if (sql) {
		await sql.end();
		sql = null;
		db = null;
	}
}

export async function healthCheck(): Promise<boolean> {
	try {
		const database = getDatabase();
		await database.execute("SELECT 1");
		return true;
	} catch {
		return false;
	}
}

export type Database = ReturnType<typeof getDatabase>;
