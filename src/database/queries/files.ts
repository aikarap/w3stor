import { and, eq, sql } from "drizzle-orm";
import { getDatabase } from "../client";
import { fileSPStatus, files, userFiles } from "../schema/files";

export async function createFile(params: {
	cid: string;
	sizeBytes: number;
	contentType: string | null;
	pinataPinId: string | null;
	pieceCid?: string;
	status?: string;
	pinataPinned?: boolean;
}) {
	const db = getDatabase();
	const result = await db
		.insert(files)
		.values({
			cid: params.cid,
			sizeBytes: params.sizeBytes,
			contentType: params.contentType,
			pinataPinId: params.pinataPinId,
			pieceCid: params.pieceCid ?? null,
			status: params.status ?? "pinata_pinned",
			pinataPinned: params.pinataPinned ?? true,
		})
		.returning();
	return result[0]!;
}

export async function createUserFile(params: {
	walletAddress: string;
	cid: string;
	filename: string | null;
	metadata?: Record<string, unknown>;
}) {
	const db = getDatabase();
	const result = await db
		.insert(userFiles)
		.values({
			walletAddress: params.walletAddress,
			cid: params.cid,
			filename: params.filename,
			metadata: params.metadata ?? {},
		})
		.onConflictDoUpdate({
			target: [userFiles.walletAddress, userFiles.cid],
			set: {
				filename: sql`COALESCE(EXCLUDED.filename, ${userFiles.filename})`,
				metadata: sql`CASE
				WHEN ${userFiles.metadata} IS NOT NULL AND jsonb_typeof(${userFiles.metadata}::jsonb) = 'object'
				THEN ${userFiles.metadata} || EXCLUDED.metadata
				ELSE EXCLUDED.metadata
			END`,
			},
		})
		.returning();
	return result[0]!;
}

export async function findFileByCID(cid: string) {
	const db = getDatabase();
	const result = await db.select().from(files).where(eq(files.cid, cid));
	return result[0] ?? null;
}

export async function findUserFile(walletAddress: string, cid: string) {
	const db = getDatabase();
	const result = await db
		.select()
		.from(userFiles)
		.where(and(eq(userFiles.walletAddress, walletAddress), eq(userFiles.cid, cid)));
	return result[0] ?? null;
}

export async function listUserFiles(params: {
	walletAddress: string;
	limit?: number;
	offset?: number;
	status?: string;
	tags?: string[];
	search?: string;
}) {
	const db = getDatabase();
	const { walletAddress, limit = 20, offset = 0, status, tags, search } = params;

	const conditions = [sql`uf.wallet_address = ${walletAddress}`];
	if (status) conditions.push(sql`f.status = ${status}`);
	if (tags?.length) conditions.push(sql`uf.metadata @> ${JSON.stringify({ tags })}::jsonb`);
	if (search) {
		const pattern = `%${search}%`;
		conditions.push(
			sql`(uf.filename ILIKE ${pattern} OR uf.metadata->>'description' ILIKE ${pattern} OR uf.metadata->>'name' ILIKE ${pattern})`,
		);
	}

	const whereClause = sql.join(conditions, sql` AND `);

	const result = await db.execute(sql`
		SELECT f.*, uf.metadata as user_metadata, uf.filename as user_filename,
			(SELECT COUNT(*)::int FROM file_sp_status fsp WHERE fsp.cid = f.cid AND fsp.status IN ('stored', 'verified')) AS sp_count,
			COUNT(*) OVER() as total
		FROM user_files uf
		INNER JOIN files f ON f.cid = uf.cid
		WHERE ${whereClause}
		ORDER BY uf.created_at DESC
		LIMIT ${limit} OFFSET ${offset}
	`);

	const rows = result as Record<string, unknown>[];
	const total = rows.length > 0 ? Number(rows[0].total) : 0;
	const fileList = rows.map(({ total: _, ...row }) => row);

	return { files: fileList, total };
}

export async function updateFileStatus(cid: string, status: string) {
	const db = getDatabase();
	await db.update(files).set({ status, updatedAt: new Date() }).where(eq(files.cid, cid));
}

export async function updateFilePieceCid(cid: string, pieceCid: string) {
	const db = getDatabase();
	await db.update(files).set({ pieceCid, updatedAt: new Date() }).where(eq(files.cid, cid));
}

export async function updateSPStatus(params: {
	cid: string;
	spId: string;
	status: string;
	url?: string;
	verifiedAt?: Date;
	pieceCid?: string;
}) {
	const db = getDatabase();
	await db
		.insert(fileSPStatus)
		.values({
			cid: params.cid,
			spId: params.spId,
			status: params.status,
			url: params.url ?? null,
			pieceCid: params.pieceCid ?? null,
			verifiedAt: params.verifiedAt ?? null,
		})
		.onConflictDoUpdate({
			target: [fileSPStatus.cid, fileSPStatus.spId],
			set: {
				status: params.status,
				url: sql`COALESCE(EXCLUDED.url, ${fileSPStatus.url})`,
				pieceCid: sql`COALESCE(EXCLUDED.piece_cid, ${fileSPStatus.pieceCid})`,
				verifiedAt: sql`COALESCE(EXCLUDED.verified_at, ${fileSPStatus.verifiedAt})`,
				updatedAt: new Date(),
			},
		});
}

export async function getSPStatuses(cid: string) {
	const db = getDatabase();
	return db.select().from(fileSPStatus).where(eq(fileSPStatus.cid, cid));
}

export async function updatePinataStatus(cid: string, pinned: boolean) {
	const db = getDatabase();
	await db
		.update(files)
		.set({ pinataPinned: pinned, updatedAt: new Date() })
		.where(eq(files.cid, cid));
}

export async function getConfirmedSPCount(cid: string): Promise<number> {
	const db = getDatabase();
	const result = await db
		.select({ count: sql<number>`count(*)::int` })
		.from(fileSPStatus)
		.where(and(eq(fileSPStatus.cid, cid), sql`${fileSPStatus.status} IN ('stored', 'verified')`));
	return result[0]?.count ?? 0;
}
