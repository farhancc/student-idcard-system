-- ============================================================
-- Migration: add_order_cardholder_join_table
-- Replaces the cardholderIds JSON-string column on card_orders
-- with a proper normalized join table (order_cardholders).
--
-- Steps:
--   1. Create the new join table
--   2. Migrate existing JSON data into the table
--   3. Drop the legacy cardholder_ids column
-- ============================================================

-- ── 1. Create join table ─────────────────────────────────────────────────────

CREATE TABLE "order_cardholders" (
    "id"           SERIAL       NOT NULL,
    "order_id"     INTEGER      NOT NULL,
    "cardholder_id" INTEGER     NOT NULL,
    "added_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_cardholders_pkey" PRIMARY KEY ("id")
);

-- Unique pair: a cardholder can only appear once per order
CREATE UNIQUE INDEX "order_cardholders_order_id_cardholder_id_key"
    ON "order_cardholders"("order_id", "cardholder_id");

-- Fast reverse lookup: "which orders contain cardholder X?"
CREATE INDEX "order_cardholders_cardholder_id_idx"
    ON "order_cardholders"("cardholder_id");

ALTER TABLE "order_cardholders"
    ADD CONSTRAINT "order_cardholders_order_id_fkey"
    FOREIGN KEY ("order_id") REFERENCES "card_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "order_cardholders"
    ADD CONSTRAINT "order_cardholders_cardholder_id_fkey"
    FOREIGN KEY ("cardholder_id") REFERENCES "cardholders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── 2. Migrate existing data from JSON ──────────────────────────────────────
--
-- Parses the JSON array stored in cardholder_ids and inserts one row per ID.
-- Uses json_array_elements_text() which is safe for integer IDs.
-- ON CONFLICT DO NOTHING handles any accidental duplicates in source data.

INSERT INTO "order_cardholders" ("order_id", "cardholder_id", "added_at")
SELECT
    co.id                                    AS order_id,
    elem::integer                            AS cardholder_id,
    co.created_at                            AS added_at
FROM
    "card_orders" co,
    json_array_elements_text(
        CASE
            WHEN co.cardholder_ids IS NULL
              OR co.cardholder_ids = ''
              OR co.cardholder_ids = 'null'
            THEN '[]'::json
            ELSE co.cardholder_ids::json
        END
    ) AS elem
WHERE
    -- Only process rows that actually have IDs
    co.cardholder_ids IS NOT NULL
    AND co.cardholder_ids <> ''
    AND co.cardholder_ids <> '[]'
    AND co.cardholder_ids <> 'null'
    -- Only migrate IDs that still exist in the cardholders table
    AND EXISTS (
        SELECT 1 FROM "cardholders" c WHERE c.id = elem::integer
    )
ON CONFLICT DO NOTHING;

-- ── 3. Drop the legacy column ────────────────────────────────────────────────

ALTER TABLE "card_orders" DROP COLUMN "cardholder_ids";
