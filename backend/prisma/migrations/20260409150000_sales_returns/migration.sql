-- CreateTable: SalesReturn
CREATE TABLE "sales_returns" (
    "id"               TEXT NOT NULL,
    "returnNumber"     TEXT NOT NULL,
    "gatePassId"       TEXT NOT NULL,
    "clientId"         TEXT NOT NULL,
    "date"             DATE NOT NULL,
    "reason"           TEXT,
    "totalAmountPaisa" BIGINT NOT NULL,
    "journalEntryId"   TEXT,
    "createdBy"        TEXT NOT NULL,
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedBy"        TEXT,
    "updatedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sales_returns_pkey" PRIMARY KEY ("id")
);

-- CreateTable: SalesReturnLineItem
CREATE TABLE "sales_return_line_items" (
    "id"                 TEXT NOT NULL,
    "salesReturnId"      TEXT NOT NULL,
    "gatePassLineItemId" TEXT NOT NULL,
    "variantId"          TEXT NOT NULL,
    "metersReturned"     INTEGER NOT NULL,
    "ratePerMeterPaisa"  BIGINT NOT NULL,
    "lineAmountPaisa"    BIGINT NOT NULL,
    CONSTRAINT "sales_return_line_items_pkey" PRIMARY KEY ("id")
);

-- CreateUnique
CREATE UNIQUE INDEX "sales_returns_returnNumber_key"     ON "sales_returns"("returnNumber");
CREATE UNIQUE INDEX "sales_returns_journalEntryId_key"   ON "sales_returns"("journalEntryId");

-- CreateIndex
CREATE INDEX "sales_returns_gatePassId_idx"             ON "sales_returns"("gatePassId");
CREATE INDEX "sales_returns_clientId_idx"               ON "sales_returns"("clientId");
CREATE INDEX "sales_returns_date_idx"                   ON "sales_returns"("date");
CREATE INDEX "sales_return_line_items_salesReturnId_idx"      ON "sales_return_line_items"("salesReturnId");
CREATE INDEX "sales_return_line_items_gatePassLineItemId_idx" ON "sales_return_line_items"("gatePassLineItemId");
CREATE INDEX "sales_return_line_items_variantId_idx"          ON "sales_return_line_items"("variantId");

-- AddForeignKey
ALTER TABLE "sales_returns" ADD CONSTRAINT "sales_returns_gatePassId_fkey"
    FOREIGN KEY ("gatePassId") REFERENCES "gate_passes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "sales_returns" ADD CONSTRAINT "sales_returns_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "sales_returns" ADD CONSTRAINT "sales_returns_journalEntryId_fkey"
    FOREIGN KEY ("journalEntryId") REFERENCES "journal_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "sales_return_line_items" ADD CONSTRAINT "sales_return_line_items_salesReturnId_fkey"
    FOREIGN KEY ("salesReturnId") REFERENCES "sales_returns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "sales_return_line_items" ADD CONSTRAINT "sales_return_line_items_gatePassLineItemId_fkey"
    FOREIGN KEY ("gatePassLineItemId") REFERENCES "gate_pass_line_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "sales_return_line_items" ADD CONSTRAINT "sales_return_line_items_variantId_fkey"
    FOREIGN KEY ("variantId") REFERENCES "zipper_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
