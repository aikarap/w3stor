import {
	integer,
	jsonb,
	numeric,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";
import { files } from "./files";
import { users } from "./users";

export const workflows = pgTable("workflows", {
	id: uuid("id").primaryKey().defaultRandom(),
	walletAddress: text("wallet_address")
		.references(() => users.walletAddress)
		.notNull(),
	name: text("name").notNull(),
	description: text("description"),
	nodes: jsonb("nodes").default([]).notNull(),
	edges: jsonb("edges").default([]).notNull(),
	config: jsonb("config").default({}).notNull(),
	visibility: text("visibility").notNull().default("private"),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const workflowExecutions = pgTable("workflow_executions", {
	id: uuid("id").primaryKey().defaultRandom(),
	workflowId: uuid("workflow_id")
		.references(() => workflows.id, { onDelete: "cascade" })
		.notNull(),
	walletAddress: text("wallet_address")
		.references(() => users.walletAddress, { onDelete: "cascade" })
		.notNull(),
	status: text("status").notNull().default("pending"),
	estimatedCostUsdfc: numeric("estimated_cost_usdfc"),
	actualCostUsdfc: numeric("actual_cost_usdfc"),
	input: jsonb("input").default({}),
	output: jsonb("output").default({}),
	error: text("error"),
	startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
	completedAt: timestamp("completed_at", { withTimezone: true }),
	durationMs: integer("duration_ms"),
});

export const workflowExecutionLogs = pgTable("workflow_execution_logs", {
	id: uuid("id").primaryKey().defaultRandom(),
	executionId: uuid("execution_id")
		.references(() => workflowExecutions.id, { onDelete: "cascade" })
		.notNull(),
	nodeId: text("node_id").notNull(),
	nodeName: text("node_name").notNull(),
	nodeType: text("node_type").notNull(),
	status: text("status").notNull().default("pending"),
	input: jsonb("input"),
	output: jsonb("output"),
	error: text("error"),
	costUsdfc: numeric("cost_usdfc"),
	startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
	completedAt: timestamp("completed_at", { withTimezone: true }),
	durationMs: integer("duration_ms"),
});

export const workflowFiles = pgTable(
	"workflow_files",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		executionId: uuid("execution_id")
			.references(() => workflowExecutions.id, { onDelete: "cascade" })
			.notNull(),
		workflowId: uuid("workflow_id")
			.references(() => workflows.id, { onDelete: "cascade" })
			.notNull(),
		cid: text("cid")
			.references(() => files.cid, { onDelete: "cascade" })
			.notNull(),
		nodeId: text("node_id"),
		nodeName: text("node_name"),
		filename: text("filename"),
		metadata: jsonb("metadata").default({}),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [uniqueIndex("workflow_files_execution_cid_unique").on(table.executionId, table.cid)],
);
