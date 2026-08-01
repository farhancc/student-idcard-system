-- Add missing versioning columns to card_templates that were present in the
-- init migration but never applied to production databases via a delta migration.

-- Add parent_id (nullable FK to itself, for version history chain)
ALTER TABLE "card_templates" ADD COLUMN IF NOT EXISTS "parent_id" INTEGER;

-- Add is_latest flag (defaults true so all existing rows remain visible)
ALTER TABLE "card_templates" ADD COLUMN IF NOT EXISTS "is_latest" BOOLEAN NOT NULL DEFAULT true;

-- Ensure all currently published templates are marked as latest
-- (safe no-op if column already existed with correct values)
UPDATE "card_templates" SET "is_latest" = true WHERE "is_latest" IS NULL;
