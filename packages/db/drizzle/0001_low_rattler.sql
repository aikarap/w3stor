ALTER TABLE "file_sp_status" ADD COLUMN "tx_hash" text;--> statement-breakpoint
ALTER TABLE "user_files" ADD COLUMN "payment_tx_hash" text;--> statement-breakpoint
ALTER TABLE "user_files" ADD COLUMN "payment_network" text;