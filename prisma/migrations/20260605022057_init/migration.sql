-- CreateTable
CREATE TABLE "press" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "city" TEXT,
    "plan" TEXT NOT NULL DEFAULT 'BASIC',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "press_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "press_users" (
    "id" SERIAL NOT NULL,
    "press_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "press_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clients" (
    "id" SERIAL NOT NULL,
    "press_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "contact_name" TEXT,
    "contact_phone" TEXT,
    "contact_email" TEXT,
    "address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cardholders" (
    "id" SERIAL NOT NULL,
    "press_id" INTEGER NOT NULL,
    "client_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "designation" TEXT,
    "photo_url" TEXT,
    "custom_fields" TEXT,
    "unique_key" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cardholders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "card_templates" (
    "id" SERIAL NOT NULL,
    "press_id" INTEGER NOT NULL,
    "client_id" INTEGER,
    "name" TEXT NOT NULL,
    "card_width" INTEGER NOT NULL DEFAULT 1011,
    "card_height" INTEGER NOT NULL DEFAULT 638,
    "front_image_url" TEXT NOT NULL,
    "back_image_url" TEXT,
    "front_fields" TEXT NOT NULL,
    "back_fields" TEXT NOT NULL DEFAULT '[]',
    "version" INTEGER NOT NULL DEFAULT 1,
    "parent_id" INTEGER,
    "is_latest" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "card_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "card_orders" (
    "id" SERIAL NOT NULL,
    "press_id" INTEGER NOT NULL,
    "client_id" INTEGER NOT NULL,
    "template_id" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "cardholder_ids" TEXT NOT NULL,
    "valid_till" TIMESTAMP(3),
    "template_version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "card_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "card_assets" (
    "id" SERIAL NOT NULL,
    "cardholder_id" INTEGER NOT NULL,
    "press_id" INTEGER NOT NULL,
    "template_id" INTEGER NOT NULL,
    "front_url" TEXT NOT NULL,
    "back_url" TEXT NOT NULL,
    "template_hash" TEXT NOT NULL,
    "is_stale" BOOLEAN NOT NULL DEFAULT false,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "card_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pdf_jobs" (
    "id" SERIAL NOT NULL,
    "press_id" INTEGER NOT NULL,
    "order_id" INTEGER NOT NULL,
    "pdf_type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "file_name" TEXT NOT NULL,
    "download_url" TEXT,
    "generated_by" INTEGER NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "error_msg" TEXT,
    "metadata" TEXT,
    "url_expires_at" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "label" TEXT,
    "vendor_id" INTEGER,
    "sent_to_vendor_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "pdf_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_invoices" (
    "id" SERIAL NOT NULL,
    "order_id" INTEGER NOT NULL,
    "press_id" INTEGER NOT NULL,
    "price_per_card" DECIMAL(10,2) NOT NULL,
    "card_count" INTEGER NOT NULL,
    "subtotal" DECIMAL(10,2) NOT NULL,
    "tax_percent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "tax_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "total_amount" DECIMAL(10,2) NOT NULL,
    "payment_status" TEXT NOT NULL DEFAULT 'UNPAID',
    "payment_method" TEXT,
    "paid_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "paid_at" TIMESTAMP(3),
    "invoice_pdf_url" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "card_serial_counters" (
    "id" SERIAL NOT NULL,
    "press_id" INTEGER NOT NULL,
    "client_id" INTEGER NOT NULL,
    "prefix" TEXT NOT NULL,
    "last_seq" INTEGER NOT NULL DEFAULT 0,
    "pad_len" INTEGER NOT NULL DEFAULT 4,

    CONSTRAINT "card_serial_counters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "card_print_records" (
    "id" SERIAL NOT NULL,
    "cardholder_id" INTEGER NOT NULL,
    "press_id" INTEGER NOT NULL,
    "order_id" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "printed_at" TIMESTAMP(3),
    "delivered_at" TIMESTAMP(3),
    "remarks" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "card_print_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pdf_download_logs" (
    "id" SERIAL NOT NULL,
    "pdf_job_id" INTEGER NOT NULL,
    "press_id" INTEGER NOT NULL,
    "downloaded_by" INTEGER NOT NULL,
    "downloaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip_address" TEXT,

    CONSTRAINT "pdf_download_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_activity_logs" (
    "id" SERIAL NOT NULL,
    "order_id" INTEGER NOT NULL,
    "press_id" INTEGER NOT NULL,
    "actor_id" INTEGER NOT NULL,
    "actor_name" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "from_status" TEXT,
    "to_status" TEXT,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "press_fonts" (
    "id" SERIAL NOT NULL,
    "press_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "file_url" TEXT NOT NULL,
    "language" TEXT NOT NULL,

    CONSTRAINT "press_fonts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_notes" (
    "id" SERIAL NOT NULL,
    "order_id" INTEGER NOT NULL,
    "press_id" INTEGER NOT NULL,
    "author_id" INTEGER NOT NULL,
    "author_name" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_records" (
    "id" SERIAL NOT NULL,
    "order_id" INTEGER NOT NULL,
    "press_id" INTEGER NOT NULL,
    "delivered_to" TEXT NOT NULL,
    "delivered_at" TIMESTAMP(3) NOT NULL,
    "delivered_by" TEXT NOT NULL,
    "card_count" INTEGER NOT NULL,
    "remarks" TEXT,
    "signature_url" TEXT,

    CONSTRAINT "delivery_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "press_api_keys" (
    "id" SERIAL NOT NULL,
    "press_id" INTEGER NOT NULL,
    "key_hash" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "last_used" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "press_api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "print_vendors" (
    "id" SERIAL NOT NULL,
    "press_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "city" TEXT,
    "notes" TEXT,

    CONSTRAINT "print_vendors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "super_admins" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "super_admins_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "press_email_key" ON "press"("email");

-- CreateIndex
CREATE UNIQUE INDEX "press_users_email_key" ON "press_users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "cardholders_client_id_unique_key_key" ON "cardholders"("client_id", "unique_key");

-- CreateIndex
CREATE UNIQUE INDEX "card_assets_cardholder_id_key" ON "card_assets"("cardholder_id");

-- CreateIndex
CREATE UNIQUE INDEX "order_invoices_order_id_key" ON "order_invoices"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "card_serial_counters_press_id_client_id_prefix_key" ON "card_serial_counters"("press_id", "client_id", "prefix");

-- CreateIndex
CREATE UNIQUE INDEX "delivery_records_order_id_key" ON "delivery_records"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "press_api_keys_key_hash_key" ON "press_api_keys"("key_hash");

-- CreateIndex
CREATE UNIQUE INDEX "super_admins_email_key" ON "super_admins"("email");

-- AddForeignKey
ALTER TABLE "press_users" ADD CONSTRAINT "press_users_press_id_fkey" FOREIGN KEY ("press_id") REFERENCES "press"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_press_id_fkey" FOREIGN KEY ("press_id") REFERENCES "press"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cardholders" ADD CONSTRAINT "cardholders_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_templates" ADD CONSTRAINT "card_templates_press_id_fkey" FOREIGN KEY ("press_id") REFERENCES "press"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_orders" ADD CONSTRAINT "card_orders_press_id_fkey" FOREIGN KEY ("press_id") REFERENCES "press"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_orders" ADD CONSTRAINT "card_orders_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_orders" ADD CONSTRAINT "card_orders_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "card_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_assets" ADD CONSTRAINT "card_assets_cardholder_id_fkey" FOREIGN KEY ("cardholder_id") REFERENCES "cardholders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pdf_jobs" ADD CONSTRAINT "pdf_jobs_press_id_fkey" FOREIGN KEY ("press_id") REFERENCES "press"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pdf_jobs" ADD CONSTRAINT "pdf_jobs_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "card_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_invoices" ADD CONSTRAINT "order_invoices_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "card_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_invoices" ADD CONSTRAINT "order_invoices_press_id_fkey" FOREIGN KEY ("press_id") REFERENCES "press"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_serial_counters" ADD CONSTRAINT "card_serial_counters_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_print_records" ADD CONSTRAINT "card_print_records_cardholder_id_fkey" FOREIGN KEY ("cardholder_id") REFERENCES "cardholders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_print_records" ADD CONSTRAINT "card_print_records_press_id_fkey" FOREIGN KEY ("press_id") REFERENCES "press"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_print_records" ADD CONSTRAINT "card_print_records_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "card_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pdf_download_logs" ADD CONSTRAINT "pdf_download_logs_pdf_job_id_fkey" FOREIGN KEY ("pdf_job_id") REFERENCES "pdf_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pdf_download_logs" ADD CONSTRAINT "pdf_download_logs_press_id_fkey" FOREIGN KEY ("press_id") REFERENCES "press"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_activity_logs" ADD CONSTRAINT "order_activity_logs_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "card_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_activity_logs" ADD CONSTRAINT "order_activity_logs_press_id_fkey" FOREIGN KEY ("press_id") REFERENCES "press"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "press_fonts" ADD CONSTRAINT "press_fonts_press_id_fkey" FOREIGN KEY ("press_id") REFERENCES "press"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_notes" ADD CONSTRAINT "order_notes_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "card_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_records" ADD CONSTRAINT "delivery_records_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "card_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "press_api_keys" ADD CONSTRAINT "press_api_keys_press_id_fkey" FOREIGN KEY ("press_id") REFERENCES "press"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "print_vendors" ADD CONSTRAINT "print_vendors_press_id_fkey" FOREIGN KEY ("press_id") REFERENCES "press"("id") ON DELETE CASCADE ON UPDATE CASCADE;
