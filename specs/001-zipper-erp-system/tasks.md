# Tasks: ZIP Production ERP System

**Input**: Design documents from `/specs/001-zipper-erp-system/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/, quickstart.md, checklists/

**Tests**: Included — Constitution Principle VIII mandates integration tests for cross-module flows and unit tests for business logic. Test tasks are in Phase 11 (Polish).

**Organization**: Tasks are grouped by user story (8 stories, P1–P8) to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1–US8)
- Exact file paths included in descriptions

## Path Conventions

- **Web app**: `backend/src/`, `frontend/src/` at repository root
- **Database**: `backend/prisma/`
- **Tests**: `backend/tests/`, `frontend/tests/`
- **Infrastructure**: `docker-compose.yml`, `nginx/`, `.github/workflows/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization — directories, dependencies, local database, CI pipeline

- [x] T001 Create root project directory structure with `backend/`, `frontend/`, `nginx/`, and `.github/workflows/` directories per plan.md
- [x] T002 [P] Initialize backend Node.js project with TypeScript, Express, Prisma, Jest, Supertest, and all dependencies in `backend/package.json` and `backend/tsconfig.json`
- [x] T003 [P] Initialize frontend React/Vite project with TypeScript, Tailwind CSS, TanStack Query v5, React Router v6, Recharts, Axios, Lucide React, and all dependencies in `frontend/package.json`, `frontend/tsconfig.json`, `frontend/vite.config.ts`, `frontend/tailwind.config.js`, and `frontend/index.html`
- [x] T004 [P] Create `docker-compose.yml` at repository root with PostgreSQL 15 (port 5432, user: zipproduction, db: zipproduction) and pgAdmin (port 5050) services
- [x] T005 [P] Create environment configuration files (`backend/.env.example`, `frontend/.env.example`) with all required variables per quickstart.md, and GitHub Actions CI workflow in `.github/workflows/ci.yml` (lint, test backend + frontend, build)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Database & Schema

- [x] T006 Create complete Prisma schema with all 26 entities (User, Plant, Machine, Worker, ZipperVariant, GrainType, ProductionEntry, ScrapSale, RawMaterialPurchase, RawMaterialStock, FinishedGoodsStock, Client, ClientRate, GatePass, GatePassLineItem, Order, Account, JournalEntry, JournalEntryLine, Voucher, ExpenseCategory, Company, Notification, AuditLog, SystemSetting, plus production_entry_workers join table), all enums (Role, Shift, GatePassStatus, OrderStatus, ApprovalStatus, PaymentMode, PurchaseSource, AccountType, JournalEntryStatus, NotificationType, AuditAction), audit fields, versioning, and unique constraints in `backend/prisma/schema.prisma`
- [x] T007 Create initial database migration including the PostgreSQL `BEFORE INSERT OR UPDATE` trigger on `journal_entries` that enforces `SUM(debit_amount) = SUM(credit_amount)` when status transitions to POSTED, and required performance indexes in `backend/prisma/migrations/`
- [x] T008 Create comprehensive seed data with 2 plants, machines with kWh ratings, ~10 workers, ~10 zipper variants, ~10 grain types, full chart of accounts (per research.md R2), 8 expense categories with sub-categories, 2–3 companies, 5–6 users (one per role), ~5–10 sample clients with varied payment cycles, and system settings (electricity threshold 15%, voucher approval PKR 2L, QR expiry 48h) in `backend/prisma/seed.ts`

### Backend Core

- [x] T009 [P] Create Express application setup with CORS, cookie-parser, helmet, JSON body parsing, and server entry point in `backend/src/app.ts`; create database config in `backend/src/config/database.ts`, app config (JWT secret, port, CORS origin) in `backend/src/config/app.ts`, and RBAC permission declarations mapping roles to allowed endpoints in `backend/src/config/roles.ts`
- [x] T010 [P] Create TypeScript type definitions for request/response DTOs, pagination, API responses, and shared interfaces in `backend/src/types/`
- [x] T011 [P] Implement backend utility functions: PKR currency formatting with South Asian grouping (paisa→rupees, shorthand Cr/L) in `backend/src/utils/currency.ts`, date utilities (PKT UTC+5, DD-MM-YYYY display, ISO-8601 storage) in `backend/src/utils/date.ts`, business formulas (raw material consumption: gramsPerMeter × meters ÷ bagWeight; electricity discrepancy: deviation % from machine kWh × hours) in `backend/src/utils/formulas.ts`, role-based field serializer (strips financial fields for PRODUCTION_HEAD and MARKETING_HEAD) in `backend/src/utils/serializer.ts`, and sequential number generator (GP-YYYY-NNNNN, ORD-YYYY-NNNNN, VCH-YYYY-NNNNN) in `backend/src/utils/sequence.ts`
- [x] T012 Implement JWT httpOnly cookie authentication middleware (extract token from cookie, verify JWT, attach user to request) in `backend/src/middleware/auth.middleware.ts` and RBAC middleware (validate requesting user's role against endpoint's allowed roles per config/roles.ts) in `backend/src/middleware/rbac.middleware.ts`
- [x] T013 [P] Implement error handler middleware with structured error responses (`{ error: { code, message, details } }`) in `backend/src/middleware/error-handler.middleware.ts`, request validation middleware (validate body/query/params against schemas) in `backend/src/middleware/validation.middleware.ts`, and audit logging middleware in `backend/src/middleware/audit.middleware.ts`
- [x] T014 Implement auth service (kiosk login by userId — generate JWT with userId/role/name, set httpOnly cookie; logout — clear cookie; get current user from JWT) with controller and routes per `contracts/auth.md` in `backend/src/services/auth.service.ts`, `backend/src/controllers/auth.controller.ts`, and `backend/src/routes/auth.routes.ts`
- [x] T015 [P] Implement audit service (record CREATE/UPDATE/SOFT_DELETE actions with previous/new value JSON snapshots, changed fields list, acting userId) in `backend/src/services/audit.service.ts` and base notification service (create notification by userId or role, list with unread filter, mark read, mark all read, get unread count) in `backend/src/services/notification.service.ts`
- [x] T016 Implement accounting service for double-entry journal entries: create journal entry with lines (debit/credit), validate balance, post entry (triggers DB balance check), reverse entry; support reference linking (gate_pass, expense_voucher, payment, scrap_sale, raw_material_purchase) in `backend/src/services/accounting.service.ts`
- [x] T017 Create API route index mounting all module routers under `/api/v1/` prefix, plus notification routes (GET list, PATCH read, PATCH read-all, GET unread-count) in `backend/src/routes/index.ts`

