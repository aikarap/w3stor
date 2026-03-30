import {
	bigint,
	boolean,
	jsonb,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";
import { users } from "./users";

export const files = pgTable("files", {
	cid: text("cid").primaryKey(),
	pieceCid: text("piece_cid"),
	sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
	contentType: text("content_type"),
	status: text("status").notNull().default("pinata_pinned"),
	pinataPinned: boolean("pinata_pinned").notNull().default(true),
	pinataPinId: text("pinata_pin_id"),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const fileSPStatus = pgTable(
	"file_sp_status",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		cid: text("cid")
			.references(() => files.cid, { onDelete: "cascade" })
			.notNull(),
		spId: text("sp_id").notNull(),
		status: text("status").notNull().default("pending"),
		url: text("url"),
		pieceCid: text("piece_cid"),
		txHash: text("tx_hash"),
		verifiedAt: timestamp("verified_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [uniqueIndex("file_sp_status_cid_sp_id_unique").on(table.cid, table.spId)],
);

export const userFiles = pgTable(
	"user_files",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		walletAddress: text("wallet_address")
			.references(() => users.walletAddress, { onDelete: "cascade" })
			.notNull(),
		cid: text("cid")
			.references(() => files.cid, { onDelete: "cascade" })
			.notNull(),
		filename: text("filename"),
		metadata: jsonb("metadata").default({}),
		paymentTxHash: text("payment_tx_hash"),
		paymentNetwork: text("payment_network"),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [uniqueIndex("user_files_wallet_cid_unique").on(table.walletAddress, table.cid)],
);
