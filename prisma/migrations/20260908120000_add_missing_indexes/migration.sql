-- Add missing indexes for production performance
--
-- Originally used CREATE INDEX CONCURRENTLY to avoid locking tables on a
-- live database, but `prisma migrate deploy` always runs a migration inside
-- a transaction, and Postgres rejects CONCURRENTLY inside one (error 25001:
-- "CREATE INDEX CONCURRENTLY cannot run inside a transaction block") — this
-- migration could never actually succeed through the normal deploy path.
-- Plain CREATE INDEX briefly locks the table, which is fine for the size of
-- data these tables hold today.

-- Client: dashboard listing + soft-delete filter
CREATE INDEX IF NOT EXISTS "clients_press_id_idx" ON "clients" ("press_id");
CREATE INDEX IF NOT EXISTS "clients_deleted_at_idx" ON "clients" ("deleted_at");

-- Cardholder: client detail page + soft-delete filter
CREATE INDEX IF NOT EXISTS "cardholders_client_id_idx" ON "cardholders" ("client_id");
CREATE INDEX IF NOT EXISTS "cardholders_deleted_at_idx" ON "cardholders" ("deleted_at");

-- CardTemplate: template listing + marketplace browse
CREATE INDEX IF NOT EXISTS "card_templates_press_id_idx" ON "card_templates" ("press_id");
CREATE INDEX IF NOT EXISTS "card_templates_is_public_is_latest_idx" ON "card_templates" ("is_public", "is_latest");

-- CardOrder: status filter + soft-delete + default sort
CREATE INDEX IF NOT EXISTS "card_orders_status_idx" ON "card_orders" ("status");
CREATE INDEX IF NOT EXISTS "card_orders_deleted_at_idx" ON "card_orders" ("deleted_at");
CREATE INDEX IF NOT EXISTS "card_orders_created_at_idx" ON "card_orders" ("created_at");

-- CardAsset: template-scoped asset lookups
CREATE INDEX IF NOT EXISTS "card_assets_press_id_template_id_idx" ON "card_assets" ("press_id", "template_id");

-- PdfJob: order detail + cleanup cron
CREATE INDEX IF NOT EXISTS "pdf_jobs_order_id_idx" ON "pdf_jobs" ("order_id");
CREATE INDEX IF NOT EXISTS "pdf_jobs_expires_at_idx" ON "pdf_jobs" ("expires_at");

-- CardPrintRecord: print records per order + per cardholder
CREATE INDEX IF NOT EXISTS "card_print_records_order_id_idx" ON "card_print_records" ("order_id");
CREATE INDEX IF NOT EXISTS "card_print_records_cardholder_id_idx" ON "card_print_records" ("cardholder_id");

-- PdfDownloadLog: download logs per job
CREATE INDEX IF NOT EXISTS "pdf_download_logs_pdf_job_id_idx" ON "pdf_download_logs" ("pdf_job_id");

-- OrderActivityLog: audit trail per order
CREATE INDEX IF NOT EXISTS "order_activity_logs_order_id_idx" ON "order_activity_logs" ("order_id");

-- OrderNote: notes per order
CREATE INDEX IF NOT EXISTS "order_notes_order_id_idx" ON "order_notes" ("order_id");
