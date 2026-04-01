# API Contract: Dashboard Module

**Base URL**: `/api/v1/dashboard`  
**Allowed Roles**: SUPER_ADMIN (full dashboard), other roles see role-scoped subsets

## Endpoints

### GET `/api/v1/dashboard/kpis`
Get top-level KPI card data.

**Polling**: Frontend uses `refetchInterval: 30000` (30 seconds).

**Response** `200 OK`:
```json
{
  "data": {
    "todayProductionMeters": 25000,
    "todayProductionTrend": { "value": 12.5, "direction": "UP", "comparedTo": "yesterday" },
    "pendingOrdersCount": 8,
    "pendingOrdersTrend": { "value": -2, "direction": "DOWN", "comparedTo": "last_week" },
    "overduePaymentsPaisa": 120000000,
    "overduePaymentsDisplay": "PKR 12,00,000.00",
    "overduePaymentsTrend": { "value": 5.3, "direction": "UP", "comparedTo": "last_week" },
    "activeGatePassesToday": 4,
    "totalStockMeters": 150000,
    "totalStockTrend": { "value": -3.2, "direction": "DOWN", "comparedTo": "yesterday" }
  }
}
```

### GET `/api/v1/dashboard/production-trend`
Production trend data for line/area chart.

**Query Parameters**:
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| period | string | 30d | "7d", "30d", "90d", "12m" |
| plantId | uuid | - | Filter by plant (omit for both) |
| variantId | uuid | - | Filter by variant |

**Response** `200 OK`:
```json
{
  "data": {
    "period": "30d",
    "dataPoints": [
      {
        "date": "2025-07-17",
        "totalMeters": 25000,
        "plant1Meters": 15000,
        "plant2Meters": 10000,
        "dayShiftMeters": 14000,
        "nightShiftMeters": 11000
      }
    ]
  }
}
```

### GET `/api/v1/dashboard/shift-comparison`
Day vs. Night shift production comparison.

**Query Parameters**:
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| period | string | 30d | "7d", "30d", "90d" |
| plantId | uuid | - | Filter by plant |

**Response** `200 OK`:
```json
{
  "data": {
    "period": "30d",
    "dayShiftTotalMeters": 420000,
    "nightShiftTotalMeters": 330000,
    "dailyBreakdown": [
      { "date": "2025-07-17", "dayMeters": 14000, "nightMeters": 11000 }
    ]
  }
}
```

### GET `/api/v1/dashboard/revenue-overview`
Monthly inflow vs. outflow for bar chart.

**Query Parameters**:
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| year | int | current | |

**Response** `200 OK`:
```json
{
  "data": {
    "year": 2025,
    "months": [
      {
        "month": "Jan",
        "inflowPaisa": 200000000,
        "inflowDisplay": "PKR 20,00,000.00",
        "outflowPaisa": 150000000,
        "outflowDisplay": "PKR 15,00,000.00",
        "netPaisa": 50000000,
        "netDisplay": "PKR 5,00,000.00"
      }
    ]
  }
}
```

### GET `/api/v1/dashboard/stock-levels`
Current stock per variant for horizontal bar chart.

**Response** `200 OK`:
```json
{
  "data": [
    {
      "variantId": "uuid",
      "variantCode": "V-101",
      "variantName": "Standard Rice Bag Zipper",
      "currentMeters": 50000,
      "lowStockThreshold": 10000,
      "isBelowThreshold": false
    }
  ]
}
```

### GET `/api/v1/dashboard/overdue-payments`
Overdue payments grouped by client for donut chart.

**Response** `200 OK`:
```json
{
  "data": {
    "totalOverduePaisa": 120000000,
    "totalOverdueDisplay": "PKR 12,00,000.00",
    "byClient": [
      {
        "clientId": "uuid",
        "clientName": "Alkaram",
        "overduePaisa": 55000000,
        "overdueDisplay": "PKR 5,50,000.00",
        "percentOfTotal": 45.8,
        "maxDaysOverdue": 30
      }
    ]
  }
}
```

### GET `/api/v1/dashboard/recent-activity`
Recent activity feed — latest gate passes, orders, vouchers, production entries.

**Query Parameters**:
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| limit | int | 20 | |

**Response** `200 OK`:
```json
{
  "data": [
    {
      "id": "uuid",
      "type": "GATE_PASS",
      "title": "Gate Pass GP-2025-00001",
      "description": "Alkaram — V-101 × 10,000m — PKR 55,000",
      "timestamp": "2025-07-17T14:30:00Z",
      "actor": "Logistics Head",
      "referenceType": "gate_pass",
      "referenceId": "uuid"
    },
    {
      "id": "uuid",
      "type": "PRODUCTION",
      "title": "Production Entry — Plant 1 Day Shift",
      "description": "V-101 — 5,000 meters",
      "timestamp": "2025-07-17T12:00:00Z",
      "actor": "Data Entry Operator",
      "referenceType": "production_entry",
      "referenceId": "uuid"
    }
  ]
}
```

### GET `/api/v1/dashboard/recent-gate-passes`
Latest gate passes for the dedicated gate pass feed panel.

**Query Parameters**: `limit` (default 10)

**Response** `200 OK`:
```json
{
  "data": [
    {
      "id": "uuid",
      "gatePassNumber": "GP-2025-00001",
      "client": "Alkaram",
      "variants": "V-101 (10,000m), V-205 (5,000m)",
      "totalMeters": 15000,
      "status": "DISPATCHED",
      "createdAt": "2025-07-17T14:30:00Z",
      "createdBy": "Logistics Head"
    }
  ]
}
```

## Notes

- Dashboard endpoints are optimized for read performance with database views or materialized queries
- All chart data endpoints support the `If-None-Match` header for ETag-based caching
- Financial data in dashboard responses is **stripped** for PRODUCTION_HEAD and LOGISTICS_HEAD roles
