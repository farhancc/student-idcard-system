-- Add missing indexes for production performance
-- All indexes use CONCURRENTLY to avoid table locks on live databases

-- Client: dashboard listing + soft-delete filter
CREATE INDEX CONCURRENTLY IF NOT EXISTS "clients_press_id_idx" ON "clients" ("press_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "clients_deleted_at_idx" ON "clients" ("deleted_at");

-- Cardholder: client detail page + soft-delete filter
CREATE INDEX CONCURRENTLY IF NOT EXISTS "cardholders_client_id_idx" ON "cardholders" ("client_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "cardholders_deleted_at_idx" ON "cardholders" ("deleted_at");

-- CardTemplate: template listing + marketplace browse
CREATE INDEX CONCURRENTLY IF NOT EXISTS "card_templates_press_id_idx" ON "card_templates" ("press_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "card_templates_is_public_is_latest_idx" ON "card_templates" ("is_public", "is_latest");

-- CardOrder: status filter + soft-delete + default sort
CREATE INDEX CONCURRENTLY IF NOT EXISTS "card_orders_status_idx" ON "card_orders" ("status");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "card_orders_deleted_at_idx" ON "card_orders" ("deleted_at");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "card_orders_created_at_idx" ON "card_orders" ("created_at");

-- CardAsset: template-scoped asset lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS "card_assets_press_id_template_id_idx" ON "card_assets" ("press_id", "template_id");

-- PdfJob: order detail + cleanup cron
CREATE INDEX CONCURRENTLY IF NOT EXISTS "pdf_jobs_order_id_idx" ON "pdf_jobs" ("order_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "pdf_jobs_expires_at_idx" ON "pdf_jobs" ("expires_at");

-- CardPrintRecord: print records per order + per cardholder
CREATE INDEX CONCURRENTLY IF NOT EXISTS "card_print_records_order_id_idx" ON "card_print_records" ("order_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "card_print_records_cardholder_id_idx" ON "card_print_records" ("cardholder_id");

-- PdfDownloadLog: download logs per job
CREATE INDEX CONCURRENTLY IF NOT EXISTS "pdf_download_logs_pdf_job_id_idx" ON "pdf_download_logs" ("pdf_job_id");

-- OrderActivityLog: audit trail per order
CREATE INDEX CONCURRENTLY IF NOT EXISTS "order_activity_logs_order_id_idx" ON "order_activity_logs" ("order_id");

-- OrderNote: notes per order
CREATE INDEX CONCURRENTLY IF NOT EXISTS "order_notes_order_id_idx" ON "order_notes" ("order_id");