### Frontend Core

- [x] T018 [P] Create frontend application shell with React Router v6 nested layouts, route definitions for all modules (Dashboard, Production, Inventory, GatePass, Orders, Finance, Settings, Login), role-based route guard component (`<RoleGuard roles={[...]}>`), and 404 page in `frontend/src/App.tsx`, `frontend/src/main.tsx`, and `frontend/src/router.tsx`
- [x] T019 [P] Create frontend layout components: collapsible Sidebar with role-based navigation (shows only permitted modules per role), Header with user name display and NotificationBell (unread count badge, dropdown with notification list, mark-as-read), and MobileNav (bottom navigation for 375px viewport) in `frontend/src/components/layout/`
- [x] T020 [P] Create base Axios API instance with httpOnly cookie credentials, request/response interceptors for error handling, and 401 redirect in `frontend/src/services/api.ts`; create AuthContext provider with login/logout/currentUser state in `frontend/src/context/AuthContext.tsx`; create useAuth hook in `frontend/src/hooks/useAuth.ts`, useRole hook (permission checking) in `frontend/src/hooks/useRole.ts`, useSmartQuery hook with visibility-aware polling intervals (5s for inventory/finance, 30s for dashboard, 60s for lists) in `frontend/src/hooks/useSmartQuery.ts`, and useNotifications hook in `frontend/src/hooks/useNotifications.ts`; create NotificationContext in `frontend/src/context/NotificationContext.tsx`
- [x] T021 [P] Create reusable UI components: DataTable with sorting, pagination, filters, and mobile card-layout alternative (touch targets ≥ 44×44px); KPICard with trend indicator; Modal and Drawer overlays; ConfirmDialog for destructive actions; StatusBadge for gate pass/order/voucher statuses in `frontend/src/components/ui/`
- [x] T022 [P] Create form components: CurrencyInput accepting "2,00,000" or "2L" or "1.5Cr" with paisa conversion; DatePicker displaying DD-MM-YYYY in PKT; VariantSelect dropdown from API; ClientSelect dropdown; GrainTypeSelect dropdown; WorkerMultiSelect in `frontend/src/components/forms/`
- [x] T023 [P] Create frontend utility functions: PKR currency formatter (matching backend `formatPaisaToRupees`) in `frontend/src/utils/currency.ts`, PKT date formatter in `frontend/src/utils/date.ts`, app constants (API polling intervals, pagination defaults) in `frontend/src/utils/constants.ts`, and externalized UI strings for future Urdu support in `frontend/src/locales/en.json`
- [x] T024 Create login/user selection page (kiosk mode — displays list of active users, user taps their name to log in, no password) calling `GET /api/v1/auth/users` and `POST /api/v1/auth/login` in `frontend/src/pages/Login/`

**Checkpoint**: Foundation ready — user story implementation can now begin

---

## Phase 3: User Story 1 — Production Data Entry & Daily Progress Report (Priority: P1) 🎯 MVP

**Goal**: Enable a production operator to record shift-level output (plant, shift, date, workers, variant, meters, grams/meter, electricity, scrap) and generate a real-time Daily Progress Report viewable on mobile.

**Independent Test**: Submit a shift's production data and verify the DPR displays with correct totals, raw material consumption calculation, electricity validation flag, and scrap tracking — without requiring any other module.

### Implementation for User Story 1

- [x] T025 [US1] Implement production service: create production entry with atomic side effects (auto-calculate raw material consumed via gramsPerMeter × metersProduced, deduct from RawMaterialStock, increase FinishedGoodsStock, validate electricity against machine kWh rating, flag discrepancy if deviation > threshold, enforce unique plant+shift+date constraint), DPR aggregation queries (per shift, per plant, grand totals), scrap sale recording with journal entry (Debit Cash → Credit Scrap Revenue), discrepancy listing, and Super Admin edit with version/ETag checking in `backend/src/services/production.service.ts`
- [x] T026 [US1] Implement production controller with all endpoints per `contracts/production.md` (GET/POST entries, GET/PUT entry by ID, GET DPR, GET/POST scrap-sales, GET discrepancies, GET plants/workers/variants lookups) and create production routes in `backend/src/controllers/production.controller.ts` and `backend/src/routes/production.routes.ts`
- [x] T027 [P] [US1] Create production API service wrapping all production endpoints with typed request/response in `frontend/src/services/production.api.ts`
- [x] T028 [US1] Create production entry form page: plant selector, shift selector, date picker, worker multi-select, variant dropdown, meters input, grams/meter input, electricity start/end readings (auto-calculate units), scrap weight input; with contextual defaults (today's date, logged-in user's plant) and field validation in `frontend/src/pages/Production/ProductionEntryForm.tsx`
- [x] T029 [P] [US1] Create production entries list page with DataTable (columns: date, plant, shift, variant, meters, electricity, scrap, discrepancy flag), filters (plant, shift, date range, variant), pagination, and mobile card layout in `frontend/src/pages/Production/ProductionEntries.tsx`
- [x] T030 [P] [US1] Create Daily Progress Report page showing per-plant, per-shift breakdown with meters produced, variants, electricity units, scrap grams, workers, discrepancy flags, and grand total; with date navigation and auto-refresh via useSmartQuery in `frontend/src/pages/Production/DailyProgressReport.tsx`
- [x] T031 [P] [US1] Create scrap sales page with list of monthly scrap sales and create form (date, weight kg, rate/kg in PKR, buyer name optional, auto-calculate total) in `frontend/src/pages/Production/ScrapSales.tsx`
- [x] T032 [P] [US1] Create electricity discrepancy alerts page (Super Admin only) showing flagged entries with expected vs actual units, deviation %, and link to production entry in `frontend/src/pages/Production/Discrepancies.tsx`

