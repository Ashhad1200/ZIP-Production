-- AlterTable
ALTER TABLE "gate_passes" ADD COLUMN     "receiptPhotoUrl" TEXT;

-- AlterTable
ALTER TABLE "workers" ADD COLUMN     "shiftCostPaisa" BIGINT;

-- CreateTable
CREATE TABLE "raw_material_batches" (
    "id" TEXT NOT NULL,
    "grainTypeId" TEXT NOT NULL,
    "purchaseId" TEXT NOT NULL,
    "bagsTotal" DECIMAL(65,30) NOT NULL,
    "bagsRemaining" DECIMAL(65,30) NOT NULL,
    "pricePerBagPaisa" BIGINT NOT NULL,
    "purchaseDate" DATE NOT NULL,
    "source" "PurchaseSource" NOT NULL,
    "isExhausted" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "raw_material_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_batch_consumptions" (
    "id" TEXT NOT NULL,
    "productionEntryId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "bagsConsumed" DECIMAL(65,30) NOT NULL,
    "totalCostPaisa" BIGINT NOT NULL,

    CONSTRAINT "production_batch_consumptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "electricity_rates" (
    "id" TEXT NOT NULL,
    "ratePaisaPerUnit" BIGINT NOT NULL,
    "effectiveFrom" DATE NOT NULL,
    "effectiveTo" DATE,
    "notes" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "electricity_rates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "raw_material_batches_purchaseId_key" ON "raw_material_batches"("purchaseId");

-- CreateIndex
CREATE INDEX "raw_material_batches_grainTypeId_idx" ON "raw_material_batches"("grainTypeId");

-- CreateIndex
CREATE INDEX "raw_material_batches_grainTypeId_isExhausted_idx" ON "raw_material_batches"("grainTypeId", "isExhausted");

-- CreateIndex
CREATE INDEX "raw_material_batches_purchaseDate_idx" ON "raw_material_batches"("purchaseDate");

-- CreateIndex
CREATE INDEX "production_batch_consumptions_productionEntryId_idx" ON "production_batch_consumptions"("productionEntryId");

-- CreateIndex
CREATE INDEX "production_batch_consumptions_batchId_idx" ON "production_batch_consumptions"("batchId");

-- CreateIndex
CREATE INDEX "electricity_rates_effectiveFrom_idx" ON "electricity_rates"("effectiveFrom");

-- AddForeignKey
ALTER TABLE "raw_material_batches" ADD CONSTRAINT "raw_material_batches_grainTypeId_fkey" FOREIGN KEY ("grainTypeId") REFERENCES "grain_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "raw_material_batches" ADD CONSTRAINT "raw_material_batches_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "raw_material_purchases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_batch_consumptions" ADD CONSTRAINT "production_batch_consumptions_productionEntryId_fkey" FOREIGN KEY ("productionEntryId") REFERENCES "production_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_batch_consumptions" ADD CONSTRAINT "production_batch_consumptions_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "raw_material_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
