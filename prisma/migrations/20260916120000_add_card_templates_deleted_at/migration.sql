-- Templates with marketplace purchases are hidden instead of hard-deleted,
-- so buyers' cloned templates and the download gateway keep working.
ALTER TABLE "card_templates" ADD COLUMN "deleted_at" TIMESTAMP(3);