**Checkpoint**: User Story 1 fully functional — operator can record production, DPR is viewable on mobile in real time

---

## Phase 4: User Story 2 — Raw Material Procurement & Consumption Tracking (Priority: P2)

**Goal**: Track raw material purchases (plastic grain bags by type and source), auto-calculate consumption from production entries, maintain running stock, and trigger low-stock alerts.

**Independent Test**: Record a raw material purchase (100 bags of Type A), enter production data consuming a known quantity, verify stock decreases correctly and a low-stock alert fires at threshold.

### Implementation for User Story 2

- [ ] T033 [US2] Implement inventory service: record raw material purchase with atomic stock increase and journal entry (Debit Raw Material Inventory → Credit Cash/AP), query raw material and finished goods stock levels, generate consumption vs procurement report (purchased bags, consumed bags, net change, weighted average cost per grain type for a period), detect low-stock conditions and create notifications in `backend/src/services/inventory.service.ts`
- [ ] T034 [US2] Implement inventory controller with all endpoints per `contracts/inventory.md` (GET finished-goods, GET raw-materials, GET/POST raw-materials/purchases, GET consumption-report, PUT threshold endpoints) and create inventory routes in `backend/src/controllers/inventory.controller.ts` and `backend/src/routes/inventory.routes.ts`
- [ ] T035 [P] [US2] Create inventory API service wrapping all inventory endpoints with typed request/response in `frontend/src/services/inventory.api.ts`
- [ ] T036 [US2] Create raw material stock overview page showing current bags per grain type, low-stock threshold, alert status, and last-updated timestamp with 5-second polling via useSmartQuery in `frontend/src/pages/Inventory/RawMaterialStock.tsx`
- [ ] T037 [P] [US2] Create raw material purchase form (grain type dropdown, number of bags, rate per bag in PKR, purchase date, source: Container/Spot Market; auto-calculate total) and purchase history list with filters (grain type, source, date range) in `frontend/src/pages/Inventory/PurchaseForm.tsx`
- [ ] T038 [P] [US2] Create finished goods stock overview page showing current meters per variant, low-stock threshold, alert status with 5-second polling in `frontend/src/pages/Inventory/FinishedGoodsStock.tsx`
- [ ] T039 [US2] Create consumption vs procurement report page with period selector (current month, last month, last 3 months, custom) showing purchased vs consumed bags per grain type, net change, current stock, and weighted average cost in `frontend/src/pages/Inventory/ConsumptionReport.tsx`
- [ ] T040 [US2] Wire low-stock alert notifications: when raw material stock falls below grain type threshold or finished goods stock falls below variant threshold after any stock-modifying operation, create notification targeting SUPER_ADMIN in `backend/src/services/inventory.service.ts`

**Checkpoint**: User Stories 1 AND 2 both work — production entry auto-consumes raw material, stock levels are tracked

---

## Phase 5: User Story 3 — Gate Pass Creation & Automated Stock/Ledger Updates (Priority: P3)

**Goal**: Digitize gate pass creation with atomic side effects — deduct finished goods stock, create client ledger debit via double-entry journal entry, set payment due date based on client's payment cycle, generate printable PDF with QR code for delivery confirmation.

**Independent Test**: Create a gate pass for a client with 2 variants, verify stock deduction, ledger debit creation, payment due date, printable PDF output, and QR scan verification flow.

### Implementation for User Story 3

- [ ] T041 [US3] Implement gate pass service: create gate pass in a single `prisma.$transaction()` that (a) validates stock sufficiency per variant, (b) deducts FinishedGoodsStock per line item, (c) looks up active ClientRate per client-variant pair, (d) creates journal entry (Debit AR client sub-ledger → Credit Sales Revenue) via accounting service, (e) calculates paymentDueDate = date + client.paymentCycleDays, (f) generates crypto-random verifyToken (64 chars, 48h expiry), (g) if orderId linked — updates Order.metersDelivered and auto-completes if fully delivered; also implement QR verification endpoint (validate token, check expiry, mark RECEIVED with timestamp, idempotent for re-scans), status transition (CREATED → DISPATCHED → RECEIVED), and gate pass listing with role-based financial field stripping in `backend/src/services/gate-pass.service.ts`
- [ ] T042 [US3] Implement gate pass controller with all endpoints per `contracts/gate-pass.md` (GET list, POST create, GET by ID, PATCH status, POST verify — public, GET PDF data) and create gate pass routes in `backend/src/controllers/gate-pass.controller.ts` and `backend/src/routes/gate-pass.routes.ts`
- [ ] T043 [P] [US3] Create gate pass API service wrapping all gate pass endpoints with typed request/response in `frontend/src/services/gate-pass.api.ts`
- [ ] T044 [US3] Create gate pass creation form: client dropdown, date, issuing manager name, shift selector, optional order link, dynamic line items table (add/remove variant rows with variant dropdown + meters input, auto-display rate and line total from ClientRate), total amount display, stock availability indicator per variant, and submit with confirmation dialog in `frontend/src/pages/GatePass/GatePassForm.tsx`
- [ ] T045 [P] [US3] Create gate pass list page with DataTable (columns: GP number, client, date, shift, status badge, variants summary, total amount, payment due), search by GP number, filters (client, status, date range, shift), and mobile card layout in `frontend/src/pages/GatePass/GatePassList.tsx`
- [ ] T046 [P] [US3] Create gate pass detail page showing full gate pass data, line items table, status history, stock impact summary, journal entry reference, and action buttons (mark Dispatched, print/download PDF) in `frontend/src/pages/GatePass/GatePassDetail.tsx`
- [ ] T047 [US3] Implement gate pass PDF generation with @react-pdf/renderer: A4 layout with company header, client details, date, GP number, line items table (variant, meters, rate, amount), total, payment due date, and QR code (generated via qrcode.react `toDataURL()` encoding verify URL) in `frontend/src/pages/GatePass/GatePassPDF.tsx`
- [ ] T048 [US3] Create QR verification landing page (public route, no auth): accepts token from URL params, calls `POST /api/v1/gate-passes/verify`, displays confirmation ("Gate Pass #GP-2025-001 Received ✓" with details) or error (expired, already received with timestamp) in `frontend/src/pages/GatePass/VerifyGatePass.tsx`

