-- Add soft-delete columns
ALTER TABLE "clients" ADD COLUMN "deleted_at" TIMESTAMP(3);
ALTER TABLE "cardholders" ADD COLUMN "deleted_at" TIMESTAMP(3);
ALTER TABLE "card_orders" ADD COLUMN "deleted_at" TIMESTAMP(3);

-- Change cascade deletes to restrict on financial & audit records.
-- This prevents destroying invoices, delivery records, audit logs,
-- and historical order membership when orders or cardholders are deleted.

-- OrderInvoice: prevent deleting an order that has an invoice
ALTER TABLE "order_invoices" DROP CONSTRAINT IF EXISTS "order_invoices_order_id_fkey";
ALTER TABLE "order_invoices" ADD CONSTRAINT "order_invoices_order_id_fkey"
  FOREIGN KEY ("order_id") REFERENCES "card_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- DeliveryRecord: prevent deleting an order that has a delivery record
ALTER TABLE "delivery_records" DROP CONSTRAINT IF EXISTS "delivery_records_order_id_fkey";
ALTER TABLE "delivery_records" ADD CONSTRAINT "delivery_records_order_id_fkey"
  FOREIGN KEY ("order_id") REFERENCES "card_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- OrderActivityLog: prevent deleting an order that has audit logs
ALTER TABLE "order_activity_logs" DROP CONSTRAINT IF EXISTS "order_activity_logs_order_id_fkey";
ALTER TABLE "order_activity_logs" ADD CONSTRAINT "order_activity_logs_order_id_fkey"
  FOREIGN KEY ("order_id") REFERENCES "card_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- OrderCardholder: prevent deleting a cardholder that appears in historical orders
ALTER TABLE "order_cardholders" DROP CONSTRAINT IF EXISTS "order_cardholders_cardholder_id_fkey";
ALTER TABLE "order_cardholders" ADD CONSTRAINT "order_cardholders_cardholder_id_fkey"
  FOREIGN KEY ("cardholder_id") REFERENCES "cardholders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
