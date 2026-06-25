-- AlterTable
ALTER TABLE "cardholders" ADD COLUMN     "enroll_token" TEXT;

-- AlterTable
ALTER TABLE "pdf_jobs" ADD COLUMN     "credits_locked" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "is_local_job" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "press" ADD COLUMN     "credits" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "client_portal_shares" (
    "id" SERIAL NOT NULL,
    "press_id" INTEGER NOT NULL,
    "client_id" INTEGER NOT NULL,
    "template_id" INTEGER NOT NULL,
    "org_token" TEXT NOT NULL,
    "enroll_token" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_portal_shares_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_departments" (
    "id" SERIAL NOT NULL,
    "portal_share_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "dept_token" TEXT NOT NULL,
    "enroll_token" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_departments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "client_portal_shares_org_token_key" ON "client_portal_shares"("org_token");

-- CreateIndex
CREATE UNIQUE INDEX "client_portal_shares_enroll_token_key" ON "client_portal_shares"("enroll_token");

-- CreateIndex
CREATE UNIQUE INDEX "client_departments_dept_token_key" ON "client_departments"("dept_token");

-- CreateIndex
CREATE UNIQUE INDEX "client_departments_enroll_token_key" ON "client_departments"("enroll_token");

-- CreateIndex
CREATE INDEX "card_orders_press_id_client_id_idx" ON "card_orders"("press_id", "client_id");

-- CreateIndex
CREATE INDEX "cardholders_press_id_idx" ON "cardholders"("press_id");

-- CreateIndex
CREATE INDEX "cardholders_enroll_token_idx" ON "cardholders"("enroll_token");

-- CreateIndex
CREATE INDEX "pdf_jobs_press_id_status_idx" ON "pdf_jobs"("press_id", "status");

-- CreateIndex
CREATE INDEX "pdf_jobs_is_local_job_idx" ON "pdf_jobs"("is_local_job");

-- AddForeignKey
ALTER TABLE "client_departments" ADD CONSTRAINT "client_departments_portal_share_id_fkey" FOREIGN KEY ("portal_share_id") REFERENCES "client_portal_shares"("id") ON DELETE CASCADE ON UPDATE CASCADE;
