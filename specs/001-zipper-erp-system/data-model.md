# Data Model: ZIP Production ERP System

**Date**: 2025-07-17 | **Plan**: [plan.md](./plan.md) | **Research**: [research.md](./research.md)

## Overview

This document defines all database entities, their fields, relationships, validation rules, and state transitions for the ZIP Production ERP. The schema is designed for PostgreSQL via Prisma ORM. All monetary values are stored as integers (paisa). All records carry audit fields and support soft deletion.

---

## Common Patterns

### Audit Fields (on every model)

```
createdBy    String       FK → User.id (server-set, never client input)
createdAt    DateTime     @default(now()) (server-set)
updatedBy    String       FK → User.id (server-set on update)
updatedAt    DateTime     @updatedAt (server-set)
isDeleted    Boolean      @default(false)
deletedAt    DateTime?    (set on soft delete)
deletedBy    String?      FK → User.id
```

### Versioning (for conflict detection)

```
version      Int          @default(1) (incremented on every update, used for ETag)
```

---

## Entity Definitions

### 1. User

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | UUID | PK, auto-generated | |
| name | String | required, unique | Display name for kiosk selection |
| role | Enum | required | SUPER_ADMIN, FINANCE_HEAD, PRODUCTION_HEAD, LOGISTICS_HEAD, MARKETING_HEAD |
| isActive | Boolean | default: true | Inactive users hidden from selection list |
| lastLoginAt | DateTime? | | Timestamp of last kiosk selection |

**Relationships**: Creates audit trail entries. Receives notifications.

**Validation**: Name must be non-empty, unique. Role must be one of 5 predefined values.

### 2. Plant

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | UUID | PK | |
| name | String | required, unique | e.g., "Plant 1", "Plant 2" |
| location | String? | | Address or description |

**Relationships**: Has many Machines. Has many ProductionEntries.

**Seed Data**: 2 plants pre-configured.

### 3. Machine

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | UUID | PK | |
| plantId | UUID | FK → Plant.id | |
| identifier | String | required | e.g., "Machine A" |
| kwhRating | Decimal | required, > 0 | Kilowatt-hour rating for electricity validation |
| expectedOutputPerShift | Int | required, > 0 | Expected meters per 12-hour shift |
| isActive | Boolean | default: true | |

**Relationships**: Belongs to Plant. Referenced in electricity discrepancy calculations.

### 4. Worker

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | UUID | PK | |
| name | String | required | |
| designation | String? | | Role/title in factory |
| plantId | UUID? | FK → Plant.id | Assigned plant (optional; cross-plant in Phase 2) |
| isActive | Boolean | default: true | |

**Relationships**: Many-to-many with ProductionEntry (via join table `production_entry_workers`).

### 5. ZipperVariant

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | UUID | PK | |
| code | String | required, unique | e.g., "V-101", "V-205" |
| name | String | required | e.g., "Standard Rice Bag Zipper" |
| description | String? | | |
| standardGramsPerMeter | Decimal | required, > 0 | Default weight spec |
| grainTypeId | UUID | FK → GrainType.id | Which raw material this variant consumes |
| isActive | Boolean | default: true | |

**Relationships**: Belongs to GrainType. Has many ProductionEntries, GatePassLineItems, OrderItems. Has one FinishedGoodsStock.

**Seed Data**: ~10 variants pre-configured.

### 6. GrainType

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | UUID | PK | |
| code | String | required, unique | e.g., "GT-A", "GT-B" |
| name | String | required | e.g., "Type A Grain" |
| description | String? | | |
| bagWeightGrams | Int | default: 25000 | Standard bag weight in grams (25 kg) |
| lowStockThresholdBags | Decimal? | | Alert threshold in bags |
| isActive | Boolean | default: true | |

**Relationships**: Has many ZipperVariants. Has one RawMaterialStock. Has many RawMaterialPurchases.

**Seed Data**: ~10 grain types pre-configured.

