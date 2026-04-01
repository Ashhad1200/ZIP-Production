# Research: ZIP Production ERP System

**Date**: 2025-07-17 | **Plan**: [plan.md](./plan.md) | **Spec**: [spec.md](./spec.md)

## Research Summary

Six technical unknowns were identified during Technical Context analysis. All have been resolved through targeted research. This document records each decision, rationale, and alternatives considered.

---

## R1: Offline Mutation Queuing Strategy

**Context**: Constitution Principle V requires the app to handle 60-second connectivity interruptions without data loss, queue mutations on the client, replay in order with conflict detection, and surface conflicts to the user.

**Decision**: Custom IndexedDB-based FIFO mutation queue integrated with TanStack Query, plus server-side ETag/version-based conflict detection.

**Rationale**:
- TanStack Query's built-in retry alone does **not** persist the queue across page reloads and has no conflict detection — insufficient for a factory ERP where page refreshes are common.
- Service Worker + Background Sync provides persistence but has limited Safari support (a concern for the owner's iPhone) and no built-in conflict detection.
- The custom IndexedDB queue meets all 5 constitutional requirements: persistence across reloads, FIFO ordered replay, conflict detection via response comparison, visible offline indicator with queued count, and explicit user-facing conflict resolution.

**Alternatives Considered**:
| Approach | Why Rejected |
|----------|-------------|
| TanStack Query retry only | Queue lost on page reload; no conflict detection |
| Service Worker + Background Sync | Limited Safari support; complex debugging; no conflict detection |
| PouchDB/CouchDB sync | Overkill for 60-second offline windows; adds database dependency |

**Implementation Architecture**:
1. **MutationQueueService** class wraps IndexedDB with typed operations (queue, peek, dequeue, markConflict)
2. **useOfflineQueue** React hook monitors `navigator.onLine`, shows offline banner with queued count
3. **Axios interceptor** catches network errors on write operations, stores in IndexedDB queue
4. **Replay on reconnect**: FIFO dequeue, send to server, compare response ETag with expected state
5. **Conflict handling**: If ETag mismatch, mark mutation as `conflict` and render ConflictResolutionDialog showing server value vs. queued value — user picks which to keep
6. **Server-side**: All mutable entities carry a `version` integer, incremented on every update. API responses include `ETag` header. PUT/PATCH requests include `If-Match` header.

**Scope for v1**: Queue production entries, gate passes, payments, and voucher submissions. Read-only queries are not queued (they simply show stale data with a visible indicator). Maximum queue size: 50 mutations (sufficient for 60-second windows at realistic data entry rates).

---

## R2: Double-Entry Accounting with Prisma & PostgreSQL

**Context**: Constitution Principle I mandates double-entry accounting where every journal entry balances (sum debits = sum credits) and the system rejects imbalanced transactions at the database constraint level.

**Decision**: Dedicated `Account`, `JournalEntry`, and `JournalEntryLine` tables with a PostgreSQL `BEFORE INSERT OR UPDATE` trigger on `journal_entries` that enforces the balance invariant when status transitions to `posted`.

**Rationale**:
- A database-level trigger is the only approach that satisfies "reject at the database constraint level" — application-level checks alone could be bypassed.
- The trigger fires on posting (not drafting) so journal entries can be assembled incrementally then validated atomically when posted.
- The chart of accounts is tailored for a small Pakistani factory: ~20 accounts covering Assets (Cash, Bank, AR, Inventory), Liabilities (AP), Revenue (Sales), and Expenses (Factory, Director, Transport, Utilities, Raw Material, etc.).

**Alternatives Considered**:
| Approach | Why Rejected |
|----------|-------------|
| Application-level balance check only | Constitution requires database constraint level enforcement |
| PostgreSQL CHECK constraint on table | Cannot reference other rows (balance requires summing lines) |
| Simple debit/credit columns on ledger table | No proper accounting model; cannot generate trial balance or financial reports |

**Chart of Accounts for ZIP Production**:
```
1000  Assets
  1100  Cash (Cash on hand per company)
  1200  Bank (Bank accounts per company)
  1300  Accounts Receivable (client sub-ledger via client_id on JE lines)
  1400  Inventory - Finished Goods
  1500  Inventory - Raw Materials
2000  Liabilities
  2100  Accounts Payable
3000  Equity
  3100  Owner's Equity
4000  Revenue
  4100  Sales Revenue (gate pass dispatches)
  4200  Scrap Sales Revenue
5000  Expenses
  5100  Factory Expenses
  5200  Director Expenses
  5300  Shareholder/Dividend Payments
  5400  Charity
  5500  Head Office
  5600  Raw Material Purchases
  5700  Utilities
  5800  Transport
  5900  Other Expenses (extensible via categories)
```

**Transaction Flows**:
- **Gate Pass**: Debit AR (client sub-ledger) → Credit Sales Revenue
- **Client Payment**: Debit Cash/Bank → Credit AR (client sub-ledger)
- **Expense Voucher**: Debit Expense Account → Credit Cash/Bank
- **Raw Material Purchase**: Debit Raw Material Inventory → Credit Cash/Bank or AP
- **Scrap Sale**: Debit Cash → Credit Scrap Sales Revenue
- **Production (inventory)**: Debit Finished Goods Inventory → Credit Raw Material Inventory (consumption)

---

## R3: Testing Framework Selection

**Context**: Constitution Principle VIII requires integration tests for cross-module flows, unit tests for business logic, and CI gating on PRs.

**Decision**: Backend uses Jest 29 + Supertest + jest-mock-extended. Frontend uses Vitest 1.x + @testing-library/react + MSW.

**Rationale**:
- **Backend — Jest over Vitest**: Prisma's official documentation and examples use Jest. Vitest's ESM-first approach causes migration conflicts with Prisma's generated client. Jest's multi-worker parallelism handles integration tests well.
- **Frontend — Vitest over Jest**: Vitest has native Vite integration (zero extra config), is 5-10x faster for component tests, and has excellent @testing-library support. Speed matters for developer feedback loops.
- **Supertest**: Purpose-built for Express, clean assertion API, industry standard.
- **MSW (Mock Service Worker)**: Intercepts network requests at the browser/Node level, enabling realistic API mocking without coupling to Axios internals.

**Alternatives Considered**:
| Approach | Why Rejected |
|----------|-------------|
| Vitest for backend | ESM conflicts with Prisma migrations; less mature Prisma integration |
| Jest for frontend | Requires additional webpack config to work with Vite; 5-10x slower |
| Playwright for E2E | Good addition for Phase 2 but not the primary testing tool for v1 |

**Test Database Strategy**:
- Separate `DATABASE_URL_TEST` environment variable pointing to a test PostgreSQL database
- `beforeAll`: Run Prisma migrations on test DB
- `afterEach`: Truncate all tables (preserving schema) between tests
- `afterAll`: Disconnect Prisma client
- CI: GitHub Actions service container for PostgreSQL

---

## R4: Data Freshness for Inventory & Financial Modules

**Context**: Constitution Principle II requires read endpoints to not serve cached data older than 5 seconds for inventory and financial modules. The user specified 30s dashboard polling and 60s list polling.

**Decision**: Hybrid polling strategy with a `useSmartQuery` hook. Inventory and financial modules use 5-second `refetchInterval`. Dashboard uses 30 seconds. General lists use 60 seconds. All polling is visibility-aware (stops when browser tab is hidden).

**Rationale**:
- 5-second polling for 20-25 users generates ~5 req/sec to PostgreSQL — easily handled by a single VPS with proper indexing.
- Visibility detection (via `document.visibilitychange`) reduces battery drain by 50-70% on mobile — critical for the owner's phone.
- The hybrid approach satisfies the constitution's 5-second requirement for critical modules without wasting bandwidth on non-critical screens.
- SSE (Server-Sent Events) was considered as a Phase 2 upgrade path if polling proves insufficient at scale.

**Alternatives Considered**:
| Approach | Why Rejected |
|----------|-------------|
| Uniform 5s polling everywhere | Wastes bandwidth on dashboard/list views; battery drain on mobile |
| staleTime: 5s without refetchInterval | Does NOT guarantee proactive freshness — only triggers refetch on user interaction |
| WebSockets/SSE for v1 | Added infrastructure complexity; polling is sufficient for 25 users |
| Uniform 30s polling | Violates constitution's 5s freshness requirement for inventory/financial |

**Required Database Indexes** (for fast polling queries):
```sql
CREATE INDEX idx_inventory_updated_at ON finished_goods_stock(updated_at DESC);
CREATE INDEX idx_raw_material_updated_at ON raw_material_stock(updated_at DESC);
CREATE INDEX idx_ledger_entry_updated_at ON journal_entry_lines(created_at DESC);
```

---

## R5: PKR Currency Formatting (South Asian Convention)

**Context**: Constitution Principle VII mandates Pakistani Rupee display with "PKR" prefix and South Asian grouping (lakhs and crores, not millions/billions).

**Decision**: Custom `formatPaisaToRupees()` utility that uses South Asian integer grouping (last 3 digits, then groups of 2). `Intl.NumberFormat('en-IN')` as a base, with custom PKR prefix override (since Intl returns "₨" symbol instead of "PKR").

**Rationale**:
- `Intl.NumberFormat('en-IN')` handles the grouping correctly (2,00,000) but uses the wrong currency symbol.
- A custom wrapper over Intl is more reliable across Node.js and browser environments than a pure regex approach.
- Storing as integers (paisa) prevents floating-point errors in all calculations.

**Implementation**:
- **Storage**: All monetary values as `BigInt` / integer in PostgreSQL (paisa = rupees × 100)
- **Display**: `formatPaisaToRupees(5500000)` → `"PKR 55,000.00"`. `formatPaisaToRupees(20000000)` → `"PKR 2,00,000.00"`
- **Shorthand**: `formatPaisaToRupees(1250000000, { useShorthand: true })` → `"PKR 1.25Cr"`
- **Input**: `CurrencyInput` React component accepts "2,00,000" or "2L" or "1.5Cr" and converts to paisa
- **Backend**: `formatCurrencyFields` middleware can decorate API responses with both raw paisa and display strings

**Alternatives Considered**:
| Approach | Why Rejected |
|----------|-------------|
| Pure Intl.NumberFormat with currency: 'PKR' | Returns "₨" symbol, not "PKR" text prefix as required |
| Third-party library (dinero.js, currency.js) | Adds dependency for simple formatting; no South Asian grouping support |
| Store as DECIMAL in PostgreSQL | Floating-point risk with arithmetic; integers are safer |

---

## R6: Gate Pass PDF Generation with QR Code

**Context**: Gate passes must be printable A4 documents with QR codes. Scanning the QR marks the gate pass as "Received". No custom mobile app required.

**Decision**: `@react-pdf/renderer` for PDF generation + `qrcode.react` (converted to data URL via `QRCode.toDataURL()`) for QR codes. One-time token-based verification URL for security.

**Rationale**:
- `@react-pdf/renderer` uses React components for layout — natural for the team, supports tables, headers/footers, and flex positioning. Generates native PDF (not HTML-to-canvas conversion), so print quality is excellent.
- QR encodes a URL like `https://app.zipproduction.com/gp/verify?token=abc123`. Scanning with any phone camera opens the browser, hits the verification page.
- One-time tokens (48-hour expiry, stored in DB) prevent unauthorized marking. Multiple scans of the same token return "Already received" (idempotent).

**QR Verification Flow**:
1. Gate pass created → backend generates a `verify_token` (crypto-random, 64 chars) stored in DB
2. QR code on PDF encodes: `https://app.zipproduction.com/gp/verify?token={verify_token}`
3. Driver/client scans QR → phone opens browser → hits verification page
4. Page calls `POST /api/v1/gate-pass/verify` with token
5. Backend checks: token exists, not expired, not already used → marks gate pass as "Received" with timestamp
6. User sees confirmation page: "Gate Pass #GP-2025-001 Received ✓" with details

**Security Measures**:
- Token is single-use (marked `used: true` atomically before returning success)
- 48-hour expiry (configurable)
- Idempotent: second scan returns "Already received at [timestamp]"
- Rate limiting on verification endpoint
- Audit log entry for every scan attempt (successful or not)

**Alternatives Considered**:
| Approach | Why Rejected |
|----------|-------------|
| html2pdf.js | HTML-to-canvas conversion has inconsistent rendering across browsers; less precise print layout |
| jsPDF | Imperative API requires manual positioning; poor for structured table layouts |
| Server-side PDF generation (Puppeteer) | Adds heavy dependency to backend; client-side generation is sufficient |
| QR with gate pass ID in URL (no token) | Insecure: anyone with the URL could mark any gate pass as received |
