-- AlterTable
ALTER TABLE "card_templates" ADD COLUMN     "back_original_url" TEXT,
ADD COLUMN     "front_original_url" TEXT,
ALTER COLUMN "press_id" DROP NOT NULL,
ALTER COLUMN "card_width" SET DEFAULT 673,
ALTER COLUMN "card_height" SET DEFAULT 1039;

-- AlterTable
ALTER TABLE "client_portal_shares" ADD COLUMN     "show_preview" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "pdf_jobs" ADD COLUMN     "credits_used" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "rate_applied" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "revenue_generated" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "press_fonts" ALTER COLUMN "press_id" DROP NOT NULL;

-- CreateTable
CREATE TABLE "system_audit_logs" (
    "id" SERIAL NOT NULL,
    "press_id" INTEGER,
    "actor_id" INTEGER,
    "actor_type" TEXT NOT NULL,
    "actor_name" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "resource_type" TEXT,
    "resource_id" TEXT,
    "description" TEXT NOT NULL,
    "old_value" TEXT,
    "new_value" TEXT,
    "ip_address" TEXT NOT NULL,
    "user_agent" TEXT,
    "severity" TEXT NOT NULL DEFAULT 'INFO',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_settings" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_requests" (
    "id" SERIAL NOT NULL,
    "press_id" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reason" TEXT,
    "admin_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "credit_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "system_audit_logs_press_id_idx" ON "system_audit_logs"("press_id");

-- CreateIndex
CREATE INDEX "system_audit_logs_action_idx" ON "system_audit_logs"("action");

-- CreateIndex
CREATE INDEX "system_audit_logs_category_idx" ON "system_audit_logs"("category");

-- CreateIndex
CREATE INDEX "system_audit_logs_created_at_idx" ON "system_audit_logs"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "system_settings_key_key" ON "system_settings"("key");

-- CreateIndex
CREATE INDEX "credit_requests_press_id_idx" ON "credit_requests"("press_id");

-- CreateIndex
CREATE INDEX "credit_requests_status_idx" ON "credit_requests"("status");

-- AddForeignKey
ALTER TABLE "credit_requests" ADD CONSTRAINT "credit_requests_press_id_fkey" FOREIGN KEY ("press_id") REFERENCES "press"("id") ON DELETE CASCADE ON UPDATE CASCADE;
