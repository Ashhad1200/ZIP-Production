# API Contract: Authentication & Session

**Base URL**: `/api/v1/auth`

## Endpoints

### POST `/api/v1/auth/login`
Select a user from the kiosk list (no password in v1).

**Request**:
```json
{
  "userId": "uuid"
}
```

**Response** `200 OK`:
Sets `httpOnly` cookie `token` with JWT containing `{ userId, role, name }`.
```json
{
  "data": {
    "id": "uuid",
    "name": "Owner",
    "role": "SUPER_ADMIN",
    "lastLoginAt": "2025-07-17T12:00:00Z"
  }
}
```

### POST `/api/v1/auth/logout`
Clear session cookie.

**Response** `200 OK`:
```json
{ "data": { "message": "Logged out" } }
```

### GET `/api/v1/auth/me`
Return current user from JWT cookie.

**Response** `200 OK`:
```json
{
  "data": {
    "id": "uuid",
    "name": "Owner",
    "role": "SUPER_ADMIN"
  }
}
```

**Response** `401 Unauthorized`:
```json
{ "error": { "code": "UNAUTHORIZED", "message": "Not authenticated" } }
```

### GET `/api/v1/auth/users`
List users available for kiosk selection (active only). No auth required (kiosk mode).

**Response** `200 OK`:
```json
{
  "data": [
    { "id": "uuid", "name": "Owner", "role": "SUPER_ADMIN" },
    { "id": "uuid", "name": "Finance Head", "role": "FINANCE_HEAD" }
  ]
}
```

## Headers
- **Cookie**: `token=<JWT>` (set by server, httpOnly, secure in production)
- **ETag**: Returned on entity responses for conflict detection

## Error Codes
| Code | Status | Description |
|------|--------|-------------|
| `UNAUTHORIZED` | 401 | Missing or invalid JWT |
| `FORBIDDEN` | 403 | Valid JWT but insufficient role |
| `USER_NOT_FOUND` | 404 | userId does not exist |
| `USER_INACTIVE` | 403 | User account is deactivated |