### 7. ProductionEntry

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | UUID | PK | |
| plantId | UUID | FK → Plant.id, required | |
| shift | Enum | required | DAY (7AM-7PM), NIGHT (7PM-7AM) |
| date | Date | required | Night shift uses shift-start date |
| variantId | UUID | FK → ZipperVariant.id, required | |
| metersProduced | Int | required, > 0 | Total meters produced in shift |
| gramsPerMeter | Decimal | required, > 0 | Actual weight recorded for this run |
| electricityUnitsConsumed | Decimal | required, ≥ 0 | Submeter reading difference (end - start) |
| electricityStartReading | Decimal? | | Submeter reading at shift start |
| electricityEndReading | Decimal? | | Submeter reading at shift end |
| hasElectricityDiscrepancy | Boolean | default: false | Flagged by system |
| electricityDiscrepancyNotes | String? | | System-generated explanation |
| scrapWeightGrams | Int | default: 0 | Defective/waste material in grams |

**Unique Constraint**: `(plantId, shift, date)` — prevents duplicate entries.

**Relationships**: Belongs to Plant, ZipperVariant. Many-to-many with Workers.

**Side Effects on Create**:
1. Auto-calculate raw material consumed: `gramsPerMeter × metersProduced` grams → deduct from RawMaterialStock (in bags = grams ÷ bagWeightGrams)
2. Increase FinishedGoodsStock for the variant by `metersProduced`
3. Validate electricity: compare consumed vs. expected (machine kWh × hours); flag if deviation > configurable threshold
4. All side effects in a single `prisma.$transaction()`

**State**: No state transitions — immutable after creation (only Super Admin can edit).

### 8. ScrapRecord

*Scrap data is embedded in ProductionEntry (scrapWeightGrams field). This view entity aggregates scrap.*

Monthly scrap is aggregated via query: `SUM(scrapWeightGrams) WHERE date BETWEEN monthStart AND monthEnd AND plantId = X`.

### 9. ScrapSale

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | UUID | PK | |
| date | Date | required | Sale date |
| totalWeightKg | Decimal | required, > 0 | Weight sold in kg |
| ratePerKg | Int | required, > 0 | In paisa |
| totalAmountPaisa | BigInt | required, > 0 | totalWeightKg × ratePerKg (computed, stored) |
| buyerName | String? | | Optional |
| plantId | UUID? | FK → Plant.id | Scoped to plant if applicable |

**Side Effects on Create**: Creates journal entry: Debit Cash → Credit Scrap Sales Revenue.

### 10. RawMaterialPurchase

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | UUID | PK | |
| grainTypeId | UUID | FK → GrainType.id, required | |
| numberOfBags | Decimal | required, > 0 | Can be fractional |
| ratePerBagPaisa | BigInt | required, > 0 | In paisa |
| totalAmountPaisa | BigInt | required | Computed: numberOfBags × ratePerBagPaisa |
| purchaseDate | Date | required | |
| source | Enum | required | CONTAINER, SPOT_MARKET |

**Side Effects on Create**:
1. Increase RawMaterialStock by `numberOfBags`
2. Create journal entry: Debit Raw Material Inventory → Credit Cash/Bank/AP

### 11. RawMaterialStock

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | UUID | PK | |
| grainTypeId | UUID | FK → GrainType.id, unique | One record per grain type |
| currentBags | Decimal | required, ≥ 0 | Running stock in bags |

**Validation**: Cannot go negative. Low-stock alert when `currentBags < grainType.lowStockThresholdBags`.

### 12. FinishedGoodsStock

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | UUID | PK | |
| variantId | UUID | FK → ZipperVariant.id, unique | One record per variant |
| currentMeters | Int | required, ≥ 0 | Running stock in meters |
| lowStockThreshold | Int? | | Alert threshold in meters |

**Validation**: Cannot go negative (gate pass rejected if insufficient). Low-stock alert when `currentMeters < lowStockThreshold`.

### 13. Client

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | UUID | PK | |
| name | String | required, unique | |
| contactPerson | String? | | |
| phone | String? | | |
| address | String? | | |
| paymentCycleDays | Int | default: 30 | 30, 45, 60, or custom days |
| accountId | UUID | FK → Account.id | AR sub-ledger account for this client |