**Checkpoint**: Gate passes create atomic stock + ledger updates, PDF with QR works end-to-end

---

## Phase 6: User Story 4 — Order Management with Finance Approval & Production Notification (Priority: P4)

**Goal**: Finance team enters orders (client, variant, meters, rate, deadline), production manager gets rate-hidden notification, order dashboard tracks fulfillment as gate passes are created, auto-completes when fully delivered.

**Independent Test**: Enter an order, verify production manager notification (no rate visible), partially fulfill via gate pass, see order status update to "Ongoing", and auto-complete when fully delivered.

### Implementation for User Story 4

- [ ] T049 [US4] Implement order service: create order (validate client, variant, rate, deadline), on creation send notification to PRODUCTION_HEAD role (include client name, variant, meters, deadline — explicitly EXCLUDE rate and all financial fields), query orders with fulfillment tracking (metersOrdered vs metersDelivered, fulfillmentPercent), auto-status transitions (PENDING → ONGOING on first delivery, ONGOING → COMPLETED when metersDelivered ≥ metersOrdered), client order history, fulfillment report with summary statistics in `backend/src/services/order.service.ts`
- [ ] T050 [US4] Implement order controller with all endpoints per `contracts/orders.md` (GET list with role-based field stripping, POST create — FINANCE_HEAD/SUPER_ADMIN only, GET by ID, GET by-client/:clientId, GET fulfillment-report) and create order routes in `backend/src/controllers/order.controller.ts` and `backend/src/routes/order.routes.ts`
- [ ] T051 [P] [US4] Create order API service wrapping all order endpoints with typed request/response in `frontend/src/services/order.api.ts`
- [ ] T052 [US4] Create order entry form (Finance Head/Super Admin only): client dropdown with current outstanding balance displayed prominently, variant dropdown, meters ordered, rate per meter (CurrencyInput), delivery deadline date picker, auto-calculate total amount; validation and submit in `frontend/src/pages/Orders/OrderForm.tsx`
- [ ] T053 [P] [US4] Create order dashboard page with DataTable (columns: order number, client, variant, meters ordered, meters delivered, fulfillment %, deadline, status badge, overdue indicator), filters (client, status, variant, overdue), summary cards (total/pending/ongoing/completed/overdue counts) in `frontend/src/pages/Orders/OrderDashboard.tsx`
- [ ] T054 [P] [US4] Create order detail page showing order info, delivery history (linked gate passes with dates and meters), fulfillment progress bar, and timeline in `frontend/src/pages/Orders/OrderDetail.tsx`
- [ ] T055 [P] [US4] Create client order history page (accessible by clicking client name) showing all orders from first order onwards with status and fulfillment in `frontend/src/pages/Orders/ClientOrderHistory.tsx`

**Checkpoint**: Orders flow through the system — finance enters, production gets notified (no rates), gate passes fulfill orders

---

## Phase 7: User Story 5 — Client Ledger & Payment Tracking (Priority: P5)

**Goal**: Maintain running debit/credit ledger per client — debits auto-created from gate passes, credits manually recorded as payments, outstanding balance calculated, overdue items highlighted with days-overdue counter, rates manageable and historically preserved.

**Independent Test**: Create a client, generate a gate pass (auto-debit), record a payment (credit), verify outstanding balance, overdue highlighting, and downloadable ledger.

### Implementation for User Story 5

