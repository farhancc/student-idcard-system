-- Reconciles the migration history with schema.prisma, which had drifted:
-- `PressUser.lastLoginAt` and the cardholder_values (field, value) index
-- existed in local dev (added via `prisma db push` at some point) but were
-- never captured in a migration, so any environment built purely from the
-- migrations directory — including production — was missing them. That's
-- what broke every login/signup: the very first query on PressUser selects
-- last_login_at, which didn't exist in the production table.

-- AlterTable
ALTER TABLE "press_users" ADD COLUMN IF NOT EXISTS "last_login_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "cardholder_values_field_value_idx" ON "cardholder_values"("field", "value");