**Relationships**: Has many ClientRates, GatePasses, Orders, LedgerEntries (via JournalEntryLine.clientId).

**Seed Data**: ~5-10 sample clients with varied payment cycles.

### 14. ClientRate

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | UUID | PK | |
| clientId | UUID | FK → Client.id, required | |
| variantId | UUID | FK → ZipperVariant.id, required | |
| ratePerMeterPaisa | BigInt | required, > 0 | Current agreed rate in paisa |
| effectiveFrom | DateTime | required | When this rate became effective |
| effectiveTo | DateTime? | | Null = current rate |

**Unique Constraint**: `(clientId, variantId, effectiveTo IS NULL)` — only one active rate per client-variant pair.

**Business Rule**: When rate is updated, current rate gets `effectiveTo = now()` and new rate is inserted with `effectiveFrom = now()`. Historical transactions retain their original rate.

### 15. GatePass

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | UUID | PK | |
| gatePassNumber | String | required, unique | Sequential: "GP-2025-00001" |
| clientId | UUID | FK → Client.id, required | |
| date | Date | required | |
| issuingManagerName | String | required | |
| shift | Enum | required | DAY, NIGHT |
| status | Enum | default: CREATED | CREATED → DISPATCHED → RECEIVED |
| orderId | UUID? | FK → Order.id | Optional link to order for fulfillment tracking |
| verifyToken | String | unique | Crypto-random token for QR verification |
| verifyTokenExpiresAt | DateTime | | 48 hours from creation |
| receivedAt | DateTime? | | Timestamp when QR was scanned |
| receivedBy | String? | | Who scanned the QR |
| totalAmountPaisa | BigInt | required | Sum of line item amounts |
| paymentDueDate | Date | required | date + client.paymentCycleDays |
| journalEntryId | UUID? | FK → JournalEntry.id | Link to the double-entry record |

**Relationships**: Belongs to Client. Optionally belongs to Order. Has many GatePassLineItems. Has one JournalEntry.

**State Transitions**:
```
CREATED → DISPATCHED (manual status update by logistics)
DISPATCHED → RECEIVED (via QR scan verification endpoint)
CREATED → RECEIVED (shortcut if QR scanned before manual dispatch update)
```

**Side Effects on Create** (single atomic transaction):
1. For each line item: deduct FinishedGoodsStock by meters (reject if insufficient)
2. Create journal entry: Debit AR (client sub-ledger) → Credit Sales Revenue
3. Set paymentDueDate = date + client.paymentCycleDays
4. If orderId linked, update Order.metersDelivered; auto-complete if fully delivered
5. Generate verifyToken for QR code

### 16. GatePassLineItem

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | UUID | PK | |
| gatePassId | UUID | FK → GatePass.id, required | |
| variantId | UUID | FK → ZipperVariant.id, required | |
| meters | Int | required, > 0 | Meters dispatched |
| ratePerMeterPaisa | BigInt | required | Rate locked at dispatch time |
| lineAmountPaisa | BigInt | required | meters × ratePerMeterPaisa |

### 17. Order

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | UUID | PK | |
| orderNumber | String | required, unique | Sequential: "ORD-2025-00001" |
| clientId | UUID | FK → Client.id, required | |
| variantId | UUID | FK → ZipperVariant.id, required | |
| metersOrdered | Int | required, > 0 | |
| ratePerMeterPaisa | BigInt | required, > 0 | |
| totalAmountPaisa | BigInt | required | metersOrdered × ratePerMeterPaisa |
| deliveryDeadline | Date | required | |
| metersDelivered | Int | default: 0 | Updated as gate passes are created |
| status | Enum | default: PENDING | PENDING → ONGOING → COMPLETED |

**State Transitions**:
```
PENDING → ONGOING (when first gate pass is created against this order)
ONGOING → COMPLETED (when metersDelivered ≥ metersOrdered, auto-triggered)
```

