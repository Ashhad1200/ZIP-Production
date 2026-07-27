# ZIP Production ERP — Feature Reference

**Last updated**: 2026-07-25. This document describes every feature currently implemented in the system, verified against a live local run (schema migrated, seeded, and exercised end-to-end — see the session that produced this doc for the exact verification steps). It covers two layers: the **tenant-facing ERP** (what a factory's staff use day to day) and the **platform layer** (what BD Matrix uses to sell and administer the product as a SaaS).

---

## 1. Tenant ERP

### 1.1 Authentication & access

- **Kiosk-style login** — no passwords. Staff pick their name from a list (`GET /auth/users`), scoped to their organization once multi-tenant (`?org=<slug>`; defaults to the original single-tenant deployment when omitted).
- **Role-based access control**, enforced at both the API (`rbac()` middleware) and the UI route level: **Super Admin**, **Finance Head**, **Production Head**, **Logistics Head**, **Marketing Head**, **HR Head**. Every module declares exactly which roles may read vs. write.
- **Financial-field stripping**: Production Head and Marketing Head never receive rate/amount fields in API responses, even for records they can otherwise see (e.g. a Production Head sees an order's meters and deadline, never its price).
- Session via httpOnly JWT cookie; audit fields (`createdBy`, `updatedBy`, timestamps) are always set server-side from the authenticated user, never trusted from client input.

### 1.2 Dashboard

Cross-module KPIs and trends, role-filtered:
- Headline KPIs, production trend over time, day-shift vs. night-shift comparison
- Revenue overview (Finance roles)
- Stock levels (raw material + finished goods, with low-stock flags)
- Overdue client payments (Finance roles)
- Recent activity feed and recent gate passes

### 1.3 Production

- **Shift-based production entries** (day/night, per plant, per machine): meters produced, weight-per-unit, electricity readings.
- **Automatic raw-material consumption** on entry: computed from the product variant's recipe/ingredient ratios and deducted from raw material stock via **FIFO batch costing** (oldest purchase batch consumed first, at that batch's actual purchase price).
- **Electricity discrepancy detection**: compares actual electricity consumed against an expected value derived from the machine's kWh rating and output, flags entries that deviate beyond a configurable threshold, with a discrepancy queue for review (`/production/discrepancies`).
- **Daily Production Report (DPR)** and entry completion workflow; Super-Admin-only entry unlock for corrections.
- **Scrap tracking**: scrap weight per entry, scrap sales recording, monthly scrap summary, auto-posts to the ledger (Debit Cash / Credit Scrap Sales Revenue).
- **Cost Price Reports**: per-variant cost price (raw material + labor + electricity + overhead allocation) and monthly summary, for margin analysis.
- **Monthly Overheads**: rent, transportation, labor, packing, and miscellaneous costs entered per month, feeding the cost-price and profit/loss calculations.
- Master data: plants, machines, workers, and product variants are all managed here or in Settings and referenced throughout Production.

### 1.4 Inventory

- **Raw material stock**: running balance per raw material type (in bags), low-stock thresholds, purchase recording (container or spot-market source), and a full **FIFO batch view** showing exactly which purchase batches remain and at what cost.
- **Finished goods stock**: running balance per product variant (in meters/units), low-stock thresholds, auto-adjusted by production output and gate-pass dispatch.
- **Packaging material inventory**: stock levels, purchases, and manual adjustments (with purchase/consumption/adjustment reasons), linked to vendors.
- **Consumption report**: raw material usage by variant over a date range, for reconciliation.
- **Electricity rate history**: effective-dated PKR-per-unit rates used in cost calculations, with full history retained (historical entries always cost at the rate that was active then).
- **Vendor management**: grain/raw-material suppliers, with which materials they supply.

### 1.5 Gate Pass (Dispatch)

- **Gate pass creation**: line items per product variant, quantity, and the client's currently active rate (rate is locked at dispatch time — later rate changes never retroactively affect historical gate passes).
- **Atomic side effects on creation** (single DB transaction): finished-goods stock deducted, a journal entry posted (Debit AR / Credit Sales Revenue) to the client's ledger sub-account, payment due date computed from the client's payment-cycle days, and — if linked to an Order — that order's delivered quantity updated (auto-completing the order if fully delivered).
- **QR-verified receipt**: each gate pass gets a crypto-random, time-limited verify token; a public verify page (`/gp-verify`) lets the receiving party scan/confirm receipt and optionally upload a receipt photo, transitioning the gate pass CREATED → DISPATCHED → RECEIVED.
- **PDF generation** for gate passes (client-ready dispatch document).
- **Sales returns**: return line items against a specific gate pass line item, with its own journal entry (reversing the original sale) and return-number sequencing.

### 1.6 Orders

- Client orders with line items per product variant, delivery deadlines, and a fulfillment lifecycle: `PENDING_APPROVAL → PENDING → ONGOING → COMPLETED`, driven automatically by linked gate-pass deliveries.
- Order approval/rejection workflow (Finance/Super Admin).
- Fulfillment report and per-client order history.
- Notifications to Production on order creation (variant + quantity + deadline — deliberately **never** the price, per the financial-field-stripping rule).

### 1.7 Finance

- **Client ledger**: full transaction history per client (debits/credits from gate passes, payments, returns), running outstanding balance, downloadable statement.
- **Payment recording** against a client, updating their outstanding balance.
- **Client rate cards**: effective-dated per-variant rates per client (historical rates preserved for audit).
- **Overdue payments report** — clients past their payment-cycle due date.
- **Expense vouchers**: categorized expenses (factory, director, utilities, transport, raw material, etc., with sub-categories), auto-approved under a configurable threshold (default PKR 2,00,000) or routed to Super Admin for approval above it; each posts a journal entry once approved.
- **Reports**: monthly financial report, full **Profit & Loss** statement (revenue from gate passes − COGS from FIFO production cost − monthly overheads).

### 1.8 Accounting

- Full **chart of accounts** (hierarchical: Assets/Liabilities/Equity/Revenue/Expense, group and leaf accounts).
- **Double-entry journal entries**: every financial event in the system (gate pass, voucher, payroll, scrap sale, raw material purchase, sales return) posts a balanced journal entry (debits = credits enforced), with draft/posted/reversed status and full traceability back to its source document (`referenceType`/`referenceId`).
- **General ledger** view (transactions by account, by date range).
- **Trial balance**.

### 1.9 HR & Payroll

- **Worker records** with salary rate history (effective-dated, so past payroll always reflects the rate that was actually in force).
- **Worker advances**, with recovery tracking (marked recovered, deducted from future payroll).
- **Payroll processing**: monthly payroll per worker (gross salary − advance deduction − other deductions = net), one record per worker per month, posts a journal entry (Debit Salary Expense / Credit Cash-or-Bank).
- Monthly payroll summary report.

### 1.10 Settings (Super Admin / Finance)

Master-data administration for everything above: users & roles, clients, expense categories, companies (legal entities for voucher attribution), product variants, recipes (raw-material mixing ratios), raw material types, plants & machines, workers, and system-wide settings (e.g. electricity discrepancy threshold, voucher approval threshold, verify-token expiry — all admin-configurable rather than hardcoded).

### 1.11 Cross-cutting behavior

- **Mobile-first, responsive** UI (built for a 375px viewport first); the owner's key screens (dashboard, gate pass list, production summary) are designed to be usable entirely from a phone.
- **Offline resilience**: write operations (POST/PUT/PATCH/DELETE) that fail due to a network error are queued client-side (IndexedDB) and replayed automatically on reconnect, with a visible offline banner — data entry is never lost to a dropped connection.
- **Audit logging**: every create/update/soft-delete writes an audit log entry with previous value, new value, changed fields, acting user, and timestamp.
- **Soft deletes**: records are never hard-deleted by normal roles; only Super Admin can modify or remove persisted records, and even then it's tracked.
- **PKR-native formatting**: all money stored as integer paisa, displayed with South Asian lakh/crore grouping (e.g. "PKR 2,00,000"); dates displayed `DD-MM-YYYY`, stored ISO-8601.
- **Notifications**: in-app notifications for order creation, voucher approvals, low stock, gate pass receipt, and electricity discrepancies, targeted by user or by role.

---

## 2. Platform layer (SaaS: multi-tenancy, backoffice, billing)

This layer, added on top of the original single-tenant ERP, turns it into a sellable product for any process manufacturer — not just the original zipper client. Full architecture and rationale: `docs/SAAS-PLATFORM-BLUEPRINT.md`. Execution log and exact scope of what's done vs. deferred: `specs/002-saas-platform/tasks.md`.

### 2.1 Multi-tenancy

- Every tenant-owned record carries an `organizationId`; a Prisma Client Extension automatically scopes every query and stamps every create with the current request's tenant, without having to touch each of the ~15 services' ~100+ query call sites individually.
- The original zipper client keeps running exactly as before as the "legacy" tenant (`organizationId = null`) — fully isolated from every other tenant in both directions (verified live: a client created by a new tenant is invisible to the legacy tenant and vice versa).
- Each `Organization` can have multiple `Company` sub-entities, up to its plan's configured limit.

### 2.2 Public marketing & self-serve signup (`/get-started`)

- Landing page explaining the product, a live plan-comparison grid (price, included modules, trial length, sub-company limit) pulled from the real `Plan` data, and a signup form.
- Signup creates the `Organization`, its first admin `User`, and a `Subscription` in `TRIAL` status — all in one step, no payment required up front.

### 2.3 Trial & manual billing (`/billing`, tenant-facing)

- Every plan includes a free trial (default 3 days) — full access to the plan's modules, no card or payment gateway involved anywhere in the system.
- Once trial ends (or any time the tenant wants to pay early), `/billing` shows the plan price, BD Matrix's bank account details, and a form to submit proof of a manual bank transfer (amount, optional transaction reference, screenshot link).
- Submitting payment does **not** lock the tenant out — access continues uninterrupted while awaiting verification (deliberately not a hard paywall).
- Once BD Matrix verifies the payment (see backoffice below), the subscription activates and the next due date is computed automatically from the plan's billing cycle.

### 2.4 Backoffice (`/backoffice`, BD Matrix only)

Completely separate login and session from the tenant app (its own JWT audience/cookie — a tenant session can never be used here and vice versa).

- **Dashboard**: counts and lists of overdue subscriptions, subscriptions due within 7 days, active trials, and pending payments.
- **Organizations**: every registered company, its current plan, subscription status, sub-company/user counts; suspend/reactivate/cancel.
- **Plans**: full CRUD — name, price, billing cycle, trial length, sub-company limit, and exactly which modules are bundled in (checkbox-driven against the live module registry).
- **Payments**: the verification queue — view the submitted screenshot and claimed amount, approve (activates/renews the subscription) or reject (with a required reason, tenant can resubmit).
- **Modules registry**: the 12 sellable feature modules (Dashboard, Production, Inventory, Packaging, Gate Pass, Orders, Finance, Accounting, HR & Payroll, Cost Price Reports, Monthly Overheads, Settings) that plans are built from.

---

## 3. What's deliberately not built yet

Documented in detail in `specs/002-saas-platform/tasks.md`, in priority order:
1. **Migration rehearsal against a copy of the real production database** before onboarding the live zipper client onto this platform layer (schema has been validated against a fresh local database, but not against that specific existing dataset).
2. **Automated test coverage** for the signup → trial → payment → verify → active flow (currently verified by hand, thoroughly, but not by a test suite).
3. **Full sweep of remaining `findUnique`-by-id calls** to close a narrow, low-probability tenant-isolation gap (relies on UUIDs being non-enumerable; not a demonstrated leak, just not defense-in-depth yet).
4. **True configurable units of measure** — the domain vocabulary (raw material type, product variant) is now generic, but "meters" as the unit of output is still hardcoded; making that configurable per organization is real, separate future work.
