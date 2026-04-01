# Implementation Plan: ZIP Production ERP System

**Branch**: `001-zipper-erp-system` | **Date**: 2025-07-17 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `/specs/001-zipper-erp-system/spec.md`

## Summary

Build a cloud-based ERP system for a Pakistani plastic zipper manufacturing company with 6 core modules — Production, Raw Material & Inventory, Gate Pass & Dispatch, Order Management, Finance & Accounting, and User Roles & Access Control — plus a real-time dashboard and reporting. The system uses a Node.js/Express backend with PostgreSQL (Prisma ORM) and a React/Vite frontend with Tailwind CSS. All cross-module operations (gate pass → stock → ledger) execute in atomic database transactions with double-entry accounting enforced at the database level. The application is mobile-first, supports offline mutation queuing for intermittent connectivity, and uses Pakistani business conventions (PKR in lakhs/crores, DD-MM-YYYY dates, kiosk-mode authentication for v1).

## Technical Context

**Language/Version**: Node.js 20.x LTS (backend), TypeScript 5.x throughout, React 18.x (frontend)  
**Primary Dependencies**: Express.js, Prisma ORM, React, Vite, Tailwind CSS, TanStack Query v5, Recharts, Axios, React Router v6, Lucide React, React Hot Toast, date-fns, @react-pdf/renderer, qrcode.react  
**Storage**: PostgreSQL 15+ via Prisma ORM. Monetary values stored as integers (paisa). File uploads on Cloudinary or local disk with cloud backup.  
**Testing**: Backend: Jest 29 + Supertest + jest-mock-extended (Prisma mocking). Frontend: Vitest 1.x + @testing-library/react + MSW (API mocking). CI blocks PRs on test failure.  
**Target Platform**: Web application on VPS (DigitalOcean) with Nginx reverse proxy. Browsers: Chrome, Safari (iOS), Edge (latest).  
**Project Type**: Full-stack web application (ERP)  
**Performance Goals**: < 3s first contentful paint on 4G mobile, < 2s transaction completion (gate pass atomic flow), 5s max data staleness for inventory/financial modules, 30s dashboard refresh, 60s list refresh  
**Constraints**: Offline-capable (60s mutation queuing), mobile-first (375px viewport), PKR-only currency, South Asian number formatting, light mode only (v1), no password auth (kiosk mode v1)  
**Scale/Scope**: Single factory, 2 plants, ~25 concurrent users, < 10,000 transactions/month, ~50 screens, ~20-25 clients

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principle | Status | Compliance Notes |
|---|-----------|--------|------------------|
| I | Data Integrity & Auditability | ✅ PASS | All Prisma models carry `createdBy`, `createdAt`, `updatedBy`, `updatedAt`. Soft deletes via `isDeleted` + `deletedAt`. Audit log table records previous/new values on every mutation. Double-entry accounting enforced via PostgreSQL trigger (sum debits = sum credits). Monetary values as integers (paisa) prevent floating-point errors. |
| II | Real-Time Synchronization | ✅ PASS | All cross-module side-effects execute within `prisma.$transaction()` at `Serializable` isolation. Originating client sees updates immediately via TanStack Query cache invalidation. Hybrid polling: 5s `refetchInterval` for inventory/financial endpoints (meets <5s freshness), 30s for dashboard, 60s for lists. Visibility-aware polling stops when tab is hidden. |
| III | Role-Based Access Control First | ✅ PASS | JWT in httpOnly cookies. Express middleware validates role on every endpoint before processing. Field-level stripping at serialization layer (Production role never sees financial fields in API responses). Frontend route guards + dynamic sidebar per role. 5 roles defined: Super Admin, Finance Head, Production Head, Logistics Head, Marketing Head. Permissions declared in config. |
| IV | Mobile-First Responsive Design | ✅ PASS | Tailwind CSS with 375px-first breakpoints. Touch targets ≥ 44×44px via Tailwind spacing. Data tables provide card-layout alternative on mobile. Dashboard KPI cards become 2×2 grid, charts stack vertically. Target < 3s FCP on 4G. |
| V | Cloud-Native & Offline-Resilient | ✅ PASS | PostgreSQL on VPS/managed DB. Custom IndexedDB-based mutation queue persists pending operations across page reloads. FIFO replay with server-side version/ETag conflict detection. Visible offline indicator with queued operation count. Conflicts surfaced to user for resolution. PM2 + Nginx enables zero-downtime rolling deploys. |
| VI | Simplicity for Non-Technical Users | ✅ PASS | All entity selectors use pre-populated dropdowns from DB. Multi-step gate pass creation with progress indicator. Card-based form layouts with section grouping. Contextual defaults (today's date, logged-in user, last-used client). Plain-language error messages adjacent to fields. Confirmation dialogs for destructive actions. |
| VII | Pakistani Business Context | ✅ PASS | All amounts stored in paisa, displayed as "PKR" prefix with South Asian grouping (lakhs/crores). Custom formatter using `Intl.NumberFormat('en-IN')` with PKR override. Dates displayed DD-MM-YYYY, stored ISO-8601 internally. UI text externalized to locale file for future Urdu support. Business terms: "Gate Pass", "Ledger", etc. |
| VIII | Testing Standards | ✅ PASS | Integration tests cover: gate pass → stock → ledger flow, production → raw material consumption, payment → ledger → balance. Unit tests for: raw material consumption formula, due date calculations, electricity validation, PKR formatting, double-entry balance. Jest+Supertest (backend), Vitest+RTL (frontend). CI gates all PRs. Test data uses realistic PKR amounts and Pakistani date ranges. |
| IX | Iterative Delivery | ✅ PASS | 4 review cycles planned: (1) Production & Inventory, (2) Gate Pass & Dispatch, (3) Finance & Ledger, (4) Dashboard & Reporting. Each cycle produces a working deployable version with real data flowing through modules. Changelog per cycle. Conventional Commits format. |

**Gate Result: ✅ ALL PRINCIPLES SATISFIED — Proceed to Phase 0**

### Post-Design Re-Evaluation (after Phase 1)

All 9 principles re-verified against completed design artifacts (data-model.md, contracts/, research.md):

- **I–II**: Data model includes AuditLog entity, JournalEntry/JournalEntryLine with PostgreSQL balance trigger, atomic transaction specs on gate-pass contract. ✅
- **III**: All 8 contract files declare allowed roles. Order and gate-pass contracts specify financial field stripping for PRODUCTION_HEAD and MARKETING_HEAD. Auth contract defines JWT httpOnly cookie flow. ✅
- **VI–VII**: All contracts use enum/UUID references (dropdowns, not free-text). All monetary responses include dual format (paisa + "PKR X,XX,XXX.XX" display string with South Asian grouping). ✅
- **Role naming clarification**: Constitution defines roles as "Gate Operator" and "Viewer". Spec refines these to "Logistics Head" and "Marketing Head" respectively. Responsibilities are identical — the spec names are used throughout contracts and data model for consistency with the approved feature specification.

**Post-Design Gate: ✅ ALL PRINCIPLES REMAIN SATISFIED**

## Project Structure

### Documentation (this feature)

```text
specs/001-zipper-erp-system/
├── plan.md              # This file
├── research.md          # Phase 0 output — research decisions
├── data-model.md        # Phase 1 output — Prisma schema & entity design
├── quickstart.md        # Phase 1 output — developer setup guide
├── contracts/           # Phase 1 output — API contracts per module
│   ├── auth.md
│   ├── production.md
│   ├── inventory.md
│   ├── gate-pass.md
│   ├── orders.md
│   ├── finance.md
│   ├── dashboard.md
│   └── settings.md
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── controllers/        # Route handlers per module
│   │   ├── auth.controller.ts
│   │   ├── production.controller.ts
│   │   ├── inventory.controller.ts
│   │   ├── gate-pass.controller.ts
│   │   ├── order.controller.ts
│   │   ├── finance.controller.ts
│   │   ├── dashboard.controller.ts
│   │   └── settings.controller.ts
│   ├── services/           # Business logic layer
│   │   ├── auth.service.ts
│   │   ├── production.service.ts
│   │   ├── inventory.service.ts
│   │   ├── gate-pass.service.ts
│   │   ├── order.service.ts
│   │   ├── finance.service.ts
│   │   ├── accounting.service.ts    # Double-entry journal entries
│   │   ├── dashboard.service.ts
│   │   ├── notification.service.ts
│   │   └── audit.service.ts
│   ├── middleware/          # Auth, role-check, error handling
│   │   ├── auth.middleware.ts
│   │   ├── rbac.middleware.ts
│   │   ├── error-handler.middleware.ts
│   │   ├── audit.middleware.ts
│   │   └── validation.middleware.ts
│   ├── routes/             # Route definitions per module
│   │   ├── index.ts             # /api/v1/ prefix router
│   │   ├── auth.routes.ts
│   │   ├── production.routes.ts
│   │   ├── inventory.routes.ts
│   │   ├── gate-pass.routes.ts
│   │   ├── order.routes.ts
│   │   ├── finance.routes.ts
│   │   ├── dashboard.routes.ts
│   │   └── settings.routes.ts
│   ├── utils/              # Helpers
│   │   ├── currency.ts          # PKR formatting, paisa conversion
│   │   ├── date.ts              # PKT timezone, DD-MM-YYYY
│   │   ├── formulas.ts          # Raw material consumption, electricity validation
│   │   ├── serializer.ts        # Role-based field stripping
│   │   └── sequence.ts          # Gate pass / voucher number generation
│   ├── config/
│   │   ├── roles.ts             # RBAC permission declarations
│   │   ├── database.ts
│   │   └── app.ts
│   ├── types/               # TypeScript type definitions
│   └── app.ts               # Express app setup
├── prisma/
│   ├── schema.prisma        # Database schema
│   ├── migrations/          # Prisma migrations (includes balance trigger)
│   └── seed.ts              # Comprehensive sample data for all modules
├── tests/
│   ├── unit/                # Business logic unit tests
│   │   ├── formulas.test.ts
│   │   ├── currency.test.ts
│   │   ├── date.test.ts
│   │   └── electricity-validation.test.ts
│   ├── integration/         # Cross-module transactional tests
│   │   ├── gate-pass-flow.test.ts
│   │   ├── production-consumption.test.ts
│   │   ├── payment-ledger.test.ts
│   │   └── voucher-approval.test.ts
│   └── setup.ts             # Test DB setup, cleanup between tests
├── jest.config.ts
├── tsconfig.json
├── package.json
└── Dockerfile

frontend/
├── src/
│   ├── pages/              # Page components per module
│   │   ├── Dashboard/
│   │   ├── Production/
│   │   ├── Inventory/
│   │   ├── GatePass/
│   │   ├── Orders/
│   │   ├── Finance/
│   │   │   ├── ClientLedger/
│   │   │   ├── Vouchers/
│   │   │   └── Reports/
│   │   └── Settings/
│   ├── components/          # Reusable UI components
│   │   ├── layout/          # Sidebar, Header, MobileNav
│   │   ├── ui/              # DataTable, KPICard, Modal, Drawer, ConfirmDialog
│   │   ├── charts/          # Recharts wrappers
│   │   │   ├── ProductionTrendChart.tsx
│   │   │   ├── RevenueChart.tsx
│   │   │   ├── StockLevelChart.tsx
│   │   │   ├── OverduePaymentsChart.tsx
│   │   │   └── ShiftComparisonChart.tsx
│   │   └── forms/           # CurrencyInput, DatePicker wrappers, VariantSelect
│   ├── hooks/               # Custom hooks
│   │   ├── useAuth.ts
│   │   ├── useRole.ts
│   │   ├── useSmartQuery.ts      # Visibility-aware polling per module
│   │   ├── useOfflineQueue.ts    # IndexedDB mutation queue
│   │   └── useNotifications.ts
│   ├── services/            # API service layer (Axios instances)
│   │   ├── api.ts                # Base Axios instance with interceptors
│   │   ├── production.api.ts
│   │   ├── inventory.api.ts
│   │   ├── gate-pass.api.ts
│   │   ├── order.api.ts
│   │   ├── finance.api.ts
│   │   ├── dashboard.api.ts
│   │   └── settings.api.ts
│   ├── context/
│   │   ├── AuthContext.tsx
│   │   └── NotificationContext.tsx
│   ├── utils/
│   │   ├── currency.ts           # PKR formatting (shared with backend)
│   │   ├── date.ts               # PKT date formatting
│   │   └── constants.ts
│   ├── locales/
│   │   └── en.json               # Externalized UI strings for future Urdu
│   ├── App.tsx
│   ├── main.tsx
│   └── router.tsx                # React Router v6 with nested layouts + route guards
├── tests/
│   ├── components/
│   ├── hooks/
│   └── setup.ts
├── vitest.config.ts
├── tailwind.config.js
├── tsconfig.json
├── package.json
├── index.html
└── Dockerfile

# Root
docker-compose.yml          # PostgreSQL + pgAdmin for local dev
.github/
└── workflows/
    └── ci.yml              # Lint, test (backend + frontend), build
nginx/
└── default.conf            # Reverse proxy config
```

**Structure Decision**: Full-stack web application with separate `backend/` and `frontend/` directories. The backend follows controller-service pattern (no separate repository layer — Prisma's client is already a typed data access layer). The frontend follows a feature-based page structure with shared components. Shared utilities (currency formatting) are duplicated between backend and frontend for now since they share no runtime — extracted to a shared package only if drift becomes a problem.

## Complexity Tracking

| Concern | Resolution | Why Simpler Alternative Was Rejected |
|---------|-----------|--------------------------------------|
| Double-entry accounting with journal entries | PostgreSQL trigger enforces balance invariant; journal entry lines link to accounts + clients | Simple debit/credit columns on ledger table would not satisfy constitution mandate for double-entry at database constraint level |
| IndexedDB offline queue | Custom FIFO queue with conflict detection and visible indicator | TanStack Query's built-in retry alone doesn't persist across page reloads and has no conflict detection — violates constitution principle V |
| Hybrid polling intervals (5s / 30s / 60s) | useSmartQuery hook with visibility detection | Single global polling interval either wastes bandwidth (all at 5s) or violates 5s freshness for inventory/finance (all at 30s+) |