**Side Effects on Create**: Send notification to Production Head (variant, meters, deadline — NO rate).

### 18. Account (Chart of Accounts)

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | UUID | PK | |
| code | String | required, unique | "1000", "1100", "4100", etc. |
| name | String | required | "Cash", "Accounts Receivable", etc. |
| accountType | Enum | required | ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE |
| parentId | UUID? | FK → Account.id | Hierarchy support |
| isGroup | Boolean | default: false | Group accounts cannot have JE lines |
| isActive | Boolean | default: true | |

**Seed Data**: Pre-configured chart of accounts per research.md.

### 19. JournalEntry

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | UUID | PK | |
| entryNumber | String | required, unique | "GP-GP-2025-00001", "EXP-VCH-001", etc. |
| entryDate | Date | required | |
| description | String? | | |
| status | Enum | default: DRAFT | DRAFT → POSTED → REVERSED |
| referenceType | String? | | "gate_pass", "expense_voucher", "payment", "scrap_sale", "raw_material_purchase", "production" |
| referenceId | UUID? | | ID of the source document |
| postedAt | DateTime? | | |
| postedBy | UUID? | FK → User.id | |

**Database Constraint**: PostgreSQL trigger on status transition to POSTED verifies `SUM(debit_amount) = SUM(credit_amount)` across all lines. Rejects if unbalanced.

### 20. JournalEntryLine

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | UUID | PK | |
| entryId | UUID | FK → JournalEntry.id, required | |
| accountId | UUID | FK → Account.id, required | |
| clientId | UUID? | FK → Client.id | Sub-ledger link (for AR/AP per client) |
| description | String? | | |
| debitAmountPaisa | BigInt | default: 0, ≥ 0 | |
| creditAmountPaisa | BigInt | default: 0, ≥ 0 | |
| lineOrder | Int | default: 0 | |

**Constraint**: `NOT (debitAmountPaisa > 0 AND creditAmountPaisa > 0)` — each line is either debit or credit, not both.

### 21. Voucher (Expense)

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | UUID | PK | |
| voucherNumber | String | required, unique | Sequential: "VCH-2025-00001" |
| title | String | required | Brief description |
| description | String? | | Detailed description |
| date | Date | required | |
| amountPaisa | BigInt | required, > 0 | |
| categoryId | UUID | FK → ExpenseCategory.id, required | |
| paymentMode | Enum | required | CASH, CHEQUE |
| chequeNumber | String? | | Required if paymentMode = CHEQUE |
| companyId | UUID | FK → Company.id, required | |
| approvalStatus | Enum | default: computed | AUTO_APPROVED (< PKR 2,00,000), PENDING, APPROVED, REJECTED |
| approvedBy | UUID? | FK → User.id | |
| approvedAt | DateTime? | | |
| rejectionReason | String? | | |
| journalEntryId | UUID? | FK → JournalEntry.id | |

**Business Rules**:
- If `amountPaisa < 20000000` (PKR 2,00,000): auto-approve
- If `amountPaisa ≥ 20000000`: set status PENDING, send notification to Super Admin
- On approval: create journal entry (Debit Expense → Credit Cash/Bank) and post

### 22. ExpenseCategory

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | UUID | PK | |
| name | String | required | |
| parentId | UUID? | FK → ExpenseCategory.id | Sub-categories |
| isActive | Boolean | default: true | |

**Seed Data**: Factory Expenses, Director Expenses, Shareholder/Dividend, Charity, Head Office, Raw Material (with grain sub-categories), Utilities, Transport.

### 23. Company

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | UUID | PK | |
| name | String | required, unique | |
| taxStructure | String? | | For future compliance |
| isActive | Boolean | default: true | |

**Seed Data**: 2-3 companies pre-configured.

### 24. Notification

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | UUID | PK | |
| recipientUserId | UUID? | FK → User.id | Specific user |
| recipientRole | Enum? | | Target role (all users with this role) |
| type | Enum | required | ORDER_CREATED, VOUCHER_APPROVAL, LOW_STOCK, GATE_PASS_RECEIVED, ELECTRICITY_DISCREPANCY |
| title | String | required | |
| message | String | required | |
| referenceType | String? | | "order", "voucher", "gate_pass", etc. |
| referenceId | UUID? | | |
| isRead | Boolean | default: false | |
| readAt | DateTime? | | |

