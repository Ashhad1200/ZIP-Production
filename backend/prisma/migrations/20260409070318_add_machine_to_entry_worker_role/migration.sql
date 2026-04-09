-- CreateEnum
CREATE TYPE "WorkerRole" AS ENUM ('HEAD_OPERATOR', 'ASSISTANT');

-- AlterTable
ALTER TABLE "production_entries" ADD COLUMN     "machineId" TEXT;

-- AlterTable
ALTER TABLE "production_entry_workers" ADD COLUMN     "role" "WorkerRole";

-- AddForeignKey
ALTER TABLE "production_entries" ADD CONSTRAINT "production_entries_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "machines"("id") ON DELETE SET NULL ON UPDATE CASCADE;
