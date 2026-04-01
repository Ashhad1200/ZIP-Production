# API Contract: Production Module

**Base URL**: `/api/v1/production`  
**Allowed Roles**: SUPER_ADMIN, PRODUCTION_HEAD

## Endpoints

### GET `/api/v1/production/entries`
List production entries with filtering and pagination.

**Query Parameters**:
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| page | int | 1 | Page number |
| limit | int | 20 | Items per page |
| plantId | uuid | - | Filter by plant |
| shift | enum | - | DAY or NIGHT |
| dateFrom | date | - | Start date (YYYY-MM-DD) |
| dateTo | date | - | End date (YYYY-MM-DD) |
| variantId | uuid | - | Filter by variant |
| sortBy | string | date | Field to sort by |
| sortOrder | string | desc | asc or desc |

**Response** `200 OK`:
```json
{
  "data": [
    {
      "id": "uuid",
      "plant": { "id": "uuid", "name": "Plant 1" },
      "shift": "DAY",
      "date": "2025-07-17",
      "variant": { "id": "uuid", "code": "V-101", "name": "Standard Rice Bag Zipper" },
      "metersProduced": 5000,
      "gramsPerMeter": 3.2,
      "electricityUnitsConsumed": 120,
      "hasElectricityDiscrepancy": false,
      "scrapWeightGrams": 500,
      "workers": [
        { "id": "uuid", "name": "Worker A" }
      ],
      "rawMaterialConsumed": {
        "grainType": "Type A Grain",
        "gramsConsumed": 16000,
        "bagsConsumed": 0.64
      },
      "createdBy": { "id": "uuid", "name": "Data Entry Operator" },
      "createdAt": "2025-07-17T12:00:00Z",
      "version": 1
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 150 }
}
```

### POST `/api/v1/production/entries`
Create a new production entry. Triggers raw material deduction + finished goods stock increase atomically.

**Request**:
```json
{
  "plantId": "uuid",
  "shift": "DAY",
  "date": "2025-07-17",
  "variantId": "uuid",
  "metersProduced": 5000,
  "gramsPerMeter": 3.2,
  "electricityUnitsConsumed": 120,
  "electricityStartReading": 1000,
  "electricityEndReading": 1120,
  "scrapWeightGrams": 500,
  "workerIds": ["uuid", "uuid"]
}
```

**Response** `201 Created`:
```json
{
  "data": {
    "id": "uuid",
    "gatePassNumber": null,
    "hasElectricityDiscrepancy": false,
    "rawMaterialConsumed": { "gramsConsumed": 16000, "bagsConsumed": 0.64 },
    "stockUpdate": { "variantId": "uuid", "newStockMeters": 55000 },
    "version": 1
  }
}
```

**Error Responses**:
| Code | Status | Description |
|------|--------|-------------|
| `DUPLICATE_ENTRY` | 409 | Entry for this plant+shift+date already exists |
| `VARIANT_NOT_FOUND` | 404 | Invalid variantId |
| `INSUFFICIENT_RAW_MATERIAL` | 422 | Not enough grain stock for calculated consumption |
| `INVALID_ELECTRICITY` | 422 | End reading less than start reading |

### GET `/api/v1/production/entries/:id`
Get a single production entry by ID.

### PUT `/api/v1/production/entries/:id`
Edit a production entry. **SUPER_ADMIN only**. Requires `If-Match` header with current ETag.

### GET `/api/v1/production/dpr`
Get Daily Progress Report.

**Query Parameters**:
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| date | date | today | Report date |
| plantId | uuid | - | Filter by plant (omit for both plants) |

**Response** `200 OK`:
```json
{
  "data": {
    "date": "2025-07-17",
    "plants": [
      {
        "plant": { "id": "uuid", "name": "Plant 1" },
        "dayShift": {
          "metersProduced": 5000,
          "variants": [{ "code": "V-101", "meters": 5000 }],
          "electricityUnits": 120,
          "scrapGrams": 500,
          "workers": ["Worker A", "Worker B"],
          "hasDiscrepancy": false
        },
        "nightShift": null,
        "totalMeters": 5000
      }
    ],
    "grandTotalMeters": 5000
  }
}
```

### GET `/api/v1/production/scrap-sales`
List scrap sales with pagination.

### POST `/api/v1/production/scrap-sales`
Record a monthly scrap sale.

**Request**:
```json
{
  "date": "2025-07-31",
  "totalWeightKg": 450,
  "ratePerKgPaisa": 8000,
  "buyerName": "Scrap Buyer Co."
}
```

### GET `/api/v1/production/discrepancies`
List electricity discrepancy alerts. **SUPER_ADMIN only**.

## Lookup Endpoints

### GET `/api/v1/production/plants`
List all plants. Used to populate dropdowns.

### GET `/api/v1/production/workers`
List all active workers. Query param `plantId` for filtering.

### GET `/api/v1/production/variants`
List all active zipper variants.
