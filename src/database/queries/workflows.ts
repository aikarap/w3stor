import { desc, eq, sql } from "drizzle-orm";
import { getDatabase } from "../client";
import { workflowExecutions, workflowFiles, workflows } from "../schema/workflows";

export async function getWorkflowById(id: string) {
	const db = getDatabase();
	const result = await db.select().from(workflows).where(eq(workflows.id, id));
	return result[0] ?? null;
}

export async function listWorkflows(params: {
	walletAddress: string;
	page?: number;
	limit?: number;
}) {
	const db = getDatabase();
	const { walletAddress, page = 1, limit = 20 } = params;
	const offset = (page - 1) * limit;

	const [result, countResult] = await Promise.all([
		db
			.select()
			.from(workflows)
			.where(eq(workflows.walletAddress, walletAddress))
			.orderBy(desc(workflows.updatedAt))
			.limit(limit)
			.offset(offset),
		db
			.select({ count: sql<number>`count(*)::int` })
			.from(workflows)
			.where(eq(workflows.walletAddress, walletAddress)),
	]);

	const total = countResult[0]?.count ?? 0;

	return {
		workflows: result,
		total,
		page,
		limit,
		hasMore: offset + result.length < total,
	};
}

export async function createWorkflow(params: {
	walletAddress: string;
	name: string;
	description?: string;
	nodes?: unknown[];
	edges?: unknown[];
}) {
	const db = getDatabase();
	const result = await db
		.insert(workflows)
		.values({
			walletAddress: params.walletAddress,
			name: params.name,
			description: params.description,
			nodes: params.nodes ?? [],
			edges: params.edges ?? [],
		})
		.returning();
	return result[0]!;
}

export async function updateWorkflow(
	id: string,
	updates: Partial<{
		name: string;
		description: string;
		nodes: unknown[];
		edges: unknown[];
		visibility: string;
	}>,
) {
	const db = getDatabase();
	const result = await db
		.update(workflows)
		.set({ ...updates, updatedAt: new Date() })
		.where(eq(workflows.id, id))
		.returning();
	return result[0] ?? null;
}

export async function deleteWorkflow(id: string) {
	const db = getDatabase();
	await db.delete(workflows).where(eq(workflows.id, id));
}

export async function createWorkflowExecution(params: {
	workflowId: string;
	input?: unknown;
	estimatedCostUsdfc?: string;
	walletAddress?: string;
}) {
	const db = getDatabase();
	const result = await db
		.insert(workflowExecutions)
		.values({
			workflowId: params.workflowId,
			walletAddress: params.walletAddress ?? "",
			input: params.input ?? {},
			estimatedCostUsdfc: params.estimatedCostUsdfc,
		})
		.returning();
	return result[0]!;
}

export async function listWorkflowExecutions(params: {
	workflowId: string;
	page?: number;
	limit?: number;
}) {
	const db = getDatabase();
	const { workflowId, page = 1, limit = 20 } = params;
	const offset = (page - 1) * limit;

	const [result, countResult] = await Promise.all([
		db
			.select()
			.from(workflowExecutions)
			.where(eq(workflowExecutions.workflowId, workflowId))
			.orderBy(desc(workflowExecutions.startedAt))
			.limit(limit)
			.offset(offset),
		db
			.select({ count: sql<number>`count(*)::int` })
			.from(workflowExecutions)
			.where(eq(workflowExecutions.workflowId, workflowId)),
	]);

	const total = countResult[0]?.count ?? 0;

	return {
		executions: result,
		total,
		page,
		limit,
		hasMore: offset + result.length < total,
	};
}

export async function listWorkflowExecutionFiles(executionId: string) {
	const db = getDatabase();
	const result = await db
		.select()
		.from(workflowFiles)
		.where(eq(workflowFiles.executionId, executionId))
		.orderBy(desc(workflowFiles.createdAt));
	return { files: result };
}
