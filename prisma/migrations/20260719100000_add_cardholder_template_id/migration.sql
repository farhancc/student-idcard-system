-- Add template_id to cardholders table for direct template assignment
ALTER TABLE "cardholders" ADD COLUMN IF NOT EXISTS "template_id" INTEGER;

-- Add foreign key only if it doesn't already exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'cardholders_template_id_fkey'
  ) THEN
    ALTER TABLE "cardholders" ADD CONSTRAINT "cardholders_template_id_fkey"
      FOREIGN KEY ("template_id") REFERENCES "card_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "cardholders_template_id_idx" ON "cardholders"("template_id");
