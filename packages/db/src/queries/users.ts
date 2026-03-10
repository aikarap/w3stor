import { eq, sql } from "drizzle-orm";
import { getDatabase } from "../client";
import { users } from "../schema/users";

export async function findUserByWallet(walletAddress: string) {
	const db = getDatabase();
	const result = await db.select().from(users).where(eq(users.walletAddress, walletAddress));
	return result[0] ?? null;
}

export async function createUser(walletAddress: string) {
	const db = getDatabase();
	const result = await db.insert(users).values({ walletAddress }).returning();
	return result[0]!;
}

export async function findOrCreateUser(walletAddress: string) {
	const db = getDatabase();
	const result = await db.insert(users).values({ walletAddress }).onConflictDoNothing().returning();

	if (result[0]) return result[0];

	const existing = await db.select().from(users).where(eq(users.walletAddress, walletAddress));
	return existing[0]!;
}

export async function listAllUsers(params: { page?: number; limit?: number } = {}) {
	const db = getDatabase();
	const { page = 1, limit = 50 } = params;
	const offset = (page - 1) * limit;

	const result = await db.execute(sql`
		SELECT u.*,
			COALESCE(uf.cnt, 0)::int AS file_count,
			COALESCE(c.cnt, 0)::int AS conversation_count
		FROM users u
		LEFT JOIN (SELECT wallet_address, COUNT(*) AS cnt FROM user_files GROUP BY wallet_address) uf
			ON uf.wallet_address = u.wallet_address
		LEFT JOIN (SELECT wallet_address, COUNT(*) AS cnt FROM conversations GROUP BY wallet_address) c
			ON c.wallet_address = u.wallet_address
		ORDER BY u.created_at DESC
		LIMIT ${limit} OFFSET ${offset}
	`);

	const countResult = await db.execute(sql`SELECT COUNT(*)::int AS count FROM users`);
	const total = (countResult[0] as { count: number })?.count ?? 0;

	return { users: result, total };
}
