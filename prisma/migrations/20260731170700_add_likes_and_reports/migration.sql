-- CreateTable
CREATE TABLE "template_likes" (
    "id" SERIAL NOT NULL,
    "press_id" INTEGER NOT NULL,
    "template_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "template_likes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "template_reports" (
    "id" SERIAL NOT NULL,
    "press_id" INTEGER NOT NULL,
    "template_id" INTEGER NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "template_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "template_likes_press_id_template_id_key" ON "template_likes"("press_id", "template_id");

-- CreateIndex
CREATE UNIQUE INDEX "template_reports_press_id_template_id_key" ON "template_reports"("press_id", "template_id");

-- AddForeignKey
ALTER TABLE "template_likes" ADD CONSTRAINT "template_likes_press_id_fkey" FOREIGN KEY ("press_id") REFERENCES "press"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_likes" ADD CONSTRAINT "template_likes_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "card_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_reports" ADD CONSTRAINT "template_reports_press_id_fkey" FOREIGN KEY ("press_id") REFERENCES "press"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_reports" ADD CONSTRAINT "template_reports_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "card_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
