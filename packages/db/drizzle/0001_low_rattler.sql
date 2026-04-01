ALTER TABLE "file_sp_status" ADD COLUMN IF NOT EXISTS "tx_hash" text;--> statement-breakpoint
ALTER TABLE "user_files" ADD COLUMN IF NOT EXISTS "payment_tx_hash" text;--> statement-breakpoint
ALTER TABLE "user_files" ADD COLUMN IF NOT EXISTS "payment_network" text;