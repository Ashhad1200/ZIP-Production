-- CreateEnum
CREATE TYPE "ProductionStatus" AS ENUM ('IN_PRODUCTION', 'COMPLETED');

-- AlterTable
ALTER TABLE "production_entries" ADD COLUMN     "status" "ProductionStatus" NOT NULL DEFAULT 'IN_PRODUCTION',
ALTER COLUMN "metersProduced" DROP NOT NULL,
ALTER COLUMN "gramsPerMeter" DROP NOT NULL,
ALTER COLUMN "electricityUnitsConsumed" DROP NOT NULL,
ALTER COLUMN "scrapWeightGrams" DROP NOT NULL,
ALTER COLUMN "scrapWeightGrams" DROP DEFAULT;