- [ ] T056 [US5] Implement finance service: client ledger queries (all debit/credit entries with running balance from JournalEntryLine where clientId matches, with pagination and date filters), payment recording (create journal entry: Debit Cash/Bank → Credit AR client sub-ledger, record payment mode/cheque number), overdue detection (entries past client.paymentCycleDays with daysOverdue counter), client rate management (archive old rate with effectiveTo=now, insert new rate with effectiveFrom=now), clients list with aggregated outstanding/overdue amounts, ledger download data, and 5-second polling support on financial endpoints in `backend/src/services/finance.service.ts`
- [ ] T057 [US5] Implement finance controller with client ledger endpoints per `contracts/finance.md` (GET clients with balances, GET client ledger, GET client ledger download as PDF/CSV, POST client payments, GET overdue list, GET/PUT client rates) and create finance routes in `backend/src/controllers/finance.controller.ts` and `backend/src/routes/finance.routes.ts`
- [ ] T058 [P] [US5] Create finance API service wrapping all finance endpoints with typed request/response in `frontend/src/services/finance.api.ts`
- [ ] T059 [US5] Create client list page with DataTable showing client name, payment cycle, total debits (PKR), total credits (PKR), outstanding balance (PKR), overdue amount (PKR, red if > 0), max days overdue; filters (hasOverdue, search by name), sortable columns, 5-second polling in `frontend/src/pages/Finance/ClientLedger/ClientList.tsx`
- [ ] T060 [US5] Create client ledger detail page: client info header (name, payment cycle), summary cards (total debits, total credits, outstanding), chronological transaction list (date, type badge debit/credit, description with GP reference or payment details, amount, running balance), overdue entries highlighted in red with "X days overdue" badge, date range filter, debit/credit filter in `frontend/src/pages/Finance/ClientLedger/LedgerDetail.tsx`
- [ ] T061 [P] [US5] Create payment recording form: amount (CurrencyInput), date (DatePicker), payment mode radio (Cash/Cheque/Bank Transfer), cheque number (conditionally required for Cheque), notes field; confirmation dialog showing updated outstanding balance in `frontend/src/pages/Finance/ClientLedger/PaymentForm.tsx`
- [ ] T062 [P] [US5] Create overdue payments list page showing all overdue entries across all clients: client name, GP number, amount (PKR), due date, days overdue; sortable by days overdue, amount, or client; with summary total in `frontend/src/pages/Finance/ClientLedger/OverduePayments.tsx`
- [ ] T063 [US5] Implement client ledger download: generate PDF (using @react-pdf/renderer — client header, full transaction table with running balance, summary) and CSV export triggered from ledger detail page in `frontend/src/pages/Finance/ClientLedger/LedgerDownload.tsx`
- [ ] T064 [US5] Create client rate management page: display current active rates per variant (rate, effectiveFrom), historical rate timeline, update rate form (select variant, enter new rate in PKR — archives old rate, creates new effective immediately) in `frontend/src/pages/Finance/ClientLedger/RateManagement.tsx`

**Checkpoint**: Complete client financial picture — auto-debits from gate passes, manual payments, overdue tracking, rate history

---

## Phase 8: User Story 6 — Expense & Voucher Management with Approval Workflow (Priority: P6)

**Goal**: Record all company expenses as vouchers with categories, enforce super admin approval for amounts ≥ PKR 2,00,000, auto-approve below threshold, generate monthly financial report with category-wise breakdown.

**Independent Test**: Create vouchers at various amounts, verify approval workflow triggers for ≥ PKR 2L, generate monthly report with category breakdowns.

### Implementation for User Story 6

- [ ] T065 [US6] Extend finance service with voucher operations: create voucher (auto-approve if amountPaisa < 20000000, set PENDING and send notification to SUPER_ADMIN if ≥ 20000000), approve/reject voucher (SUPER_ADMIN only — on approval create journal entry: Debit Expense Account → Credit Cash/Bank, post entry), voucher listing with filters, monthly financial report aggregation (opening balance, total inflow from client payments + scrap sales, total outflow from approved vouchers, closing balance, category-wise expense breakdown) in `backend/src/services/finance.service.ts`
- [ ] T066 [US6] Extend finance controller with voucher endpoints per `contracts/finance.md` (GET vouchers list, POST create voucher, PATCH approve/reject, GET monthly report) and add to finance routes in `backend/src/controllers/finance.controller.ts` and `backend/src/routes/finance.routes.ts`
- [ ] T067 [US6] Create voucher creation form: title, description, date (DatePicker), amount (CurrencyInput), expense category (tree dropdown with sub-categories), payment mode (Cash/Cheque — if Cheque, cheque number field appears), company dropdown; display "Requires owner approval" warning when amount ≥ PKR 2L in `frontend/src/pages/Finance/Vouchers/VoucherForm.tsx`
- [ ] T068 [P] [US6] Create voucher list page with DataTable (columns: voucher number, title, date, amount PKR, category, payment mode, company, approval status badge), filters (category, company, status, date range, payment mode), pagination in `frontend/src/pages/Finance/Vouchers/VoucherList.tsx`
- [ ] T069 [US6] Create voucher approval page (Super Admin only): pending vouchers queue with full details, approve button with optional comment, reject button with required comment field, approved/rejected history in `frontend/src/pages/Finance/Vouchers/VoucherApproval.tsx`
- [ ] T070 [US6] Create monthly financial report page: month/year selector, optional company filter, display opening balance, total inflow (with client payments + scrap sales breakdown), total outflow, closing balance, and category-wise expense breakdown bar chart/table; all amounts in PKR with South Asian formatting in `frontend/src/pages/Finance/Reports/MonthlyReport.tsx`
- [ ] T071 [US6] Wire voucher approval notification: when voucher ≥ PKR 2L is created, send notification to all SUPER_ADMIN users with voucher title, amount, and category; when approved/rejected, notify creating user in `backend/src/services/finance.service.ts`

**Checkpoint**: Complete finance module — client ledger + vouchers + approval workflow + monthly reports

---

## Phase 9: User Story 7 — Owner Dashboard & Real-Time Monitoring (Priority: P7)

**Goal**: Modern SaaS-style analytics dashboard with KPI cards, interactive charts (production trends, shift comparison, revenue, stock levels, overdue payments), recent activity feed, and full mobile responsiveness.

**Independent Test**: Populate sample data across all modules, verify KPI cards, all charts, and activity feed display correctly on both desktop and 375px mobile viewport with interactive tooltips.

### Implementation for User Story 7

