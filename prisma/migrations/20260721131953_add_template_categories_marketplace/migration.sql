-- AlterTable
ALTER TABLE "card_templates" ADD COLUMN     "ai_file_url" TEXT,
ADD COLUMN     "category" TEXT NOT NULL DEFAULT 'OTHER',
ADD COLUMN     "cdr_file_url" TEXT,
ADD COLUMN     "is_moderated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "is_public" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "likes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "pdf_file_url" TEXT,
ADD COLUMN     "price" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "psd_file_url" TEXT,
ADD COLUMN     "reports" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "sides" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "press" ADD COLUMN     "promo_credits" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "template_client_assignments" (
    "id" SERIAL NOT NULL,
    "template_id" INTEGER NOT NULL,
    "client_id" INTEGER NOT NULL,

    CONSTRAINT "template_client_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "template_client_assignments_template_id_client_id_key" ON "template_client_assignments"("template_id", "client_id");

-- AddForeignKey
ALTER TABLE "template_client_assignments" ADD CONSTRAINT "template_client_assignments_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "card_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_client_assignments" ADD CONSTRAINT "template_client_assignments_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
