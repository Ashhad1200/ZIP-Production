# API Contract: Settings & Administration Module

**Base URL**: `/api/v1/settings`  
**Allowed Roles**: SUPER_ADMIN (all), limited read for other roles on their config needs

## User Management

### GET `/api/v1/settings/users`
List all users. **SUPER_ADMIN only**.

**Response** `200 OK`:
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Owner",
      "role": "SUPER_ADMIN",
      "isActive": true,
      "lastLoginAt": "2025-07-17T12:00:00Z",
      "createdAt": "2025-07-01T00:00:00Z"
    }
  ]
}
```

### POST `/api/v1/settings/users`
Create a new user. **SUPER_ADMIN only**.

**Request**:
```json
{
  "name": "New Finance Staff",
  "role": "FINANCE_HEAD"
}
```

### PUT `/api/v1/settings/users/:id`
Update user details (name, role, active status). **SUPER_ADMIN only**.

### DELETE `/api/v1/settings/users/:id`
Soft-delete (deactivate) a user. **SUPER_ADMIN only**.

## Client Management

### GET `/api/v1/settings/clients`
List all clients.

### POST `/api/v1/settings/clients`
Create a new client. **SUPER_ADMIN, FINANCE_HEAD**.

**Request**:
```json
{
  "name": "New Client Ltd",
  "contactPerson": "Ali Khan",
  "phone": "+92-300-1234567",
  "address": "Lahore, Pakistan",
  "paymentCycleDays": 45,
  "rates": [
    { "variantId": "uuid", "ratePerMeterPaisa": 550 },
    { "variantId": "uuid", "ratePerMeterPaisa": 600 }
  ]
}
```

### PUT `/api/v1/settings/clients/:id`
Update client details. **SUPER_ADMIN, FINANCE_HEAD**.

## Expense Category Management

### GET `/api/v1/settings/expense-categories`
List all expense categories (tree structure with sub-categories).

**Response** `200 OK`:
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Factory Expenses",
      "parentId": null,
      "isActive": true,
      "children": [
        { "id": "uuid", "name": "Electrical Repair", "parentId": "uuid", "isActive": true }
      ]
    },
    {
      "id": "uuid",
      "name": "Raw Material",
      "parentId": null,
      "isActive": true,
      "children": [
        { "id": "uuid", "name": "Grain Type A", "parentId": "uuid", "isActive": true },
        { "id": "uuid", "name": "Grain Type B", "parentId": "uuid", "isActive": true }
      ]
    }
  ]
}
```

### POST `/api/v1/settings/expense-categories`
Create a new expense category. **SUPER_ADMIN only**.

**Request**:
```json
{
  "name": "Legal Fees",
  "parentId": null
}
```

### PUT `/api/v1/settings/expense-categories/:id`
Update a category. **SUPER_ADMIN only**.

### DELETE `/api/v1/settings/expense-categories/:id`
Soft-delete a category. **SUPER_ADMIN only**. Fails if active vouchers reference it.

## Company Management

### GET `/api/v1/settings/companies`
List all companies.

### POST `/api/v1/settings/companies`
Create a company. **SUPER_ADMIN only**.

### PUT `/api/v1/settings/companies/:id`
Update company details. **SUPER_ADMIN only**.

## Variant & Grain Type Management

### GET `/api/v1/settings/variants`
List all zipper variants.

### POST `/api/v1/settings/variants`
Create a new variant. **SUPER_ADMIN only**.

### PUT `/api/v1/settings/variants/:id`
Update a variant. **SUPER_ADMIN only**.

### GET `/api/v1/settings/grain-types`
List all grain types.

### POST `/api/v1/settings/grain-types`
Create a new grain type. **SUPER_ADMIN only**.

### PUT `/api/v1/settings/grain-types/:id`
Update a grain type. **SUPER_ADMIN only**.

## Plant & Machine Management

### GET `/api/v1/settings/plants`
List plants with their machines.

### PUT `/api/v1/settings/plants/:id`
Update plant details. **SUPER_ADMIN only**.

### POST `/api/v1/settings/plants/:plantId/machines`
Add a machine to a plant. **SUPER_ADMIN only**.

**Request**:
```json
{
  "identifier": "Machine C",
  "kwhRating": 12.5,
  "expectedOutputPerShift": 3000
}
```

### PUT `/api/v1/settings/plants/:plantId/machines/:machineId`
Update machine details. **SUPER_ADMIN only**.

## System Settings

### GET `/api/v1/settings/system`
Get all system settings. **SUPER_ADMIN only**.

**Response** `200 OK`:
```json
{
  "data": [
    { "key": "electricity_discrepancy_threshold", "value": "15", "description": "% tolerance for electricity validation" },
    { "key": "voucher_approval_threshold_paisa", "value": "20000000", "description": "Voucher amount requiring super admin approval" },
    { "key": "verify_token_expiry_hours", "value": "48", "description": "Gate pass QR token validity" }
  ]
}
```

### PUT `/api/v1/settings/system/:key`
Update a system setting. **SUPER_ADMIN only**.

**Request**:
```json
{ "value": "20" }
```

## Worker Management

### GET `/api/v1/settings/workers`
List all workers.

### POST `/api/v1/settings/workers`
Create a worker. **SUPER_ADMIN only**.

### PUT `/api/v1/settings/workers/:id`
Update worker details. **SUPER_ADMIN only**.

## Notifications

### GET `/api/v1/notifications`
List notifications for the current user (based on userId and role from JWT).

**Query Parameters**:
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| unreadOnly | boolean | false | |
| limit | int | 20 | |

### PATCH `/api/v1/notifications/:id/read`
Mark a notification as read.

### PATCH `/api/v1/notifications/read-all`
Mark all notifications as read for current user.

### GET `/api/v1/notifications/unread-count`
Get unread notification count (for badge display). Polled frequently.

**Response** `200 OK`:
```json
{ "data": { "count": 3 } }
```
