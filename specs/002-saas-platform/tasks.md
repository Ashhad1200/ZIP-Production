# Tasks: SaaS Platform (Multi-Tenancy + Backoffice + Billing)

See `docs/SAAS-PLATFORM-BLUEPRINT.md` for full architecture and rationale. This file tracks execution across sessions.

## Phase 1 — Platform plane scaffold (additive, non-breaking)

- [x] T001 Write blueprint / product justification (`docs/SAAS-PLATFORM-BLUEPRINT.md`)
- [x] T002 Add Prisma models: `Organization`, `Module`, `Plan`, `PlanModule`, `Subscription`, `BankAccount`, `Payment`, `PlatformAdmin`; nullable `organizationId` on `Company`, `User`
- [x] T003 `backend/src/config/modules.ts` — module registry matching existing route prefixes
- [x] T004 `backend/src/middleware/platform-auth.middleware.ts` — separate JWT audience for `PlatformAdmin`, isolated from tenant `authenticate`
- [x] T005 `backend/src/middleware/module-gate.middleware.ts` — `requireModule(key)`, checks org's active plan
- [x] T006 `backend/src/services/platform/{organization,plan,subscription,payment,platform-auth}.service.ts`
- [x] T007 `backend/src/controllers/platform/*.controller.ts` + `backend/src/routes/platform/*.routes.ts`, mounted at `/api/v1/platform`
- [x] T008 Public signup endpoint: `POST /api/v1/platform/organizations/signup` (Organization + first tenant User + trial Subscription)
- [x] T009 Tenant-side payment submission: `POST /api/v1/platform/payments` (screenshot upload + claimed amount)
- [x] T010 Backoffice endpoints: organizations list/detail, plans CRUD, payments queue + approve/reject, modules list, dashboard summary (due/upcoming/overdue)
- [x] T011 Seed: default `Module` rows, one starter `Plan`, one `BankAccount`, one `PlatformAdmin` (idempotent, added to `backend/prisma/seed.ts`)
- [x] T012a `npm ci` + `npx prisma generate` + `npx tsc --noEmit` — full backend (existing code + new platform module) typechecks cleanly with zero errors; seed.ts also verified to compile standalone under the Dockerfile's isolated `tsc prisma/seed.ts` invocation
- [ ] T012b `npx prisma db push` against a real local dev Postgres to confirm the migration applies cleanly — not run this session (no ZIP-Production Postgres available locally; port 5433 from docker-compose.yml collides with an unrelated project's container already running on this machine). Do this before merging: `docker compose up postgres -d` with a free port override, then `npx prisma db push`.
- [ ] T013 Backend unit/integration tests for signup → trial → payment → verify → active flow
- [x] T014 Frontend: minimal backoffice UI — `frontend/src/pages/Backoffice/{BackofficeLoginPage,BackofficeLayout,DashboardPage,OrganizationsPage,PlansPage,PaymentsPage}.tsx`, own `PlatformAuthContext`/`platform.api.ts`, routed at `/backoffice/*` in `router.tsx` (independent of tenant auth). Verified: `npx tsc --noEmit` clean across the whole frontend, and `npm run build` produced an isolated `Backoffice-*.js` lazy chunk (14.56 kB) confirming it compiles and code-splits correctly.
  - Found in passing, **pre-existing and unrelated to this work**: `npm run build` fails downstream on `DashboardPage` — `recharts` imports `react-is`, which isn't present in `node_modules` despite being in `package-lock.json` (likely a peer-dep hoisting gap). Not touched/fixed this session; flag for a separate fix (`npm install react-is` or equivalent).
- [ ] T015 Frontend: tenant-side "Payment Required" screen (bank details + screenshot upload) shown when subscription is `TRIAL` nearing/past expiry or `PAST_DUE`. Needs a small new backend endpoint first (e.g. `GET /api/v1/platform/organizations/me/subscription`, tenant-authenticated) for the tenant app to read its own org's subscription status — not yet added.

## Phase 2 — Full tenant data isolation (NOT started — needs its own reviewed plan + migration rehearsal)

- [ ] T020 Add `organizationId` to every remaining tenant-scoped model (~35 models)
- [ ] T021 Convert global-unique constraints to `@@unique([organizationId, field])`
- [ ] T022 Add `organizationId` scoping to every service query + a request-scoped tenant context
- [ ] T023 Backfill script: assign existing zipper-client rows to a default `Organization`
- [ ] T024 Migration rehearsal against a copy of the production DB before touching real data

## Phase 3 — Generalize the manufacturing domain beyond zippers (NOT started)

- [ ] T030 Configurable unit of output (replace hardcoded "meters") per organization
- [ ] T031 Rename/generalize `GrainType` → `RawMaterialType`, `ZipperVariant` → `ProductVariant`, generalize `gramsPerMeter` → configurable consumption ratio
- [ ] T032 Generalize `Recipe`/`VariantIngredient` into a per-org BOM engine
- [ ] T033 Make electricity-discrepancy validation formula-driven instead of extrusion-machine-specific
- [ ] T034 Re-seed / relabel existing zipper tenant data under the new generic model (no functional change for that tenant)

## Phase 4 — Public marketing / signup site (NOT started)

- [ ] T040 Landing page (plan comparison, signup form) styled after the fitzonepro.bdmatrix.org reference
- [ ] T041 Trial countdown + payment-instructions page for post-signup flow
