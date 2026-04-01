# Quickstart: ZIP Production ERP System

**Date**: 2025-07-17 | **Plan**: [plan.md](./plan.md)

## Prerequisites

- **Node.js** 20.x LTS
- **npm** 10.x+ (ships with Node 20)
- **Docker** & **Docker Compose** (for local PostgreSQL)
- **Git**

## Initial Setup

### 1. Clone and install dependencies

```bash
git clone <repo-url>
cd "ZIP Production"
git checkout 001-zipper-erp-system

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
cd ..
```

### 2. Start PostgreSQL with Docker

```bash
docker-compose up -d
```

This starts:
- **PostgreSQL 15** on port `5432` (user: `zipproduction`, password: `zipproduction_dev`, database: `zipproduction`)
- **pgAdmin** on port `5050` for visual DB management

### 3. Configure environment variables

```bash
# backend/.env
cp backend/.env.example backend/.env
```

Required variables:
```env
DATABASE_URL="postgresql://zipproduction:zipproduction_dev@localhost:5432/zipproduction?schema=public"
DATABASE_URL_TEST="postgresql://zipproduction:zipproduction_dev@localhost:5432/zipproduction_test?schema=public"
JWT_SECRET="change-this-to-a-random-string-in-production"
JWT_EXPIRES_IN="24h"
PORT=3001
NODE_ENV=development
CORS_ORIGIN="http://localhost:5173"
CLOUDINARY_URL=""
VERIFY_TOKEN_EXPIRY_HOURS=48
```

```bash
# frontend/.env
cp frontend/.env.example frontend/.env
```

Required variables:
```env
VITE_API_BASE_URL="http://localhost:3001/api/v1"
VITE_APP_URL="http://localhost:5173"
```

### 4. Run database migrations and seed

```bash
cd backend

# Generate Prisma client
npx prisma generate

# Run migrations (creates all tables + balance enforcement trigger)
npx prisma migrate dev

# Seed with sample data (plants, variants, grain types, clients, users, sample transactions)
npx prisma db seed
```

### 5. Start development servers

```bash
# Terminal 1 — Backend (port 3001)
cd backend
npm run dev

# Terminal 2 — Frontend (port 5173)
cd frontend
npm run dev
```

Open **http://localhost:5173** in your browser.

## Running Tests

### Backend tests (Jest + Supertest)

```bash
cd backend

# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test file
npx jest tests/integration/gate-pass-flow.test.ts

# Run in watch mode
npm run test:watch
```

### Frontend tests (Vitest + Testing Library)

```bash
cd frontend

# Run all tests
npm test

# Run with UI dashboard
npm run test:ui

# Run specific test
npx vitest run src/hooks/__tests__/useSmartQuery.test.ts

# Watch mode (default)
npx vitest
```

## Key Development Commands

| Command | Location | Description |
|---------|----------|-------------|
| `npm run dev` | backend/ | Start Express server with nodemon |
| `npm run dev` | frontend/ | Start Vite dev server with HMR |
| `npx prisma studio` | backend/ | Open Prisma's visual DB editor |
| `npx prisma migrate dev --name <name>` | backend/ | Create new migration |
| `npx prisma db seed` | backend/ | Re-seed database with sample data |
| `npx prisma generate` | backend/ | Regenerate Prisma client after schema changes |
| `npm run lint` | both | Run ESLint |
| `npm run build` | frontend/ | Production build |
| `docker-compose logs -f postgres` | root | View PostgreSQL logs |

## Project Conventions

### Git Workflow
- Feature branches off `001-zipper-erp-system` (or `main` once merged)
- PR-based workflow with CI gating
- Conventional Commits: `feat:`, `fix:`, `docs:`, `test:`, `refactor:`

### API Patterns
- All endpoints prefixed with `/api/v1/`
- Pagination: `?page=1&limit=20` (default 20 items)
- Sorting: `?sortBy=createdAt&sortOrder=desc`
- Filtering: `?status=PENDING&clientId=uuid`
- Response format: `{ data: T, meta: { page, limit, total } }` for lists
- Error format: `{ error: { code: string, message: string, details?: any } }`

### Currency
- **Storage**: All monetary values as `BigInt` (paisa) in database
- **API**: Return `amountPaisa` (integer) and `amountDisplay` (formatted string)
- **Frontend**: Use `formatPaisaToRupees()` for display, `CurrencyInput` for forms

### Dates
- **Storage**: ISO-8601 UTC in database
- **API**: Return ISO-8601 strings
- **Frontend**: Display DD-MM-YYYY in PKT (UTC+5) using `date-fns` with `formatInTimeZone`

### RBAC
- Every new API endpoint MUST include `rbac(ALLOWED_ROLES)` middleware
- Every new frontend route MUST include `<RoleGuard roles={[...]}>`
- Production role responses MUST exclude financial fields via serializer

### Audit
- Every mutation service function MUST call `auditService.log()` with previous/new values
- Use the `@Audited` pattern: service functions accept `userId` parameter for audit context

## Sample User Accounts (after seeding)

| Name | Role | Accessible Modules |
|------|------|--------------------|
| Owner | SUPER_ADMIN | All modules |
| Finance Head | FINANCE_HEAD | Orders, Ledger, Vouchers, Stock (read-only) |
| Production Head | PRODUCTION_HEAD | Production, Stock (no financial data) |
| Logistics Head | LOGISTICS_HEAD | Gate Pass, Deliveries, Stock (read-only) |
| Marketing Head | MARKETING_HEAD | Orders (read-only), Client list |
| Data Entry Operator | PRODUCTION_HEAD | Production entry |
