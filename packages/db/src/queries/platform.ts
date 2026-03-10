import { sql } from "drizzle-orm";
import { getDatabase } from "../client";

export async function listAllFiles(params: { page?: number; limit?: number }) {
	const db = getDatabase();
	const { page = 1, limit = 20 } = params;
	const offset = (page - 1) * limit;

	const result = await db.execute(sql`
		SELECT
			f.cid, f.piece_cid, f.size_bytes, f.content_type, f.status,
			f.pinata_pinned, f.created_at, f.updated_at,
			COALESCE(sp.cnt, 0)::int AS sp_count,
			COALESCE(
				json_agg(json_build_object(
					'wallet', uf.wallet_address,
					'filename', uf.filename,
					'metadata', uf.metadata
				)) FILTER (WHERE uf.wallet_address IS NOT NULL),
				'[]'::json
			) AS owners
		FROM files f
		LEFT JOIN (
			SELECT cid, COUNT(*) AS cnt FROM file_sp_status
			WHERE status IN ('stored', 'verified')
			GROUP BY cid
		) sp ON sp.cid = f.cid
		LEFT JOIN user_files uf ON uf.cid = f.cid
		GROUP BY f.cid, sp.cnt
		ORDER BY f.created_at DESC
		LIMIT ${limit} OFFSET ${offset}
	`);

	const countResult = await db.execute(sql`SELECT COUNT(*)::int AS count FROM files`);
	const total = (countResult[0] as { count: number })?.count ?? 0;

	return { files: result, total, page, limit, hasMore: offset + result.length < total };
}

export async function getPlatformMetrics() {
	const db = getDatabase();

	const [usersResult, filesResult, spResult, convResult, volumeResult] = await Promise.all([
		db.execute(sql`
			SELECT
				COUNT(*)::int AS total,
				COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days')::int AS recent
			FROM users
		`),
		db.execute(sql`
			SELECT
				COUNT(*)::int AS total,
				COALESCE(SUM(size_bytes), 0)::bigint AS total_bytes,
				(
					SELECT json_agg(json_build_object('status', status, 'count', cnt))
					FROM (SELECT status, COUNT(*)::int AS cnt FROM files GROUP BY status) s
				) AS by_status
			FROM files
		`),
		db.execute(sql`
			SELECT sp_id, status, COUNT(*)::int AS count
			FROM file_sp_status
			GROUP BY sp_id, status
			ORDER BY sp_id
		`),
		db.execute(sql`
			SELECT
				COUNT(*)::int AS total,
				COUNT(*) FILTER (WHERE state IN ('active', 'waiting_input', 'storing'))::int AS active
			FROM conversations
		`),
		db.execute(sql`
			SELECT
				DATE(created_at) AS date,
				COUNT(*)::int AS count,
				COALESCE(SUM(size_bytes), 0)::bigint AS bytes
			FROM files
			WHERE created_at > NOW() - INTERVAL '30 days'
			GROUP BY DATE(created_at)
			ORDER BY date DESC
		`),
	]);

	return {
		users: usersResult[0] ?? { total: 0, recent: 0 },
		files: filesResult[0] ?? { total: 0, total_bytes: 0, by_status: [] },
		storageProviders: spResult,
		conversations: convResult[0] ?? { total: 0, active: 0 },
		uploadVolume: volumeResult,
	};
}
