# ZIP Production → Multi-Tenant Manufacturing ERP SaaS: Blueprint

**Status**: Draft for review — Phase 1 (schema + backoffice API scaffold) implemented, not yet wired into production or migrated. See `Plans.md` for task tracking.

---

## 1. What you actually built (product justification)

Stripped of the "zipper" vocabulary, this system is a **process-manufacturing ERP**: it converts raw material into a measurable finished good through a formula, tracks that conversion shift-by-shift on specific machines, costs it with FIFO batch accounting, dispatches it against a client rate card with QR-verified gate passes, and books every movement into a real double-entry ledger — all wrapped in a mobile-first, offline-resilient, role-gated UI built for non-technical factory staff. That combination (recipe-based consumption, FIFO batch costing, shift/machine-level electricity validation, dispatch-to-ledger automation, RBAC financial-field stripping) is not zipper-specific — it's the exact shape of the problem for a wide band of Pakistani/South Asian SMB manufacturers: plastic goods, packaging/poly bags, rubber/rope, textile processing, food processing (oil, flour, feed mills), wire & cable — anywhere a factory buys raw material by weight/volume, runs it through machines in shifts, produces a measurable output, and sells it to repeat B2B clients on credit terms.

The only genuinely domain-specific layer is naming and units: `GrainType`, `ZipperVariant`, `gramsPerMeter`, "meters produced". Everything underneath — `Recipe`/`VariantIngredient` ratio mixing, `RawMaterialBatch` FIFO consumption, `Machine.kwhRating` vs. actual electricity discrepancy detection, `ClientRate` effective-dated pricing, `GatePass` → stock deduction → AR journal entry in one transaction — is generic manufacturing-ERP machinery.

**Positioning**: this becomes a **vertical SaaS for small-to-mid process manufacturers**, sold by BD Matrix, with the existing zipper client as tenant #1 and proof of the core engine. It is not a horizontal generic ERP (that's SAP/Odoo territory and a losing fight); it wins by being pre-built for *this class* of factory — formula-driven output, shift/machine tracking, dispatch-and-ledger-in-one-transaction, Pakistani business conventions (PKR, DD-MM-YYYY, lakh/crore) — with the domain vocabulary reconfigured per tenant instead of hardcoded to zippers.

## 2. Target architecture

### 2.1 Two planes

- **Tenant plane** (existing app): the ERP itself — Production, Inventory, Gate Pass, Orders, Finance/Accounting, HR, Settings — as already built, but scoped per `Organization`.
- **Platform plane** (new — "backoffice"): BD Matrix's own control panel. Not a role inside a tenant; a separate login, separate JWT audience, separate route namespace (`/api/v1/platform/*`), driven by a new `PlatformAdmin` model. A tenant's `SUPER_ADMIN` must never be able to reach platform routes, and vice versa.

### 2.2 Tenancy model

- `Organization` = the paying customer ("Acme Plastics"). Owns a `Subscription` to a `Plan`, a trial window, and a set of `Company` records.
- `Company` (existing model, currently just an accounting/voucher legal-entity) becomes the **sub-company** unit the plan limits ("plan bought → can make N sub companies"). Each `Company` gets `organizationId`. `Plan.maxSubCompanies` is enforced on `Company` creation.
- Every tenant-owned row eventually carries `organizationId` (directly or via its `Company`/`Plant` parent) so a single Postgres database can serve every tenant with row-level isolation — no per-tenant database/schema, which would be operationally heavy for a small agency to run. This is the same trade-off almost all SMB-tier SaaS make (Postgres RLS or app-level `WHERE organizationId = ?` on every query).
- **Migration reality check**: ~40 models currently have no tenant column at all — they were built assuming exactly one factory. Retrofitting `organizationId` everywhere in one shot is the highest-risk part of this whole effort (it touches every service, every unique constraint like `Client.name @unique` which must become `@@unique([organizationId, name])`, every seed). That work is scoped as **Phase 2** below and must not be attempted against the live zipper tenant's data without a rehearsed migration + backfill script and a maintenance window. Phase 1 (this drop) only adds the new platform-plane models and the two natural tenant-root anchors (`Company`, `User`) — additive, nullable, zero impact on existing rows.

### 2.3 Module system

A `Module` table is the source of truth for what's sellable (`production`, `inventory`, `gate-pass`, `orders`, `finance`, `accounting`, `hr`, `packaging`, `settings`, `dashboard` — one row per existing route prefix in `backend/src/routes/index.ts`). A `Plan` is a named bundle of `Module`s + price + trial length + sub-company limit. A tenant's effective module set = union of modules on their active plan. A new `requireModule(key)` middleware (parallel to the existing `rbac()` middleware) gates each route group; it's additive to RBAC, not a replacement — a request must pass both "is this role allowed" and "does this org's plan include this module."

### 2.4 Billing: trial → manual bank verification (no payment gateway)

