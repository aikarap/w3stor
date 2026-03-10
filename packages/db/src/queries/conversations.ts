import type { ConversationMessage } from "@w3stor/shared";
import { desc, eq, sql } from "drizzle-orm";
import { getDatabase } from "../client";
import { conversations } from "../schema/conversations";

export async function createConversation(params: {
	contextId: string;
	walletAddress?: string;
	sessionType?: string;
}) {
	const db = getDatabase();
	const result = await db
		.insert(conversations)
		.values({
			contextId: params.contextId,
			walletAddress: params.walletAddress ?? null,
			sessionType: params.sessionType ?? "http",
		})
		.returning();
	return result[0]!;
}

export async function findByContextId(contextId: string) {
	const db = getDatabase();
	const result = await db
		.select()
		.from(conversations)
		.where(eq(conversations.contextId, contextId));
	return result[0] ?? null;
}

export async function updateState(params: {
	contextId: string;
	state: string;
	detectedIntent?: string;
	intentConfidence?: number;
	collectedParams?: Record<string, unknown>;
}) {
	const db = getDatabase();
	const updates: Record<string, unknown> = {
		state: params.state,
		updatedAt: new Date(),
	};
	if (params.detectedIntent !== undefined) updates.detectedIntent = params.detectedIntent;
	if (params.intentConfidence !== undefined) updates.intentConfidence = params.intentConfidence;
	if (params.collectedParams !== undefined) updates.collectedParams = params.collectedParams;

	await db.update(conversations).set(updates).where(eq(conversations.contextId, params.contextId));
}

export async function appendMessage(contextId: string, message: ConversationMessage) {
	const db = getDatabase();
	await db.execute(sql`
		UPDATE conversations
		SET messages = messages || ${JSON.stringify([message])}::jsonb,
			updated_at = NOW()
		WHERE context_id = ${contextId}
	`);
}

export async function listConversationsByWallet(
	walletAddress: string,
	params: { limit?: number; offset?: number } = {},
) {
	const db = getDatabase();
	const { limit = 20, offset = 0 } = params;

	const result = await db
		.select()
		.from(conversations)
		.where(eq(conversations.walletAddress, walletAddress))
		.orderBy(desc(conversations.updatedAt))
		.limit(limit)
		.offset(offset);

	const countResult = await db
		.select({ count: sql<number>`count(*)::int` })
		.from(conversations)
		.where(eq(conversations.walletAddress, walletAddress));

	return { conversations: result, total: countResult[0]?.count ?? 0 };
}

export async function listAllConversations(params: {
	page?: number;
	limit?: number;
	state?: string;
}) {
	const db = getDatabase();
	const { page = 1, limit = 50, state } = params;
	const offset = (page - 1) * limit;

	const whereClause = state ? eq(conversations.state, state) : undefined;

	const result = await db
		.select()
		.from(conversations)
		.where(whereClause)
		.orderBy(desc(conversations.updatedAt))
		.limit(limit)
		.offset(offset);

	const countResult = await db
		.select({ count: sql<number>`count(*)::int` })
		.from(conversations)
		.where(whereClause);

	return { conversations: result, total: countResult[0]?.count ?? 0 };
}

export async function getHistory(
	contextId: string,
	limit: number = 10,
): Promise<ConversationMessage[]> {
	const conv = await findByContextId(contextId);
	if (!conv) return [];

	const raw = (conv.messages as unknown[]) ?? [];
	// Handle double-serialized messages from old appendMessage bug
	const messages = raw.flatMap((m: unknown) => {
		if (typeof m === "string") {
			try {
				const parsed = JSON.parse(m);
				return Array.isArray(parsed) ? parsed : [parsed];
			} catch {
				return [];
			}
		}
		return [m];
	}) as ConversationMessage[];

	return messages.slice(-limit);
}