- [ ] T072 [US7] Implement dashboard service: KPI aggregation (today's production meters with trend, pending orders count with trend, overdue payments total with trend, total stock meters with trend, active gate passes today), production trend data (daily/weekly/monthly meters by plant, by shift, by variant for 7d/30d/90d/12m periods), shift comparison (Day vs Night totals + daily breakdown), revenue overview (monthly inflow vs outflow for selected year), stock levels per variant, overdue payments grouped by client (amount, percentage of total, max days overdue), recent activity feed (latest gate passes, orders, vouchers, production entries — reverse chronological), recent gate passes feed in `backend/src/services/dashboard.service.ts`
- [ ] T073 [US7] Implement dashboard controller with all endpoints per `contracts/dashboard.md` (GET kpis, GET production-trend, GET shift-comparison, GET revenue-overview, GET stock-levels, GET overdue-payments, GET recent-activity, GET recent-gate-passes) with role-based financial field stripping, and create dashboard routes in `backend/src/controllers/dashboard.controller.ts` and `backend/src/routes/dashboard.routes.ts`
- [ ] T074 [P] [US7] Create dashboard API service wrapping all dashboard endpoints with typed request/response in `frontend/src/services/dashboard.api.ts`
- [ ] T075 [US7] Create dashboard page layout: 4 KPI cards (production, pending orders, overdue payments PKR, total stock) in a responsive grid (4-across on desktop, 2×2 on mobile), section titles, and chart container slots; 30-second polling via useSmartQuery in `frontend/src/pages/Dashboard/DashboardPage.tsx`
- [ ] T076 [P] [US7] Create ProductionTrendChart: Recharts line/area chart with daily data points, period selector (7d/30d/90d/12m), plant filter dropdown, variant filter dropdown, hover tooltips with exact values in `frontend/src/components/charts/ProductionTrendChart.tsx`
- [ ] T077 [P] [US7] Create ShiftComparisonChart: Recharts side-by-side bar chart comparing Day vs Night shift output with daily breakdown, period selector, plant filter in `frontend/src/components/charts/ShiftComparisonChart.tsx`
- [ ] T078 [P] [US7] Create RevenueChart: Recharts bar chart showing monthly inflow vs outflow for selected year with hover tooltips showing PKR amounts in `frontend/src/components/charts/RevenueChart.tsx`
- [ ] T079 [P] [US7] Create StockLevelChart: Recharts horizontal bar chart showing current meters per variant with low-stock threshold line indicator in `frontend/src/components/charts/StockLevelChart.tsx`
- [ ] T080 [P] [US7] Create OverduePaymentsChart: Recharts donut/pie chart showing overdue amounts by client with percentages and hover tooltips in PKR in `frontend/src/components/charts/OverduePaymentsChart.tsx`
- [ ] T081 [US7] Create recent gate passes feed (last 10 — GP number, client, variants summary, total meters, status, timestamp, created by) and recent activity feed (last 20 — mixed gate passes, orders, vouchers, production entries with type icons, descriptions, timestamps, actors) in `frontend/src/pages/Dashboard/RecentActivity.tsx`
- [ ] T082 [US7] Apply mobile-responsive dashboard layout: charts stack vertically on 375px, KPI cards 2×2 grid, all touch targets ≥ 44×44px, chart tooltips work on touch, scroll behavior optimized for mobile in `frontend/src/pages/Dashboard/DashboardPage.tsx`

**Checkpoint**: Owner can monitor entire factory from mobile — production, orders, finance, stock, dispatches

---

## Phase 10: User Story 8 — User Roles, Access Control & System Administration (Priority: P8)

**Goal**: Super Admin can manage all system configuration (users, clients, categories, variants, grain types, plants, machines, workers, system settings), sidebar adapts per role, financial data is completely hidden from Production/Marketing at the API level.

**Independent Test**: Create users for each role, log in with each, verify correct modules are visible, financial data hidden from production, only Super Admin can edit saved records.

### Implementation for User Story 8

- [ ] T083 [US8] Implement settings controller with full CRUD endpoints per `contracts/settings.md`: user management (list, create, update, deactivate — SUPER_ADMIN only), client management (list, create, update with rates — SUPER_ADMIN/FINANCE_HEAD), expense category management (tree CRUD — SUPER_ADMIN only), variant and grain type management (list, create, update — SUPER_ADMIN only), plant and machine management (list, update plant, add/update machine — SUPER_ADMIN only), worker management (list, create, update — SUPER_ADMIN only), system settings (list, update key-value — SUPER_ADMIN only) in `backend/src/controllers/settings.controller.ts`
- [ ] T084 [US8] Create settings routes in `backend/src/routes/settings.routes.ts`
- [ ] T085 [P] [US8] Create settings API service wrapping all settings endpoints with typed request/response in `frontend/src/services/settings.api.ts`
- [ ] T086 [US8] Create user management page (Super Admin only): user list with name, role badge, active status, last login; create user form (name, role dropdown); edit user (name, role, active toggle); deactivate with confirmation in `frontend/src/pages/Settings/UserManagement.tsx`
- [ ] T087 [P] [US8] Create client management page (Super Admin/Finance Head): client list, create client form (name, contact person, phone, address, payment cycle days, initial rates per variant), edit client details in `frontend/src/pages/Settings/ClientManagement.tsx`
- [ ] T088 [P] [US8] Create expense category management page (Super Admin only): tree view with parent/child categories, add category (name, optional parent), edit name, deactivate (blocked if active vouchers reference it) in `frontend/src/pages/Settings/ExpenseCategories.tsx`
- [ ] T089 [P] [US8] Create variant and grain type management page (Super Admin only): variants list (code, name, standardGramsPerMeter, grainType), create/edit variant; grain types list (code, name, bagWeightGrams, lowStockThreshold), create/edit grain type in `frontend/src/pages/Settings/VariantGrainManagement.tsx`
- [ ] T090 [P] [US8] Create plant, machine, and worker management page (Super Admin only): plants with nested machines (identifier, kWhRating, expectedOutputPerShift), add/edit machines; workers list (name, designation, plant assignment, active status), create/edit workers in `frontend/src/pages/Settings/PlantWorkerManagement.tsx`
- [ ] T091 [US8] Create system settings page (Super Admin only): editable key-value list for electricity discrepancy threshold (%), voucher approval threshold (PKR), QR token expiry (hours) with validation and save in `frontend/src/pages/Settings/SystemSettings.tsx`
- [ ] T092 [US8] Finalize role-based sidebar navigation: dynamically show/hide menu items per role (Super Admin sees all; Finance Head sees Orders, Ledger, Vouchers, Stock read-only; Production Head sees Production, Stock; Logistics Head sees Gate Pass, Stock read-only; Marketing Head sees Orders read-only, Clients read-only), and enforce route guards redirecting unauthorized access in `frontend/src/components/layout/Sidebar.tsx` and `frontend/src/router.tsx`
- [ ] T093 [US8] Verify and finalize role-based field stripping: ensure all API responses strip financial fields (rate, amount, ledger balance) for PRODUCTION_HEAD and MARKETING_HEAD roles across orders, gate passes, and dashboard endpoints; implement append-only enforcement (non-Super Admin users cannot PUT/DELETE existing records) in `backend/src/utils/serializer.ts` and relevant controllers

**Checkpoint**: All roles enforced, settings manageable, system fully administrable

---

## Phase 11: Polish & Cross-Cutting Concerns

**Purpose**: Offline resilience, testing, deployment infrastructure, security, and performance

### Offline Queue

- [ ] T094 [P] Implement IndexedDB-based offline mutation queue: MutationQueueService class (queue, peek, dequeue, markConflict), Axios interceptor to catch network errors on write operations and store in IndexedDB, FIFO replay on reconnect with ETag/version conflict detection, ConflictResolutionDialog (shows server vs queued value — user picks), visible offline banner with queued operation count, max queue size 50 in `frontend/src/hooks/useOfflineQueue.ts`

### Testing Infrastructure

- [ ] T095 [P] Create backend test setup: Jest 29 config with TypeScript, test database connection (DATABASE_URL_TEST), beforeAll migrations, afterEach table truncation, afterAll disconnect, and Prisma mock utilities in `backend/tests/setup.ts` and `backend/jest.config.ts`
- [ ] T096 [P] Create frontend test setup: Vitest config with React Testing Library, MSW mock server setup for API mocking in `frontend/tests/setup.ts` and `frontend/vitest.config.ts`

### Backend Tests

- [ ] T097 Write backend unit tests: raw material consumption formula, electricity discrepancy detection, PKR currency formatting (paisa→rupees, South Asian grouping, shorthand), date formatting (PKT timezone, DD-MM-YYYY), sequence number generation in `backend/tests/unit/formulas.test.ts`, `backend/tests/unit/currency.test.ts`, `backend/tests/unit/date.test.ts`, and `backend/tests/unit/electricity-validation.test.ts`
- [ ] T098 Write integration test for gate pass atomic flow: create gate pass → verify stock deduction per variant → verify journal entry created with balanced debits/credits → verify payment due date → verify order fulfillment update → test insufficient stock rejection → test concurrent stock deduction handling in `backend/tests/integration/gate-pass-flow.test.ts`
- [ ] T099 Write integration test for production → consumption flow: create production entry → verify raw material stock decreased → verify finished goods stock increased → test duplicate entry rejection → test electricity discrepancy flagging in `backend/tests/integration/production-consumption.test.ts`
- [ ] T100 Write integration test for payment → ledger flow: create gate pass (auto-debit) → record payment (credit) → verify outstanding balance → verify overdue detection after payment cycle expires → verify rate change only affects future transactions in `backend/tests/integration/payment-ledger.test.ts`
- [ ] T101 Write integration test for voucher approval workflow: create voucher < PKR 2L (auto-approve) → create voucher ≥ PKR 2L (PENDING) → approve → verify journal entry created → reject with comment → verify notification sent in `backend/tests/integration/voucher-approval.test.ts`

### Deployment Infrastructure

- [ ] T102 [P] Create Nginx reverse proxy configuration: proxy `/api/` to backend:3001, serve frontend static files, gzip compression, security headers in `nginx/default.conf`
- [ ] T103 [P] Create backend Dockerfile: Node.js 20 LTS, install deps, generate Prisma client, build TypeScript, production CMD in `backend/Dockerfile`
- [ ] T104 [P] Create frontend Dockerfile: Node.js 20 for build stage, Nginx for serve stage, copy built assets in `frontend/Dockerfile`

### Security & Performance

- [ ] T105 Apply security hardening: express-rate-limit on auth and verification endpoints, finalize CORS allowed origins, ensure helmet security headers, sanitize user inputs, verify httpOnly/secure cookie flags for production in `backend/src/app.ts`
- [ ] T106 Add performance indexes for polling queries: `idx_inventory_updated_at` on finished_goods_stock, `idx_raw_material_updated_at` on raw_material_stock, `idx_ledger_entry_updated_at` on journal_entry_lines, composite indexes for common filter patterns (gate passes by client+date, orders by client+status) in `backend/prisma/migrations/`
- [ ] T107 Code cleanup: consistent error messages across all controllers, TypeScript strict mode audit, remove unused imports, verify all API responses match contract schemas
- [ ] T108 Run quickstart.md validation end-to-end: follow every step from clone → docker-compose up → npm install → prisma migrate → seed → dev servers → verify login → verify one operation per module → verify tests pass

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — **BLOCKS all user stories**
- **User Stories (Phase 3–10)**: All depend on Foundational phase completion
  - User stories can then proceed in priority order (P1 → P2 → P3 → ...)
  - Some stories can be parallelized (see below)
- **Polish (Phase 11)**: Depends on all desired user stories being complete

### User Story Dependencies

- **US1 (P1) — Production**: Can start immediately after Phase 2. No story dependencies.
- **US2 (P2) — Raw Material**: Can start after Phase 2. Tight coupling with US1 (production consumes raw material), but independently testable with seed data.
- **US3 (P3) — Gate Pass**: Depends on US1 (needs finished goods stock from production) and needs accounting service (Phase 2). Core bridge between production and finance.
- **US4 (P4) — Orders**: Can start after Phase 2 with seed data. Gate pass fulfillment tracking tightly integrates with US3.
- **US5 (P5) — Client Ledger**: Depends on US3 (gate passes create auto-debits in ledger). Payment recording is independent.
- **US6 (P6) — Vouchers**: Independent of production/dispatch modules. Only needs accounting service (Phase 2) and expense categories (seeded).
- **US7 (P7) — Dashboard**: Depends on ALL other stories (aggregates data from every module). Should be last before Polish.
- **US8 (P8) — Settings**: RBAC middleware is in Phase 2. Settings UI is independently buildable at any time. Route guard finalization should happen after all pages exist.

### Recommended Execution Order (Single Developer)

```
Phase 1 → Phase 2 → US1 → US2 → US3 → US4 → US5 → US6 → US8 → US7 → Phase 11
```

### Parallel Team Strategy

With multiple developers after Phase 2 completes:

```
Developer A: US1 (Production) → US2 (Raw Material) → US3 (Gate Pass)
Developer B: US4 (Orders) → US5 (Client Ledger) → US6 (Vouchers)
Developer C: US8 (Settings/RBAC) → US7 (Dashboard) → Phase 11 (Polish)
```

### Within Each User Story

1. Backend service first (business logic + side effects)
2. Backend controller + routes (wire up endpoints)
3. Frontend API service (can start in parallel with backend)
4. Frontend pages (depend on API service; multiple pages can be parallel)
5. Story complete before moving to next priority

---

## Parallel Execution Examples

### Phase 2 — Foundational Backend (after T006–T008)

```
# These can run in parallel (different files, no interdependencies):
T009: Express app + configs in backend/src/app.ts, backend/src/config/
T010: TypeScript types in backend/src/types/
T011: Backend utilities in backend/src/utils/
T013: Error/validation/audit middleware in backend/src/middleware/
```

### Phase 2 — Foundational Frontend (after T017)

```
# All frontend foundational tasks can run in parallel:
T018: App shell + router in frontend/src/App.tsx, main.tsx, router.tsx
T019: Layout components in frontend/src/components/layout/
T020: API service + hooks in frontend/src/services/api.ts, frontend/src/hooks/
T021: UI components in frontend/src/components/ui/
T022: Form components in frontend/src/components/forms/
T023: Utils + locale in frontend/src/utils/, frontend/src/locales/
```

### User Story 1 — Frontend Pages (after T027)

```
# After production API service (T027) is created, all pages can be parallel:
T029: Production entries list in frontend/src/pages/Production/ProductionEntries.tsx
T030: DPR page in frontend/src/pages/Production/DailyProgressReport.tsx
T031: Scrap sales page in frontend/src/pages/Production/ScrapSales.tsx
T032: Discrepancies page in frontend/src/pages/Production/Discrepancies.tsx
```

### User Story 7 — Chart Components (after T074)

```
# All chart components are independent files:
T076: ProductionTrendChart in frontend/src/components/charts/ProductionTrendChart.tsx
T077: ShiftComparisonChart in frontend/src/components/charts/ShiftComparisonChart.tsx
T078: RevenueChart in frontend/src/components/charts/RevenueChart.tsx
T079: StockLevelChart in frontend/src/components/charts/StockLevelChart.tsx
T080: OverduePaymentsChart in frontend/src/components/charts/OverduePaymentsChart.tsx
```

### Phase 11 — Testing (after T095–T096)

```
# Backend integration tests are independent files:
T098: Gate pass flow in backend/tests/integration/gate-pass-flow.test.ts
T099: Production consumption in backend/tests/integration/production-consumption.test.ts
T100: Payment ledger in backend/tests/integration/payment-ledger.test.ts
T101: Voucher approval in backend/tests/integration/voucher-approval.test.ts
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (**CRITICAL** — blocks all stories)
3. Complete Phase 3: User Story 1 — Production
4. **STOP and VALIDATE**: Test production entry + DPR independently on mobile
5. Deploy/demo if ready — factory can start recording production data immediately

### Incremental Delivery (Constitution Principle IX — Iterative Delivery)

| Cycle | Stories | Deliverable |
|-------|---------|-------------|
| **Cycle 1** | US1 + US2 | Production & Inventory — operator can record shifts, DPR works, stock tracked |
| **Cycle 2** | US3 | Gate Pass & Dispatch — digital gate passes with QR, automatic stock + ledger |
| **Cycle 3** | US4 + US5 + US6 | Orders, Client Ledger, Expenses — full finance module operational |
| **Cycle 4** | US7 + US8 | Dashboard & Administration — owner monitoring + system configuration |
| **Final** | Phase 11 | Polish — offline queue, tests, deployment, security hardening |

Each cycle produces a working, deployable version with real data flowing through modules.

### Suggested MVP Scope

**User Story 1 (Production)** is the minimum viable product. With just Phase 1 + Phase 2 + Phase 3, the factory owner can:
- Log in via kiosk mode
- Record shift production data
- View Daily Progress Report on mobile
- Track electricity discrepancies
- Record scrap sales

This alone solves the owner's primary concern: "how much was made today?"

---

## Notes

- **[P]** tasks = different files, no dependencies on incomplete tasks — safe to batch
- **[USn]** label maps each task to its user story for traceability
- Each user story is independently completable and testable at its checkpoint
- All monetary values stored as integers (paisa), displayed with PKR prefix and South Asian grouping
- All dates stored ISO-8601 UTC, displayed DD-MM-YYYY in PKT (UTC+5)
- Commit after each task or logical group using Conventional Commits (`feat:`, `fix:`, `test:`, etc.)
- Stop at any checkpoint to validate the story independently before proceeding
- Avoid: vague tasks, same-file conflicts within a phase, cross-story dependencies that break independence

