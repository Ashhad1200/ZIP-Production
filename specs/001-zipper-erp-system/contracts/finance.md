# API Contract: Finance Module

**Base URL**: `/api/v1/finance`  
**Allowed Roles**: SUPER_ADMIN, FINANCE_HEAD

## Client Ledger Endpoints

### GET `/api/v1/finance/clients`
List all clients with their current outstanding balance.

**Query Parameters**:
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| page | int | 1 | |
| limit | int | 20 | |
| search | string | - | Search by client name |
| hasOverdue | boolean | false | Only clients with overdue payments |
| sortBy | string | name | name, outstanding, daysOverdue |
| sortOrder | string | asc | |

**Response** `200 OK`:
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Alkaram",
      "paymentCycleDays": 30,
      "totalDebitsPaisa": 50000000,
      "totalDebitsDisplay": "PKR 5,00,000.00",
      "totalCreditsPaisa": 35000000,
      "totalCreditsDisplay": "PKR 3,50,000.00",
      "outstandingPaisa": 15000000,
      "outstandingDisplay": "PKR 1,50,000.00",
      "overdueAmountPaisa": 5500000,
      "overdueAmountDisplay": "PKR 55,000.00",
      "maxDaysOverdue": 15,
      "version": 12
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 25 }
}
```

### GET `/api/v1/finance/clients/:clientId/ledger`
Get full ledger for a specific client — all debit and credit entries with running balance.

**Query Parameters**:
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| page | int | 1 | |
| limit | int | 50 | |
| dateFrom | date | - | |
| dateTo | date | - | |
| type | enum | - | DEBIT or CREDIT |

**Response** `200 OK`:
```json
{
  "data": {
    "client": { "id": "uuid", "name": "Alkaram", "paymentCycleDays": 30 },
    "summary": {
      "totalDebitsPaisa": 50000000,
      "totalCreditsPaisa": 35000000,
      "outstandingPaisa": 15000000
    },
    "entries": [
      {
        "id": "uuid",
        "date": "2025-07-17",
        "type": "DEBIT",
        "description": "Gate Pass GP-2025-00001 — V-101 × 10,000m",
        "referenceType": "gate_pass",
        "referenceId": "uuid",
        "gatePassNumber": "GP-2025-00001",
        "amountPaisa": 5500000,
        "amountDisplay": "PKR 55,000.00",
        "paymentDueDate": "2025-08-16",
        "isOverdue": false,
        "daysOverdue": 0,
        "runningBalancePaisa": 15000000,
        "runningBalanceDisplay": "PKR 1,50,000.00"
      },
      {
        "id": "uuid",
        "date": "2025-07-10",
        "type": "CREDIT",
        "description": "Payment received — Cheque #123456",
        "referenceType": "payment",
        "referenceId": null,
        "paymentMode": "CHEQUE",
        "chequeNumber": "123456",
        "amountPaisa": 20000000,
        "amountDisplay": "PKR 2,00,000.00",
        "runningBalancePaisa": 9500000,
        "runningBalanceDisplay": "PKR 95,000.00"
      }
    ]
  },
  "meta": { "page": 1, "limit": 50, "total": 200 }
}
```

### GET `/api/v1/finance/clients/:clientId/ledger/download`
Download ledger as a printable format (returns PDF or CSV based on `format` query param).

**Query Parameters**: `format=pdf` or `format=csv`

### POST `/api/v1/finance/clients/:clientId/payments`
Record a payment (credit entry) for a client.

**Request**:
```json
{
  "amountPaisa": 20000000,
  "date": "2025-07-10",
  "paymentMode": "CHEQUE",
  "chequeNumber": "123456",
  "notes": "Monthly settlement"
}
```

**Response** `201 Created`:
```json
{
  "data": {
    "id": "uuid",
    "journalEntryId": "uuid",
    "newOutstandingPaisa": 13000000,
    "newOutstandingDisplay": "PKR 1,30,000.00"
  }
}
```

### GET `/api/v1/finance/overdue`
List all overdue payments across all clients.

**Query Parameters**:
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| sortBy | string | daysOverdue | daysOverdue, amount, clientName |
| sortOrder | string | desc | |

**Response** `200 OK`:
```json
{
  "data": [
    {
      "clientId": "uuid",
      "clientName": "Alkaram",
      "gatePassNumber": "GP-2025-00001",
      "amountPaisa": 5500000,
      "amountDisplay": "PKR 55,000.00",
      "dueDate": "2025-06-17",
      "daysOverdue": 30
    }
  ]
}
```

## Client Rate Management

### GET `/api/v1/finance/clients/:clientId/rates`
Get current and historical rates for a client.

### PUT `/api/v1/finance/clients/:clientId/rates`
Update the rate for a specific variant. Archives the old rate and creates a new one.

**Request**:
```json
{
  "variantId": "uuid",
  "newRatePerMeterPaisa": 600
}
```

## Voucher/Expense Endpoints

### GET `/api/v1/finance/vouchers`
List expense vouchers with filtering.

**Query Parameters**:
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| page | int | 1 | |
| limit | int | 20 | |
| categoryId | uuid | - | Filter by expense category |
| companyId | uuid | - | Filter by company |
| approvalStatus | enum | - | AUTO_APPROVED, PENDING, APPROVED, REJECTED |
| dateFrom | date | - | |
| dateTo | date | - | |
| paymentMode | enum | - | CASH, CHEQUE |

**Response** `200 OK`:
```json
{
  "data": [
    {
      "id": "uuid",
      "voucherNumber": "VCH-2025-00001",
      "title": "Factory maintenance",
      "description": "Monthly electrical repair",
      "date": "2025-07-15",
      "amountPaisa": 15000000,
      "amountDisplay": "PKR 1,50,000.00",
      "category": { "id": "uuid", "name": "Factory Expenses" },
      "paymentMode": "CASH",
      "chequeNumber": null,
      "company": { "id": "uuid", "name": "Company A" },
      "approvalStatus": "AUTO_APPROVED",
      "createdBy": { "id": "uuid", "name": "Finance Head" },
      "createdAt": "2025-07-15T10:00:00Z",
      "version": 1
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 150 }
}
```

### POST `/api/v1/finance/vouchers`
Create an expense voucher. Auto-approves if below PKR 2,00,000. Sends notification if above.

**Request**:
```json
{
  "title": "Raw material purchase",
  "description": "Container shipment - Type A Grain",
  "date": "2025-07-17",
  "amountPaisa": 30000000,
  "categoryId": "uuid",
  "paymentMode": "CHEQUE",
  "chequeNumber": "789012",
  "companyId": "uuid"
}
```

**Response** `201 Created`:
```json
{
  "data": {
    "id": "uuid",
    "voucherNumber": "VCH-2025-00050",
    "approvalStatus": "PENDING",
    "requiresApproval": true,
    "notificationSent": true,
    "version": 1
  }
}
```

### PATCH `/api/v1/finance/vouchers/:id/approve`
Approve or reject a voucher. **SUPER_ADMIN only**.

**Request**:
```json
{
  "action": "APPROVE",
  "comment": ""
}
```
or
```json
{
  "action": "REJECT",
  "comment": "Amount too high, please get a second quote"
}
```

## Financial Reports

### GET `/api/v1/finance/reports/monthly`
Monthly financial report: opening balance → inflow → outflow → closing balance with category breakdown.

**Query Parameters**:
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| year | int | current | |
| month | int | current | |
| companyId | uuid | - | Filter by company |

**Response** `200 OK`:
```json
{
  "data": {
    "period": "July 2025",
    "company": "All Companies",
    "openingBalancePaisa": 500000000,
    "openingBalanceDisplay": "PKR 50,00,000.00",
    "inflowPaisa": 200000000,
    "inflowDisplay": "PKR 20,00,000.00",
    "inflowBreakdown": {
      "clientPayments": 180000000,
      "scrapSales": 20000000
    },
    "outflowPaisa": 150000000,
    "outflowDisplay": "PKR 15,00,000.00",
    "outflowByCategory": [
      { "category": "Factory Expenses", "amountPaisa": 50000000, "amountDisplay": "PKR 5,00,000.00" },
      { "category": "Raw Material", "amountPaisa": 70000000, "amountDisplay": "PKR 7,00,000.00" },
      { "category": "Utilities", "amountPaisa": 15000000, "amountDisplay": "PKR 1,50,000.00" },
      { "category": "Transport", "amountPaisa": 10000000, "amountDisplay": "PKR 1,00,000.00" },
      { "category": "Other", "amountPaisa": 5000000, "amountDisplay": "PKR 50,000.00" }
    ],
    "closingBalancePaisa": 550000000,
    "closingBalanceDisplay": "PKR 55,00,000.00"
  }
}
```

## Error Codes
| Code | Status | Description |
|------|--------|-------------|
| `CLIENT_NOT_FOUND` | 404 | Invalid clientId |
| `VOUCHER_NOT_FOUND` | 404 | Invalid voucherId |
| `ALREADY_APPROVED` | 422 | Voucher already approved/rejected |
| `INVALID_PAYMENT_MODE` | 422 | Cheque number required for CHEQUE mode |
| `AMOUNT_MUST_BE_POSITIVE` | 422 | Amount must be > 0 |
| `CATEGORY_NOT_FOUND` | 404 | Invalid categoryId |
| `JOURNAL_IMBALANCED` | 500 | Double-entry balance check failed (system error) |
