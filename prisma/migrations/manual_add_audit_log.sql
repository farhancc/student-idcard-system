-- Migration: add system_audit_logs table
-- Run this manually against your database if prisma migrate dev cannot connect.

CREATE TABLE IF NOT EXISTS "system_audit_logs" (
  "id"            SERIAL PRIMARY KEY,
  "press_id"      INTEGER,
  "actor_id"      INTEGER,
  "actor_type"    TEXT NOT NULL,
  "actor_name"    TEXT NOT NULL,
  "action"        TEXT NOT NULL,
  "category"      TEXT NOT NULL,
  "resource_type" TEXT,
  "resource_id"   TEXT,
  "description"   TEXT NOT NULL,
  "old_value"     TEXT,
  "new_value"     TEXT,
  "ip_address"    TEXT NOT NULL,
  "user_agent"    TEXT,
  "severity"      TEXT NOT NULL DEFAULT 'INFO',
  "created_at"    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "system_audit_logs_press_id_idx"  ON "system_audit_logs" ("press_id");
CREATE INDEX IF NOT EXISTS "system_audit_logs_action_idx"    ON "system_audit_logs" ("action");
CREATE INDEX IF NOT EXISTS "system_audit_logs_category_idx"  ON "system_audit_logs" ("category");
CREATE INDEX IF NOT EXISTS "system_audit_logs_created_at_idx" ON "system_audit_logs" ("created_at");
