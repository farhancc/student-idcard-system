-- Credit reservation for a Batch Import compile (lock -> capture-or-refund),
-- independent of CardOrder/PdfJob since batch imports are never persisted
-- server-side.
CREATE TABLE "credit_holds" (
    "id" SERIAL NOT NULL,
    "press_id" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "settled_at" TIMESTAMP(3),

    CONSTRAINT "credit_holds_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "credit_holds_press_id_status_idx" ON "credit_holds"("press_id", "status");

ALTER TABLE "credit_holds" ADD CONSTRAINT "credit_holds_press_id_fkey"
  FOREIGN KEY ("press_id") REFERENCES "press"("id") ON DELETE CASCADE ON UPDATE CASCADE;
