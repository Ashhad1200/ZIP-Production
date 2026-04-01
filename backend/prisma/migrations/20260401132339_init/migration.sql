-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'FINANCE_HEAD', 'PRODUCTION_HEAD', 'LOGISTICS_HEAD', 'MARKETING_HEAD');

-- CreateEnum
CREATE TYPE "Shift" AS ENUM ('DAY', 'NIGHT');

-- CreateEnum
CREATE TYPE "GatePassStatus" AS ENUM ('CREATED', 'DISPATCHED', 'RECEIVED');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'ONGOING', 'COMPLETED');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('AUTO_APPROVED', 'PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "PaymentMode" AS ENUM ('CASH', 'CHEQUE', 'BANK_TRANSFER');

-- CreateEnum
CREATE TYPE "PurchaseSource" AS ENUM ('CONTAINER', 'SPOT_MARKET');

-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE');

-- CreateEnum
CREATE TYPE "JournalEntryStatus" AS ENUM ('DRAFT', 'POSTED', 'REVERSED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('ORDER_CREATED', 'VOUCHER_APPROVAL', 'LOW_STOCK', 'GATE_PASS_RECEIVED', 'ELECTRICITY_DISCREPANCY');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'SOFT_DELETE');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plants" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "plants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "machines" (
    "id" TEXT NOT NULL,
    "plantId" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "kwhRating" DECIMAL(65,30) NOT NULL,
    "expectedOutputPerShift" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "machines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "designation" TEXT,
    "plantId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "workers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "zipper_variants" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "standardGramsPerMeter" DECIMAL(65,30) NOT NULL,
    "grainTypeId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "zipper_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grain_types" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "bagWeightGrams" INTEGER NOT NULL DEFAULT 25000,
    "lowStockThresholdBags" DECIMAL(65,30),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "grain_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_entries" (
    "id" TEXT NOT NULL,
    "plantId" TEXT NOT NULL,
    "shift" "Shift" NOT NULL,
    "date" DATE NOT NULL,
    "variantId" TEXT NOT NULL,
    "metersProduced" INTEGER NOT NULL,
    "gramsPerMeter" DECIMAL(65,30) NOT NULL,
    "electricityUnitsConsumed" DECIMAL(65,30) NOT NULL,
    "electricityStartReading" DECIMAL(65,30),
    "electricityEndReading" DECIMAL(65,30),
    "hasElectricityDiscrepancy" BOOLEAN NOT NULL DEFAULT false,
    "electricityDiscrepancyNotes" TEXT,
    "scrapWeightGrams" INTEGER NOT NULL DEFAULT 0,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "production_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_entry_workers" (
    "productionEntryId" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,

    CONSTRAINT "production_entry_workers_pkey" PRIMARY KEY ("productionEntryId","workerId")
);

-- CreateTable
CREATE TABLE "scrap_sales" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "totalWeightKg" DECIMAL(65,30) NOT NULL,
    "ratePerKgPaisa" BIGINT NOT NULL,
    "totalAmountPaisa" BIGINT NOT NULL,
    "buyerName" TEXT,
    "plantId" TEXT,
    "journalEntryId" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "scrap_sales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "raw_material_purchases" (
    "id" TEXT NOT NULL,
    "grainTypeId" TEXT NOT NULL,
    "numberOfBags" DECIMAL(65,30) NOT NULL,
    "ratePerBagPaisa" BIGINT NOT NULL,
    "totalAmountPaisa" BIGINT NOT NULL,
    "purchaseDate" DATE NOT NULL,
    "source" "PurchaseSource" NOT NULL,
    "journalEntryId" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "raw_material_purchases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "raw_material_stock" (
    "id" TEXT NOT NULL,
    "grainTypeId" TEXT NOT NULL,
    "currentBags" DECIMAL(65,30) NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "raw_material_stock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finished_goods_stock" (
    "id" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "currentMeters" INTEGER NOT NULL,
    "lowStockThreshold" INTEGER,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "finished_goods_stock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clients" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactPerson" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "paymentCycleDays" INTEGER NOT NULL DEFAULT 30,
    "accountId" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_rates" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "ratePerMeterPaisa" BIGINT NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "client_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gate_passes" (
    "id" TEXT NOT NULL,
    "gatePassNumber" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "issuingManagerName" TEXT NOT NULL,
    "shift" "Shift" NOT NULL,
    "status" "GatePassStatus" NOT NULL DEFAULT 'CREATED',
    "orderId" TEXT,
    "verifyToken" TEXT NOT NULL,
    "verifyTokenExpiresAt" TIMESTAMP(3) NOT NULL,
    "receivedAt" TIMESTAMP(3),
    "receivedBy" TEXT,
    "totalAmountPaisa" BIGINT NOT NULL,
    "paymentDueDate" DATE NOT NULL,
    "journalEntryId" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "gate_passes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gate_pass_line_items" (
    "id" TEXT NOT NULL,
    "gatePassId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "meters" INTEGER NOT NULL,
    "ratePerMeterPaisa" BIGINT NOT NULL,
    "lineAmountPaisa" BIGINT NOT NULL,

    CONSTRAINT "gate_pass_line_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "metersOrdered" INTEGER NOT NULL,
    "ratePerMeterPaisa" BIGINT NOT NULL,
    "totalAmountPaisa" BIGINT NOT NULL,
    "deliveryDeadline" DATE NOT NULL,
    "metersDelivered" INTEGER NOT NULL DEFAULT 0,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "accountType" "AccountType" NOT NULL,
    "parentId" TEXT,
    "isGroup" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_entries" (
    "id" TEXT NOT NULL,
    "entryNumber" TEXT NOT NULL,
    "entryDate" DATE NOT NULL,
    "description" TEXT,
    "status" "JournalEntryStatus" NOT NULL DEFAULT 'DRAFT',
    "referenceType" TEXT,
    "referenceId" TEXT,
    "postedAt" TIMESTAMP(3),
    "postedBy" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "journal_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_entry_lines" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "clientId" TEXT,
    "description" TEXT,
    "debitAmountPaisa" BIGINT NOT NULL DEFAULT 0,
    "creditAmountPaisa" BIGINT NOT NULL DEFAULT 0,
    "lineOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "journal_entry_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vouchers" (
    "id" TEXT NOT NULL,
    "voucherNumber" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "date" DATE NOT NULL,
    "amountPaisa" BIGINT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "paymentMode" "PaymentMode" NOT NULL,
    "chequeNumber" TEXT,
    "companyId" TEXT NOT NULL,
    "approvalStatus" "ApprovalStatus" NOT NULL,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "journalEntryId" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "vouchers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expense_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parentId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "expense_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "companies" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "taxStructure" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "recipientUserId" TEXT,
    "recipientRole" "Role",
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "referenceType" TEXT,
    "referenceId" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" "AuditAction" NOT NULL,
    "previousValue" JSONB,
    "newValue" JSONB NOT NULL,
    "changedFields" TEXT[],
    "userId" TEXT NOT NULL,
    "reason" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_settings" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_name_key" ON "users"("name");

-- CreateIndex
CREATE UNIQUE INDEX "plants_name_key" ON "plants"("name");

-- CreateIndex
CREATE INDEX "plants_isDeleted_idx" ON "plants"("isDeleted");

-- CreateIndex
CREATE INDEX "machines_plantId_idx" ON "machines"("plantId");

-- CreateIndex
CREATE INDEX "machines_isDeleted_idx" ON "machines"("isDeleted");

-- CreateIndex
CREATE INDEX "workers_plantId_idx" ON "workers"("plantId");

-- CreateIndex
CREATE INDEX "workers_isDeleted_idx" ON "workers"("isDeleted");

-- CreateIndex
CREATE UNIQUE INDEX "zipper_variants_code_key" ON "zipper_variants"("code");

-- CreateIndex
CREATE INDEX "zipper_variants_grainTypeId_idx" ON "zipper_variants"("grainTypeId");

-- CreateIndex
CREATE INDEX "zipper_variants_isDeleted_idx" ON "zipper_variants"("isDeleted");

-- CreateIndex
CREATE UNIQUE INDEX "grain_types_code_key" ON "grain_types"("code");

-- CreateIndex
CREATE INDEX "grain_types_isDeleted_idx" ON "grain_types"("isDeleted");

-- CreateIndex
CREATE INDEX "production_entries_variantId_idx" ON "production_entries"("variantId");

-- CreateIndex
CREATE INDEX "production_entries_date_idx" ON "production_entries"("date");

-- CreateIndex
CREATE INDEX "production_entries_plantId_date_idx" ON "production_entries"("plantId", "date");

-- CreateIndex
CREATE INDEX "production_entries_isDeleted_idx" ON "production_entries"("isDeleted");

-- CreateIndex
CREATE UNIQUE INDEX "production_entries_plantId_shift_date_key" ON "production_entries"("plantId", "shift", "date");

-- CreateIndex
CREATE INDEX "production_entry_workers_workerId_idx" ON "production_entry_workers"("workerId");

-- CreateIndex
CREATE UNIQUE INDEX "scrap_sales_journalEntryId_key" ON "scrap_sales"("journalEntryId");

-- CreateIndex
CREATE INDEX "scrap_sales_plantId_idx" ON "scrap_sales"("plantId");

-- CreateIndex
CREATE INDEX "scrap_sales_date_idx" ON "scrap_sales"("date");

-- CreateIndex
CREATE INDEX "scrap_sales_isDeleted_idx" ON "scrap_sales"("isDeleted");

-- CreateIndex
CREATE UNIQUE INDEX "raw_material_purchases_journalEntryId_key" ON "raw_material_purchases"("journalEntryId");

-- CreateIndex
CREATE INDEX "raw_material_purchases_grainTypeId_idx" ON "raw_material_purchases"("grainTypeId");

-- CreateIndex
CREATE INDEX "raw_material_purchases_purchaseDate_idx" ON "raw_material_purchases"("purchaseDate");

-- CreateIndex
CREATE INDEX "raw_material_purchases_isDeleted_idx" ON "raw_material_purchases"("isDeleted");

-- CreateIndex
CREATE UNIQUE INDEX "raw_material_stock_grainTypeId_key" ON "raw_material_stock"("grainTypeId");

-- CreateIndex
CREATE INDEX "raw_material_stock_updatedAt_idx" ON "raw_material_stock"("updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "finished_goods_stock_variantId_key" ON "finished_goods_stock"("variantId");

-- CreateIndex
CREATE INDEX "finished_goods_stock_updatedAt_idx" ON "finished_goods_stock"("updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "clients_name_key" ON "clients"("name");

-- CreateIndex
CREATE UNIQUE INDEX "clients_accountId_key" ON "clients"("accountId");

-- CreateIndex
CREATE INDEX "clients_isDeleted_idx" ON "clients"("isDeleted");

-- CreateIndex
CREATE INDEX "client_rates_clientId_idx" ON "client_rates"("clientId");

-- CreateIndex
CREATE INDEX "client_rates_variantId_idx" ON "client_rates"("variantId");

-- CreateIndex
CREATE INDEX "client_rates_isDeleted_idx" ON "client_rates"("isDeleted");

-- CreateIndex
CREATE UNIQUE INDEX "gate_passes_gatePassNumber_key" ON "gate_passes"("gatePassNumber");

-- CreateIndex
CREATE UNIQUE INDEX "gate_passes_verifyToken_key" ON "gate_passes"("verifyToken");

-- CreateIndex
CREATE UNIQUE INDEX "gate_passes_journalEntryId_key" ON "gate_passes"("journalEntryId");

-- CreateIndex
CREATE INDEX "gate_passes_clientId_idx" ON "gate_passes"("clientId");

-- CreateIndex
CREATE INDEX "gate_passes_orderId_idx" ON "gate_passes"("orderId");

-- CreateIndex
CREATE INDEX "gate_passes_status_idx" ON "gate_passes"("status");

-- CreateIndex
CREATE INDEX "gate_passes_date_idx" ON "gate_passes"("date");

-- CreateIndex
CREATE INDEX "gate_passes_clientId_date_idx" ON "gate_passes"("clientId", "date");

-- CreateIndex
CREATE INDEX "gate_passes_isDeleted_idx" ON "gate_passes"("isDeleted");

-- CreateIndex
CREATE INDEX "gate_pass_line_items_gatePassId_idx" ON "gate_pass_line_items"("gatePassId");

-- CreateIndex
CREATE INDEX "gate_pass_line_items_variantId_idx" ON "gate_pass_line_items"("variantId");

-- CreateIndex
CREATE UNIQUE INDEX "orders_orderNumber_key" ON "orders"("orderNumber");

-- CreateIndex
CREATE INDEX "orders_clientId_idx" ON "orders"("clientId");

-- CreateIndex
CREATE INDEX "orders_variantId_idx" ON "orders"("variantId");

-- CreateIndex
CREATE INDEX "orders_status_idx" ON "orders"("status");

-- CreateIndex
CREATE INDEX "orders_clientId_status_idx" ON "orders"("clientId", "status");

-- CreateIndex
CREATE INDEX "orders_isDeleted_idx" ON "orders"("isDeleted");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_code_key" ON "accounts"("code");

-- CreateIndex
CREATE INDEX "accounts_parentId_idx" ON "accounts"("parentId");

-- CreateIndex
CREATE INDEX "accounts_accountType_idx" ON "accounts"("accountType");

-- CreateIndex
CREATE UNIQUE INDEX "journal_entries_entryNumber_key" ON "journal_entries"("entryNumber");

-- CreateIndex
CREATE INDEX "journal_entries_entryDate_idx" ON "journal_entries"("entryDate");

-- CreateIndex
CREATE INDEX "journal_entries_status_idx" ON "journal_entries"("status");

-- CreateIndex
CREATE INDEX "journal_entries_isDeleted_idx" ON "journal_entries"("isDeleted");

-- CreateIndex
CREATE INDEX "journal_entry_lines_entryId_idx" ON "journal_entry_lines"("entryId");

-- CreateIndex
CREATE INDEX "journal_entry_lines_accountId_idx" ON "journal_entry_lines"("accountId");

-- CreateIndex
CREATE INDEX "journal_entry_lines_clientId_idx" ON "journal_entry_lines"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "vouchers_voucherNumber_key" ON "vouchers"("voucherNumber");

-- CreateIndex
CREATE UNIQUE INDEX "vouchers_journalEntryId_key" ON "vouchers"("journalEntryId");

-- CreateIndex
CREATE INDEX "vouchers_categoryId_idx" ON "vouchers"("categoryId");

-- CreateIndex
CREATE INDEX "vouchers_companyId_idx" ON "vouchers"("companyId");

-- CreateIndex
CREATE INDEX "vouchers_approvalStatus_idx" ON "vouchers"("approvalStatus");

-- CreateIndex
CREATE INDEX "vouchers_date_idx" ON "vouchers"("date");

-- CreateIndex
CREATE INDEX "vouchers_isDeleted_idx" ON "vouchers"("isDeleted");

-- CreateIndex
CREATE INDEX "expense_categories_parentId_idx" ON "expense_categories"("parentId");

-- CreateIndex
CREATE INDEX "expense_categories_isDeleted_idx" ON "expense_categories"("isDeleted");

-- CreateIndex
CREATE UNIQUE INDEX "companies_name_key" ON "companies"("name");

-- CreateIndex
CREATE INDEX "companies_isDeleted_idx" ON "companies"("isDeleted");

-- CreateIndex
CREATE INDEX "notifications_recipientUserId_idx" ON "notifications"("recipientUserId");

-- CreateIndex
CREATE INDEX "notifications_recipientRole_idx" ON "notifications"("recipientRole");

-- CreateIndex
CREATE INDEX "notifications_isRead_idx" ON "notifications"("isRead");

-- CreateIndex
CREATE INDEX "notifications_recipientUserId_isRead_idx" ON "notifications"("recipientUserId", "isRead");

-- CreateIndex
CREATE INDEX "audit_logs_entityType_entityId_idx" ON "audit_logs"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "audit_logs_userId_idx" ON "audit_logs"("userId");

-- CreateIndex
CREATE INDEX "audit_logs_timestamp_idx" ON "audit_logs"("timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "system_settings_key_key" ON "system_settings"("key");

-- AddForeignKey
ALTER TABLE "machines" ADD CONSTRAINT "machines_plantId_fkey" FOREIGN KEY ("plantId") REFERENCES "plants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workers" ADD CONSTRAINT "workers_plantId_fkey" FOREIGN KEY ("plantId") REFERENCES "plants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zipper_variants" ADD CONSTRAINT "zipper_variants_grainTypeId_fkey" FOREIGN KEY ("grainTypeId") REFERENCES "grain_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_entries" ADD CONSTRAINT "production_entries_plantId_fkey" FOREIGN KEY ("plantId") REFERENCES "plants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_entries" ADD CONSTRAINT "production_entries_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "zipper_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_entry_workers" ADD CONSTRAINT "production_entry_workers_productionEntryId_fkey" FOREIGN KEY ("productionEntryId") REFERENCES "production_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_entry_workers" ADD CONSTRAINT "production_entry_workers_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "workers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scrap_sales" ADD CONSTRAINT "scrap_sales_plantId_fkey" FOREIGN KEY ("plantId") REFERENCES "plants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scrap_sales" ADD CONSTRAINT "scrap_sales_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "journal_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "raw_material_purchases" ADD CONSTRAINT "raw_material_purchases_grainTypeId_fkey" FOREIGN KEY ("grainTypeId") REFERENCES "grain_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "raw_material_purchases" ADD CONSTRAINT "raw_material_purchases_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "journal_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "raw_material_stock" ADD CONSTRAINT "raw_material_stock_grainTypeId_fkey" FOREIGN KEY ("grainTypeId") REFERENCES "grain_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finished_goods_stock" ADD CONSTRAINT "finished_goods_stock_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "zipper_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_rates" ADD CONSTRAINT "client_rates_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_rates" ADD CONSTRAINT "client_rates_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "zipper_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gate_passes" ADD CONSTRAINT "gate_passes_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gate_passes" ADD CONSTRAINT "gate_passes_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gate_passes" ADD CONSTRAINT "gate_passes_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "journal_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gate_pass_line_items" ADD CONSTRAINT "gate_pass_line_items_gatePassId_fkey" FOREIGN KEY ("gatePassId") REFERENCES "gate_passes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gate_pass_line_items" ADD CONSTRAINT "gate_pass_line_items_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "zipper_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "zipper_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entry_lines" ADD CONSTRAINT "journal_entry_lines_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "journal_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entry_lines" ADD CONSTRAINT "journal_entry_lines_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entry_lines" ADD CONSTRAINT "journal_entry_lines_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "expense_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "journal_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_approvedBy_fkey" FOREIGN KEY ("approvedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_categories" ADD CONSTRAINT "expense_categories_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "expense_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
