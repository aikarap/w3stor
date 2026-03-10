import { jsonb, pgTable, real, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./users";

export const conversations = pgTable("conversations", {
	id: uuid("id").primaryKey().defaultRandom(),
	contextId: text("context_id").unique().notNull(),
	walletAddress: text("wallet_address").references(() => users.walletAddress),
	sessionType: text("session_type").notNull().default("http"),
	state: text("state").notNull().default("active"),
	detectedIntent: text("detected_intent"),
	intentConfidence: real("intent_confidence"),
	collectedParams: jsonb("collected_params").default({}).notNull(),
	messages: jsonb("messages").default([]).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
