# API Contract: Inventory Module

**Base URL**: `/api/v1/inventory`  
**Allowed Roles**: SUPER_ADMIN, PRODUCTION_HEAD (finished goods), FINANCE_HEAD (read-only), LOGISTICS_HEAD (read-only)

## Endpoints

### GET `/api/v1/inventory/finished-goods`
Get current finished goods stock per variant.

**Query Parameters**:
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| variantId | uuid | - | Filter by specific variant |
| belowThreshold | boolean | false | Only show items below low-stock threshold |

**Response** `200 OK`:
```json
{
  "data": [
    {
      "id": "uuid",
      "variant": { "id": "uuid", "code": "V-101", "name": "Standard Rice Bag Zipper" },
      "currentMeters": 50000,
      "lowStockThreshold": 10000,
      "isBelowThreshold": false,
      "lastUpdated": "2025-07-17T12:00:00Z",
      "version": 42
    }
  ]
}
```

**Polling**: Frontend uses `refetchInterval: 5000` (5 seconds) per constitution requirement.

### GET `/api/v1/inventory/raw-materials`
Get current raw material stock per grain type.

**Response** `200 OK`:
```json
{
  "data": [
    {
      "id": "uuid",
      "grainType": { "id": "uuid", "code": "GT-A", "name": "Type A Grain" },
      "currentBags": 200.5,
      "lowStockThresholdBags": 50,
      "isBelowThreshold": false,
      "lastUpdated": "2025-07-17T12:00:00Z",
      "version": 15
    }
  ]
}
```

### GET `/api/v1/inventory/raw-materials/purchases`
List raw material purchase history with pagination.

**Query Parameters**:
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| page | int | 1 | |
| limit | int | 20 | |
| grainTypeId | uuid | - | Filter by grain type |
| source | enum | - | CONTAINER or SPOT_MARKET |
| dateFrom | date | - | |
| dateTo | date | - | |

**Response** `200 OK`:
```json
{
  "data": [
    {
      "id": "uuid",
      "grainType": { "id": "uuid", "code": "GT-A", "name": "Type A Grain" },
      "numberOfBags": 600,
      "ratePerBagPaisa": 450000,
      "ratePerBagDisplay": "PKR 4,500.00",
      "totalAmountPaisa": 270000000,
      "totalAmountDisplay": "PKR 27,00,000.00",
      "purchaseDate": "2025-07-15",
      "source": "CONTAINER",
      "createdAt": "2025-07-15T10:00:00Z"
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 45 }
}
```

### POST `/api/v1/inventory/raw-materials/purchases`
Record a raw material purchase. Atomically increases grain stock.

**Allowed Roles**: SUPER_ADMIN, FINANCE_HEAD

**Request**:
```json
{
  "grainTypeId": "uuid",
  "numberOfBags": 600,
  "ratePerBagPaisa": 450000,
  "purchaseDate": "2025-07-15",
  "source": "CONTAINER"
}
```

**Response** `201 Created`:
```json
{
  "data": {
    "id": "uuid",
    "totalAmountPaisa": 270000000,
    "stockUpdate": { "grainTypeId": "uuid", "newStockBags": 800 }
  }
}
```

### GET `/api/v1/inventory/consumption-report`
Raw material consumption vs. procurement report.

**Query Parameters**:
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| grainTypeId | uuid | - | Filter by grain type |
| period | string | current_month | "current_month", "last_month", "last_3_months", "custom" |
| dateFrom | date | - | For custom period |
| dateTo | date | - | For custom period |

**Response** `200 OK`:
```json
{
  "data": {
    "period": "July 2025",
    "grainTypes": [
      {
        "grainType": "Type A Grain",
        "purchasedBags": 600,
        "consumedBags": 480.5,
        "netChange": 119.5,
        "currentStock": 200.5,
        "weightedAvgCostPaisa": 448000
      }
    ]
  }
}
```

### PUT `/api/v1/inventory/finished-goods/:id/threshold`
Update low-stock threshold for a variant. **SUPER_ADMIN only**.

### PUT `/api/v1/inventory/raw-materials/:id/threshold`
Update low-stock threshold for a grain type. **SUPER_ADMIN only**.

## Error Codes
| Code | Status | Description |
|------|--------|-------------|
| `INSUFFICIENT_STOCK` | 422 | Operation would cause negative stock |
| `GRAIN_TYPE_NOT_FOUND` | 404 | Invalid grainTypeId |
| `VARIANT_NOT_FOUND` | 404 | Invalid variantId |