### 25. AuditLog

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | UUID | PK | |
| entityType | String | required | "production_entry", "gate_pass", "voucher", etc. |
| entityId | UUID | required | |
| action | Enum | required | CREATE, UPDATE, SOFT_DELETE |
| previousValue | JSON? | | Snapshot of previous state |
| newValue | JSON | required | Snapshot of new state |
| changedFields | String[]? | | List of changed field names |
| userId | UUID | FK → User.id, required | Acting user |
| reason | String? | | Required for Super Admin bulk corrections |
| timestamp | DateTime | @default(now()) | |
| ipAddress | String? | | |

### 26. SystemSetting

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | UUID | PK | |
| key | String | required, unique | e.g., "electricity_discrepancy_threshold", "voucher_approval_threshold" |
| value | String | required | Stored as string, parsed by type |
| description | String? | | |

**Seed Data**: `electricity_discrepancy_threshold: "15"` (%), `voucher_approval_threshold_paisa: "20000000"` (PKR 2,00,000), `verify_token_expiry_hours: "48"`.

---

## Entity Relationship Diagram (Text)

```
Plant ──1:N──> Machine
Plant ──1:N──> ProductionEntry
Plant ──1:N──> Worker (optional assignment)

GrainType ──1:N──> ZipperVariant
GrainType ──1:1──> RawMaterialStock
GrainType ──1:N──> RawMaterialPurchase

ZipperVariant ──1:1──> FinishedGoodsStock
ZipperVariant ──1:N──> ProductionEntry
ZipperVariant ──1:N──> GatePassLineItem
ZipperVariant ──1:N──> Order
ZipperVariant ──1:N──> ClientRate

Client ──1:N──> GatePass
Client ──1:N──> Order
Client ──1:N──> ClientRate
Client ──1:N──> JournalEntryLine (sub-ledger)
Client ──1:1──> Account (AR sub-account)

GatePass ──1:N──> GatePassLineItem
GatePass ──N:1──> Order (optional)
GatePass ──1:1──> JournalEntry

Voucher ──N:1──> ExpenseCategory
Voucher ──N:1──> Company
Voucher ──1:1──> JournalEntry

Account ──1:N──> Account (parent-child hierarchy)
Account ──1:N──> JournalEntryLine

JournalEntry ──1:N──> JournalEntryLine

ProductionEntry ──N:N──> Worker (via join table)

User ──1:N──> Notification
User ──1:N──> AuditLog
```

---

## Key Formulas

### Raw Material Consumption
```
gramsConsumed = gramsPerMeter × metersProduced
bagsConsumed = gramsConsumed / grainType.bagWeightGrams
```

### Electricity Discrepancy Detection
```
expectedUnits = (machine.kwhRating × shiftHours) × (metersProduced / machine.expectedOutputPerShift)
actualUnits = electricityUnitsConsumed
deviationPercent = |actualUnits - expectedUnits| / expectedUnits × 100
flagDiscrepancy = deviationPercent > systemSetting.electricity_discrepancy_threshold
```

### Gate Pass Amount
```
lineAmount = meters × clientRate.ratePerMeterPaisa (for active rate at dispatch time)
totalAmount = SUM(lineAmounts)
paymentDueDate = gatePass.date + client.paymentCycleDays
```

### Overdue Detection
```
isOverdue = today > gatePass.paymentDueDate AND journalEntryLine.debitAmountPaisa > 0
daysOverdue = today - gatePass.paymentDueDate
```

### Client Outstanding Balance
```
SELECT SUM(debit_amount_paisa) - SUM(credit_amount_paisa) as outstanding
FROM journal_entry_lines jel
JOIN journal_entries je ON jel.entry_id = je.id
WHERE jel.client_id = {clientId} AND je.status = 'POSTED'
```
