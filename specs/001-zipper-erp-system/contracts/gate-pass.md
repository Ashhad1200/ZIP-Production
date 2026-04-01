# API Contract: Gate Pass Module

**Base URL**: `/api/v1/gate-passes`  
**Allowed Roles**: SUPER_ADMIN, LOGISTICS_HEAD

## Endpoints

### GET `/api/v1/gate-passes`
List gate passes with filtering and pagination.

**Query Parameters**:
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| page | int | 1 | |
| limit | int | 20 | |
| clientId | uuid | - | Filter by client |
| status | enum | - | CREATED, DISPATCHED, RECEIVED |
| dateFrom | date | - | |
| dateTo | date | - | |
| shift | enum | - | DAY, NIGHT |
| search | string | - | Search by gate pass number |
| sortBy | string | date | |
| sortOrder | string | desc | |

**Response** `200 OK`:
```json
{
  "data": [
    {
      "id": "uuid",
      "gatePassNumber": "GP-2025-00001",
      "client": { "id": "uuid", "name": "Alkaram" },
      "date": "2025-07-17",
      "issuingManagerName": "Logistics Head",
      "shift": "DAY",
      "status": "DISPATCHED",
      "lineItems": [
        {
          "id": "uuid",
          "variant": { "id": "uuid", "code": "V-101", "name": "Standard Rice Bag Zipper" },
          "meters": 10000,
          "ratePerMeterPaisa": 550,
          "ratePerMeterDisplay": "PKR 5.50",
          "lineAmountPaisa": 5500000,
          "lineAmountDisplay": "PKR 55,000.00"
        }
      ],
      "totalAmountPaisa": 5500000,
      "totalAmountDisplay": "PKR 55,000.00",
      "paymentDueDate": "2025-08-16",
      "orderId": "uuid",
      "receivedAt": null,
      "createdAt": "2025-07-17T14:30:00Z",
      "version": 1
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 500 }
}
```

**Note**: `ratePerMeterPaisa`, `lineAmountPaisa`, `totalAmountPaisa`, and all financial fields are **stripped from responses** when the requesting user's role is PRODUCTION_HEAD or MARKETING_HEAD.

### POST `/api/v1/gate-passes`
Create a gate pass. **Atomic transaction**: deducts stock, creates ledger entry, sets payment due date, updates order fulfillment.

**Request**:
```json
{
  "clientId": "uuid",
  "date": "2025-07-17",
  "issuingManagerName": "Logistics Head",
  "shift": "DAY",
  "orderId": "uuid",
  "lineItems": [
    { "variantId": "uuid", "meters": 10000 },
    { "variantId": "uuid", "meters": 5000 }
  ]
}
```

**Response** `201 Created`:
```json
{
  "data": {
    "id": "uuid",
    "gatePassNumber": "GP-2025-00001",
    "status": "CREATED",
    "verifyToken": "abc123...",
    "verifyUrl": "https://app.zipproduction.com/gp/verify?token=abc123...",
    "totalAmountPaisa": 8250000,
    "totalAmountDisplay": "PKR 82,500.00",
    "paymentDueDate": "2025-08-16",
    "stockUpdates": [
      { "variantId": "uuid", "variantCode": "V-101", "previousMeters": 50000, "newMeters": 40000 },
      { "variantId": "uuid", "variantCode": "V-205", "previousMeters": 30000, "newMeters": 25000 }
    ],
    "journalEntryId": "uuid",
    "orderUpdate": { "orderId": "uuid", "metersDelivered": 30000, "status": "ONGOING" }
  }
}
```

### GET `/api/v1/gate-passes/:id`
Get a single gate pass with all details.

### PATCH `/api/v1/gate-passes/:id/status`
Update gate pass status (CREATED → DISPATCHED). Requires `If-Match` header.

**Request**:
```json
{ "status": "DISPATCHED" }
```

### POST `/api/v1/gate-passes/verify`
**Public endpoint** (no auth required — accessed via QR scan). Marks gate pass as received.

**Request**:
```json
{ "token": "abc123..." }
```

**Response** `200 OK`:
```json
{
  "data": {
    "gatePassNumber": "GP-2025-00001",
    "client": "Alkaram",
    "status": "RECEIVED",
    "receivedAt": "2025-07-18T09:30:00Z",
    "lineItems": [
      { "variant": "V-101", "meters": 10000 }
    ]
  }
}
```

**Error Responses**:
| Code | Status | Description |
|------|--------|-------------|
| `TOKEN_INVALID` | 404 | Token does not exist |
| `TOKEN_EXPIRED` | 410 | Token has expired (past 48 hours) |
| `ALREADY_RECEIVED` | 200 | Gate pass already marked received (returns existing data — idempotent) |

### GET `/api/v1/gate-passes/:id/pdf`
Generate gate pass PDF data (returns PDF metadata for client-side rendering).

## Error Codes
| Code | Status | Description |
|------|--------|-------------|
| `INSUFFICIENT_STOCK` | 422 | One or more variants have insufficient stock |
| `CLIENT_NOT_FOUND` | 404 | Invalid clientId |
| `NO_ACTIVE_RATE` | 422 | No active rate configured for client-variant pair |
| `INVALID_STATUS_TRANSITION` | 422 | Cannot transition from current status to requested status |
| `CONCURRENT_MODIFICATION` | 409 | ETag mismatch — gate pass was modified since last read |
