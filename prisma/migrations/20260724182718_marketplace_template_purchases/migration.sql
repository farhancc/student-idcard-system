-- CreateTable
CREATE TABLE "template_purchases" (
    "id" SERIAL NOT NULL,
    "buyer_press_id" INTEGER NOT NULL,
    "template_id" INTEGER NOT NULL,
    "template_name" TEXT NOT NULL,
    "seller_press_id" INTEGER,
    "credits_spent" INTEGER NOT NULL,
    "cloned_template_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "template_purchases_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "template_purchases_buyer_press_id_idx" ON "template_purchases"("buyer_press_id");

-- CreateIndex
CREATE INDEX "template_purchases_template_id_idx" ON "template_purchases"("template_id");

-- AddForeignKey
ALTER TABLE "template_purchases" ADD CONSTRAINT "template_purchases_buyer_press_id_fkey" FOREIGN KEY ("buyer_press_id") REFERENCES "press"("id") ON DELETE CASCADE ON UPDATE CASCADE;
