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
			uf.payment_tx_hash, uf.payment_network,
			(SELECT COUNT(*)::int FROM file_sp_status fsp WHERE fsp.cid = f.cid AND fsp.status IN ('stored', 'verified', 'tx_confirmed')) AS sp_count,
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

	const replicatedResult = await db.execute(sql`
		SELECT COUNT(*)::int AS count
		FROM user_files uf
		INNER JOIN files f ON f.cid = uf.cid
		WHERE uf.wallet_address = ${walletAddress}
		AND f.status = 'fully_replicated'
	`);
	const replicatedCount = (replicatedResult[0] as { count: number })?.count ?? 0;

	return { files: fileList, total, replicatedCount };
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
	txHash?: string;
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
			txHash: params.txHash ?? null,
		})
		.onConflictDoUpdate({
			target: [fileSPStatus.cid, fileSPStatus.spId],
			set: {
				status: params.status,
				url: sql`COALESCE(EXCLUDED.url, ${fileSPStatus.url})`,
				pieceCid: sql`COALESCE(EXCLUDED.piece_cid, ${fileSPStatus.pieceCid})`,
				verifiedAt: sql`COALESCE(EXCLUDED.verified_at, ${fileSPStatus.verifiedAt})`,
				txHash: sql`COALESCE(EXCLUDED.tx_hash, ${fileSPStatus.txHash})`,
				updatedAt: new Date(),
			},
		});
}

/**
 * Create SP rows only if they don't already exist.
 * Unlike updateSPStatus, this never overwrites existing progress.
 */
export async function ensurePendingSPRows(
	cid: string,
	providers: { name: string; url: string }[],
): Promise<void> {
	const db = getDatabase();
	const existing = await db
		.select({ spId: fileSPStatus.spId })
		.from(fileSPStatus)
		.where(eq(fileSPStatus.cid, cid));
	const existingIds = new Set(existing.map((r) => r.spId));

	for (const provider of providers) {
		if (!existingIds.has(provider.name)) {
			await db.insert(fileSPStatus).values({
				cid,
				spId: provider.name,
				status: "pending",
				url: provider.url,
			});
		}
	}
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
		.where(and(eq(fileSPStatus.cid, cid), sql`${fileSPStatus.status} IN ('stored', 'verified', 'tx_confirmed')`));
	return result[0]?.count ?? 0;
}

export async function updateUserFilePayment(params: {
	walletAddress: string;
	cid: string;
	paymentTxHash: string;
	paymentNetwork: string;
}) {
	const db = getDatabase();
	await db
		.update(userFiles)
		.set({
			paymentTxHash: params.paymentTxHash,
			paymentNetwork: params.paymentNetwork,
			updatedAt: new Date(),
		})
		.where(
			and(
				eq(userFiles.walletAddress, params.walletAddress),
				eq(userFiles.cid, params.cid),
			),
		);
}

export async function getStuckFiles(
	statuses: string[] = ["uploading", "failed"],
	limit: number = 50,
): Promise<
	{
		cid: string;
		sizeBytes: number;
		status: string;
		pieceCid: string | null;
		pinataPinned: boolean;
		walletAddress: string | null;
		filename: string | null;
		confirmedSPs: number;
		failedSPs: number;
		createdAt: Date;
	}[]
> {
	const db = getDatabase();
	// Build IN clause: drizzle sql`` doesn't auto-cast JS arrays to PG arrays
	const statusPlaceholders = statuses.map((s) => sql`${s}`);
	const statusList = sql.join(statusPlaceholders, sql`, `);

	const result = await db.execute(sql`
		SELECT
			f.cid,
			f.size_bytes,
			f.status,
			f.piece_cid,
			f.pinata_pinned,
			f.created_at,
			(SELECT uf.wallet_address FROM user_files uf WHERE uf.cid = f.cid LIMIT 1) AS wallet_address,
			(SELECT uf.filename FROM user_files uf WHERE uf.cid = f.cid LIMIT 1) AS filename,
			(SELECT COUNT(*)::int FROM file_sp_status s
			 WHERE s.cid = f.cid AND s.status IN ('stored', 'verified', 'tx_confirmed')) AS confirmed_sps,
			(SELECT COUNT(*)::int FROM file_sp_status s
			 WHERE s.cid = f.cid AND s.status = 'failed') AS failed_sps
		FROM files f
		WHERE f.status IN (${statusList})
		ORDER BY f.created_at DESC
		LIMIT ${limit}
	`);

	return (result as Record<string, unknown>[]).map((row) => ({
		cid: row.cid as string,
		sizeBytes: Number(row.size_bytes),
		status: row.status as string,
		pieceCid: row.piece_cid as string | null,
		pinataPinned: row.pinata_pinned as boolean,
		walletAddress: row.wallet_address as string | null,
		filename: row.filename as string | null,
		confirmedSPs: Number(row.confirmed_sps),
		failedSPs: Number(row.failed_sps),
		createdAt: row.created_at as Date,
	}));
}

