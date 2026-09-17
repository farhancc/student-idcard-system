-- DropIndex
DROP INDEX "template_purchases_buyer_press_id_idx";

-- CreateIndex
CREATE UNIQUE INDEX "template_purchases_buyer_press_id_template_id_key" ON "template_purchases"("buyer_press_id", "template_id");
