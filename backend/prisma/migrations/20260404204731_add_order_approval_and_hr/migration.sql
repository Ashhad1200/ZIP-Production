-- AlterEnum
ALTER TYPE "OrderStatus" ADD VALUE 'PENDING_APPROVAL';

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'HR_HEAD';

-- CreateTable
CREATE TABLE "worker_salary_rates" (
    "id" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "monthlySalaryPaisa" BIGINT NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "worker_salary_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "worker_advances" (
    "id" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "amountPaisa" BIGINT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "isRecovered" BOOLEAN NOT NULL DEFAULT false,
    "recoveredAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "worker_advances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_records" (
    "id" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "workerId" TEXT NOT NULL,
    "grossSalaryPaisa" BIGINT NOT NULL,
    "advanceDeductionPaisa" BIGINT NOT NULL DEFAULT 0,
    "deductionsPaisa" BIGINT NOT NULL DEFAULT 0,
    "netSalaryPaisa" BIGINT NOT NULL,
    "paymentMode" "PaymentMode" NOT NULL DEFAULT 'CASH',
    "chequeNumber" TEXT,
    "journalEntryId" TEXT,
    "notes" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payroll_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "worker_salary_rates_workerId_idx" ON "worker_salary_rates"("workerId");

-- CreateIndex
CREATE INDEX "worker_advances_workerId_idx" ON "worker_advances"("workerId");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_records_journalEntryId_key" ON "payroll_records"("journalEntryId");

-- CreateIndex
CREATE INDEX "payroll_records_year_month_idx" ON "payroll_records"("year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_records_workerId_month_year_key" ON "payroll_records"("workerId", "month", "year");

-- AddForeignKey
ALTER TABLE "worker_salary_rates" ADD CONSTRAINT "worker_salary_rates_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "workers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "worker_advances" ADD CONSTRAINT "worker_advances_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "workers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_records" ADD CONSTRAINT "payroll_records_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "workers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_records" ADD CONSTRAINT "payroll_records_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "journal_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
