-- CreateTable
CREATE TABLE "template_fields" (
    "id" SERIAL NOT NULL,
    "template_id" INTEGER NOT NULL,
    "field" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "side" TEXT NOT NULL DEFAULT 'front',
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,
    "width" DOUBLE PRECISION NOT NULL,
    "height" DOUBLE PRECISION NOT NULL,
    "font_size" INTEGER,
    "font_weight" TEXT DEFAULT 'normal',
    "font_family" TEXT,
    "color" TEXT DEFAULT '#000000',
    "align" TEXT DEFAULT 'left',
    "vertical_align" TEXT DEFAULT 'top',
    "is_required" BOOLEAN NOT NULL DEFAULT false,
    "prefix" TEXT,
    "line_height" DOUBLE PRECISION DEFAULT 1.2,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "template_fields_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cardholder_values" (
    "id" SERIAL NOT NULL,
    "cardholder_id" INTEGER NOT NULL,
    "field" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cardholder_values_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "template_fields_template_id_idx" ON "template_fields"("template_id");

-- CreateIndex
CREATE UNIQUE INDEX "template_fields_template_id_field_side_key" ON "template_fields"("template_id", "field", "side");

-- CreateIndex
CREATE INDEX "cardholder_values_cardholder_id_idx" ON "cardholder_values"("cardholder_id");

-- CreateIndex
CREATE UNIQUE INDEX "cardholder_values_cardholder_id_field_key" ON "cardholder_values"("cardholder_id", "field");

-- AddForeignKey
ALTER TABLE "template_fields" ADD CONSTRAINT "template_fields_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "card_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cardholder_values" ADD CONSTRAINT "cardholder_values_cardholder_id_fkey" FOREIGN KEY ("cardholder_id") REFERENCES "cardholders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
