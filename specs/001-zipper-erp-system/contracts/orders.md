# API Contract: Order Management Module

**Base URL**: `/api/v1/orders`  
**Allowed Roles**: SUPER_ADMIN, FINANCE_HEAD (full), PRODUCTION_HEAD (read-only, no financial fields), MARKETING_HEAD (read-only)

## Endpoints

### GET `/api/v1/orders`
List orders with filtering and pagination.

**Query Parameters**:
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| page | int | 1 | |
| limit | int | 20 | |
| clientId | uuid | - | Filter by client |
| status | enum | - | PENDING, ONGOING, COMPLETED |
| variantId | uuid | - | Filter by variant |
| dateFrom | date | - | Order creation date range |
| dateTo | date | - | |
| overdue | boolean | false | Only orders past deadline with status != COMPLETED |
| sortBy | string | createdAt | |
| sortOrder | string | desc | |

**Response** `200 OK`:
```json
{
  "data": [
    {
      "id": "uuid",
      "orderNumber": "ORD-2025-00001",
      "client": { "id": "uuid", "name": "Nishat" },
      "variant": { "id": "uuid", "code": "V-205", "name": "Heavy Duty Zipper" },
      "metersOrdered": 50000,
      "metersDelivered": 30000,
      "fulfillmentPercent": 60,
      "deliveryDeadline": "2025-08-01",
      "status": "ONGOING",
      "isOverdue": false,
      "createdAt": "2025-07-17T10:00:00Z",
      "version": 3
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 80 }
}
```

**Role-based field stripping**:
- **PRODUCTION_HEAD**: Response EXCLUDES `ratePerMeterPaisa`, `ratePerMeterDisplay`, `totalAmountPaisa`, `totalAmountDisplay`
- **MARKETING_HEAD**: Same exclusions as PRODUCTION_HEAD
- **FINANCE_HEAD / SUPER_ADMIN**: Full response including:
  ```json
  {
    "ratePerMeterPaisa": 600,
    "ratePerMeterDisplay": "PKR 6.00",
    "totalAmountPaisa": 30000000,
    "totalAmountDisplay": "PKR 3,00,000.00",
    "clientOutstandingPaisa": 15000000,
    "clientOutstandingDisplay": "PKR 1,50,000.00"
  }
  ```

### POST `/api/v1/orders`
Create a new order. **FINANCE_HEAD and SUPER_ADMIN only**. Sends notification to PRODUCTION_HEAD (without rate).

**Request**:
```json
{
  "clientId": "uuid",
  "variantId": "uuid",
  "metersOrdered": 50000,
  "ratePerMeterPaisa": 600,
  "deliveryDeadline": "2025-08-01"
}
```

**Response** `201 Created`:
```json
{
  "data": {
    "id": "uuid",
    "orderNumber": "ORD-2025-00001",
    "status": "PENDING",
    "totalAmountPaisa": 30000000,
    "totalAmountDisplay": "PKR 3,00,000.00",
    "clientOutstandingPaisa": 15000000,
    "clientOutstandingDisplay": "PKR 1,50,000.00",
    "notificationSent": true,
    "version": 1
  }
}
```

### GET `/api/v1/orders/:id`
Get a single order with full details.

### GET `/api/v1/orders/by-client/:clientId`
Get full order history for a specific client.

### GET `/api/v1/orders/fulfillment-report`
Order fulfillment status report showing all orders and completion percentages.

**Response** `200 OK`:
```json
{
  "data": {
    "summary": {
      "totalOrders": 80,
      "pending": 10,
      "ongoing": 25,
      "completed": 45,
      "overdue": 3
    },
    "orders": [
      {
        "orderNumber": "ORD-2025-00001",
        "client": "Nishat",
        "variant": "V-205",
        "metersOrdered": 50000,
        "metersDelivered": 30000,
        "fulfillmentPercent": 60,
        "deliveryDeadline": "2025-08-01",
        "status": "ONGOING",
        "daysRemaining": 15
      }
    ]
  }
}
```

## Error Codes
| Code | Status | Description |
|------|--------|-------------|
| `CLIENT_NOT_FOUND` | 404 | Invalid clientId |
| `VARIANT_NOT_FOUND` | 404 | Invalid variantId |
| `INVALID_RATE` | 422 | Rate must be positive |
| `INVALID_DEADLINE` | 422 | Deadline must be in the future |
