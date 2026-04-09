-- CreateTable: variant_ingredients for multi-seed mixing support
CREATE TABLE "variant_ingredients" (
    "id"           TEXT NOT NULL,
    "variantId"    TEXT NOT NULL,
    "grainTypeId"  TEXT NOT NULL,
    "ratioPercent" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "variant_ingredients_pkey" PRIMARY KEY ("id")
);

-- Migrate existing single-grain variants → single ingredient at 100%
INSERT INTO "variant_ingredients" ("id", "variantId", "grainTypeId", "ratioPercent")
SELECT gen_random_uuid(), "id", "grainTypeId", 100.0
FROM "zipper_variants"
WHERE "grainTypeId" IS NOT NULL;

-- Make grainTypeId optional on zipper_variants
ALTER TABLE "zipper_variants" ALTER COLUMN "grainTypeId" DROP NOT NULL;

-- Indexes and unique constraint
CREATE UNIQUE INDEX "variant_ingredients_variantId_grainTypeId_key"
    ON "variant_ingredients"("variantId", "grainTypeId");

CREATE INDEX "variant_ingredients_grainTypeId_idx"
    ON "variant_ingredients"("grainTypeId");

-- Foreign keys
ALTER TABLE "variant_ingredients"
    ADD CONSTRAINT "variant_ingredients_variantId_fkey"
    FOREIGN KEY ("variantId") REFERENCES "zipper_variants"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "variant_ingredients"
    ADD CONSTRAINT "variant_ingredients_grainTypeId_fkey"
    FOREIGN KEY ("grainTypeId") REFERENCES "grain_types"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
