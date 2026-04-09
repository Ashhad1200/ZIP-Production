-- CreateTable: order_line_items
CREATE TABLE "order_line_items" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "variant_id" TEXT NOT NULL,
    "meters_ordered" INTEGER NOT NULL,
    "meters_delivered" INTEGER NOT NULL DEFAULT 0,
    "rate_per_meter_paisa" BIGINT NOT NULL,
    CONSTRAINT "order_line_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "order_line_items_order_id_idx" ON "order_line_items"("order_id");
CREATE INDEX "order_line_items_variant_id_idx" ON "order_line_items"("variant_id");

-- AddForeignKey
ALTER TABLE "order_line_items" ADD CONSTRAINT "order_line_items_order_id_fkey"
    FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "order_line_items" ADD CONSTRAINT "order_line_items_variant_id_fkey"
    FOREIGN KEY ("variant_id") REFERENCES "zipper_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Migrate existing single-variant orders to line items (data migration)
INSERT INTO "order_line_items" ("id", "order_id", "variant_id", "meters_ordered", "meters_delivered", "rate_per_meter_paisa")
SELECT gen_random_uuid(), "id", "variant_id", "meters_ordered", "meters_delivered", "rate_per_meter_paisa"
FROM "orders"
WHERE "variant_id" IS NOT NULL;

-- DropForeignKey on orders.variant_id
ALTER TABLE "orders" DROP CONSTRAINT IF EXISTS "orders_variant_id_fkey";

-- DropIndex
DROP INDEX IF EXISTS "orders_variant_id_idx";

-- AlterTable: remove single-variant columns from orders
ALTER TABLE "orders" DROP COLUMN IF EXISTS "variant_id";
ALTER TABLE "orders" DROP COLUMN IF EXISTS "rate_per_meter_paisa";