/**
 * Get files eligible for auto-repair — excludes files with any SP in an active
 * in-progress state (uploading, pulling, piece_parked) to avoid:
 * - Infinite repair loops on piece_parked files
 * - Duplicate processing of files already being uploaded/pulled
 */
/**
 * Reset stale in-progress SP statuses to 'failed' so auto-repair can pick them up.
 * When a worker OOM-crashes, statuses like 'uploading', 'pulling', 'piece_parked'
 * are left in the DB. getRepairableFiles excludes these (correctly), but if the
 * worker is dead they're stale. Call on worker startup.
 */
export async function resetStaleSPStatuses(staleMinutes: number = 10): Promise<number> {
	const db = getDatabase();
	const result = await db.execute(sql`
		UPDATE file_sp_status
		SET status = 'failed', updated_at = NOW()
		WHERE status IN ('uploading', 'pulling', 'piece_parked')
		  AND updated_at < NOW() - INTERVAL '1 minute' * ${staleMinutes}
		RETURNING cid, sp_id
	`);
	return (result as unknown[]).length;
}

export async function getRepairableFiles(
	minReplicas: number = 3,
	limit: number = 5,
): Promise<
	{
		cid: string;
		sizeBytes: number;
		status: string;
		pieceCid: string | null;
		pinataPinned: boolean;
		walletAddress: string | null;
		filename: string | null;
		confirmedSPs: number;
		failedSPs: string[];
		createdAt: Date;
	}[]
> {
	const db = getDatabase();
	const result = await db.execute(sql`
		SELECT
			f.cid,
			f.size_bytes,
			f.status,
			f.piece_cid,
			f.pinata_pinned,
			f.created_at,
			(SELECT uf.wallet_address FROM user_files uf WHERE uf.cid = f.cid LIMIT 1) AS wallet_address,
			(SELECT uf.filename FROM user_files uf WHERE uf.cid = f.cid LIMIT 1) AS filename,
			(SELECT COUNT(*)::int FROM file_sp_status s
			 WHERE s.cid = f.cid AND s.status IN ('stored', 'verified', 'tx_confirmed')) AS confirmed_sps,
			ARRAY(
				SELECT s.sp_id FROM file_sp_status s
				WHERE s.cid = f.cid AND s.status IN ('failed', 'pending', 'tx_submitted', 'committing')
			) AS failed_sps
		FROM files f
		WHERE f.status NOT IN ('fully_replicated')
		  AND (SELECT COUNT(*)::int FROM file_sp_status s
		       WHERE s.cid = f.cid AND s.status IN ('stored', 'verified', 'tx_confirmed')) < ${minReplicas}
		  AND NOT EXISTS (
		    SELECT 1 FROM file_sp_status s
		    WHERE s.cid = f.cid AND s.status IN ('uploading', 'pulling', 'piece_parked')
		  )
		ORDER BY confirmed_sps DESC, f.created_at ASC
		LIMIT ${limit}
	`);

	return (result as Record<string, unknown>[]).map((row) => ({
		cid: row.cid as string,
		sizeBytes: Number(row.size_bytes),
		status: row.status as string,
		pieceCid: row.piece_cid as string | null,
		pinataPinned: row.pinata_pinned as boolean,
		walletAddress: row.wallet_address as string | null,
		filename: row.filename as string | null,
		confirmedSPs: Number(row.confirmed_sps),
		failedSPs: (row.failed_sps as string[]) ?? [],
		createdAt: row.created_at as Date,
	}));
}