Deliberately no Stripe/Adyen/local gateway integration — matches the stated requirement (no card rails, no local Pakistani gateway integration for v1) and mirrors how the reference site (fitzonepro.bdmatrix.org) already positions this: sign up → trial → manual proof-of-payment.

```
1. Public signup (marketing site) → org picks a Plan
   → Organization + first User(SUPER_ADMIN) + Subscription(status=TRIAL, trialEndsAt=now+plan.trialDays) created
2. Trial window (default 3 days): full access to the plan's modules, no payment required yet
3. On trial expiry (or whenever the org wants to pay early):
   → Tenant panel shows "Payment Required" screen: plan price, our bank account details (BankAccount table),
     an amount field, and a file upload for the transfer screenshot
   → POST /api/v1/platform/payments (tenant-authenticated) creates Payment(status=PENDING) with the screenshot URL
   → Subscription flips to PAST_DUE if trial already lapsed; tenant sees "awaiting verification" banner,
     read-only access preserved (not hard-locked) until a PlatformAdmin acts
4. Backoffice: Payments queue (status=PENDING) shows screenshot, claimed amount, org, plan
   → PlatformAdmin approves → Payment.status=VERIFIED, Subscription.status=ACTIVE,
     currentPeriodStart/End and nextDueDate computed from plan.billingCycleDays
   → PlatformAdmin rejects (reason required) → Payment.status=REJECTED, tenant notified, can resubmit
5. Recurring: a scheduled job (or on-login check) flips Subscription to PAST_DUE once nextDueDate passes without
   a new VERIFIED payment; backoffice dashboard lists Due / Overdue / Upcoming by nextDueDate
```

This flow requires no cron infrastructure to start — subscription status can be lazily recomputed on each authenticated request (compare `nextDueDate`/`trialEndsAt` to `now()`), same pattern as the existing offline-queue lazy design. A scheduled job can be added later purely for notification timing, not correctness.

### 2.5 Backoffice feature list (as requested)

| Requirement | Backing model / endpoint |
|---|---|
| All modules listed | `Module` table, `GET /api/v1/platform/modules` |
| All registered companies using the system | `Organization` list with subscription/plan/status, `GET /api/v1/platform/organizations` |
| All plans (price, modules offered, sub-company limit) | `Plan` + `PlanModule`, full CRUD under `/api/v1/platform/plans` |
| Full / due / upcoming payments | `Payment` + `Subscription.nextDueDate`, `GET /api/v1/platform/payments?status=` and a dashboard aggregate endpoint |
| Trial → manual bank payment → screenshot → verify → attach plan | `Subscription`, `Payment`, `BankAccount`, verify/reject endpoints |

## 3. Phased rollout

- **Phase 0 (done, prior session)**: `CLAUDE.md` written from the existing single-tenant codebase — reference for anyone (including future Claude sessions) working in this repo.
- **Phase 1 (this drop)**: Additive Prisma models (`Organization`, `Module`, `Plan`, `PlanModule`, `Subscription`, `BankAccount`, `Payment`, `PlatformAdmin`), nullable `organizationId` on `Company`/`User`, backend `platform/` module (auth, organizations, plans, payments, modules services/controllers/routes), module registry seed. No changes to existing tenant-facing behavior; nothing is migrated onto the live database yet.
- **Phase 2 (next, needs a scheduled migration window)**: Propagate `organizationId` to every remaining tenant-scoped model, convert global-unique constraints (`Client.name`, `GatePass.gatePassNumber`, `Vendor.name`, etc.) to org-scoped composite uniques, add `organizationId` filtering to every service query, backfill existing zipper-client rows into a default `Organization`. This is the expensive, high-blast-radius part — needs its own reviewed plan and a rehearsal against a DB copy before touching production.
- **Phase 3 (product generalization)**: Replace hardcoded zipper vocabulary with per-organization configuration — rename `GrainType`→ generic `RawMaterialType`, `ZipperVariant`→ `ProductVariant`, make the unit of output (`meters`) and the consumption formula (`gramsPerMeter`) configurable per org instead of hardcoded, turn "Recipe/VariantIngredient" ratio-mixing into a generic BOM engine, and make machine electricity-discrepancy validation formula-driven rather than assuming extrusion machines specifically. This is where "any manufacturing detail, minor calculation, product manufacture" becomes literally true — it's a bigger effort than Phase 2 and should follow it, informed by a second real tenant's actual requirements rather than guessed in the abstract.
- **Phase 4**: Marketing/landing + self-serve signup site (public, unauthenticated), styled after the fitzonepro reference — plan comparison cards, signup form, trial countdown, payment-instructions page.

Phase 1 is implemented now (see `Plans.md`). Phases 2–4 are scoped but intentionally not started blind — each has a real risk (data migration correctness, naming churn breaking the live client, marketing-site design work) that benefits from a checkpoint before diving in.
