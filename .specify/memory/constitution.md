<!--
  ══════════════════════════════════════════════════════════
  SYNC IMPACT REPORT
  ══════════════════════════════════════════════════════════
  Version change: (none — template) → 1.0.0
  Bump rationale: MAJOR — initial constitution adoption.

  Modified principles: N/A (first version)

  Added sections:
    - Core Principles (9 principles)
    - Technical & Business Constraints
    - Development Workflow & Delivery
    - Governance

  Removed sections: N/A (first version)

  Templates requiring updates:
    ✅ plan-template.md — "Constitution Check" is dynamic;
       no hardcoded principle names to update.
    ✅ spec-template.md — generic requirement/scenario
       structure; compatible with all 9 principles.
    ✅ tasks-template.md — phase structure and parallel
       annotations align with Iterative Delivery and
       Testing Standards principles.
    ✅ checklist-template.md — generic; no updates needed.
    ✅ agent-file-template.md — generic; no updates needed.
    N/A commands/ — directory does not exist yet.
    N/A README.md — not yet created.
    N/A docs/ — not yet created.

  Deferred items / TODOs: None.
  ══════════════════════════════════════════════════════════
-->

# ZIP Production ERP Constitution

## Core Principles

### I. Data Integrity & Auditability (NON-NEGOTIABLE)

- Every database record MUST carry `created_by`, `created_at`,
  `updated_by`, and `updated_at` timestamps populated automatically
  by the server — never by client input.
- Once a record is persisted, no user except a Super Admin MAY
  modify or delete it. All other roles operate under an
  append-only or soft-delete model.
- Every mutation (create, update, soft-delete) MUST write an
  entry to the audit log that includes the previous value, new
  value, acting user, and ISO-8601 timestamp.
- Financial transactions MUST enforce double-entry accounting:
  every journal entry MUST balance (sum of debits = sum of
  credits) and the system MUST reject any transaction that
  violates this invariant at the database constraint level.
- Bulk imports or manual corrections by Super Admin MUST still
  generate audit log entries tagged with a reason field.

**Rationale**: The factory owner requires absolute trust that
once data enters the system it cannot be silently altered. Audit
trails are essential for dispute resolution with clients and
internal accountability.

### II. Real-Time Synchronization

- All cross-module side-effects MUST execute within a single
  database transaction. Example: creating a Gate Pass MUST
  atomically deduct inventory stock AND create the corresponding
  client ledger entry. If any step fails, the entire operation
  MUST roll back.
- The UI MUST reflect the latest server state. After a
  successful mutation the originating client MUST see updated
  data without a manual page refresh. Other connected clients
  SHOULD receive updates within 3 seconds via push mechanism
  (WebSocket, SSE, or polling fallback).
- Read endpoints MUST NOT serve cached data older than 5 seconds
  for inventory and financial modules.
- No module MAY maintain a local copy of another module's data
  that can drift out of sync. Shared data MUST be queried from
  the single source of truth or propagated via the transactional
  side-effect pattern above.

**Rationale**: The factory's operational flow (production →
inventory → dispatch → finance) is tightly coupled. Stale or
inconsistent data between modules causes dispatch errors and
ledger mismatches that are expensive to reconcile.

### III. Role-Based Access Control First

- Every API endpoint and every UI route MUST enforce role-based
  access control (RBAC) checks before processing. There is no
  "add auth later" — RBAC is a prerequisite for feature
  completion.
- Defined roles for v1: **Super Admin**, **Finance**,
  **Production**, **Gate Operator**, **Viewer**.
- The Production role MUST NOT have access to any financial data
  including rates, prices, client payment terms, or ledger
  balances. API responses for Production users MUST strip
  financial fields at the serialization layer.
- The Finance role MUST have read-only access to production and
  stock data; write access is limited to financial modules
  (ledger, payments, invoices).
- Super Admin has unrestricted access to all modules and is the
  only role that can modify or delete persisted records.
- Permissions MUST be defined declaratively (configuration or
  database) so they can be audited and modified without code
  changes.

**Rationale**: The factory has distinct operational teams who
must not see each other's sensitive data. The owner (Super
Admin) is the only person trusted with full access.

### IV. Mobile-First Responsive Design

- Every screen MUST be designed for a 375px viewport first and
  progressively enhanced for tablet and desktop. No feature MAY
  be implemented as desktop-only.
- Touch targets MUST be a minimum of 44×44 CSS pixels.
- Data-heavy tables MUST provide a mobile-friendly alternative
  (card layout, collapsible rows, or horizontal scroll with
  frozen first column).
- The owner's primary monitoring screens (dashboard, gate pass
  list, production summary) MUST load and be fully interactive
  on a 4G mobile connection (target: < 3 seconds first
  contentful paint on mid-range Android device).

**Rationale**: The factory owner manages operations remotely
from his phone. If a screen is not usable on mobile, it is
effectively unusable for the primary stakeholder.

### V. Cloud-Native & Offline-Resilient

- All application data MUST persist in a managed cloud database
  (no local-only storage as primary store).
- The application MUST handle brief connectivity interruptions
  (up to 60 seconds) without data loss. Pending mutations MUST
  be queued on the client and replayed when connectivity
  resumes. The user MUST receive a visible indicator of offline
  status.
- The system MUST NOT enter a broken state after a connectivity
  drop. On reconnection, queued operations MUST be replayed in
  order with conflict detection; if a conflict is detected, the
  system MUST surface it to the user for resolution rather than
  silently overwriting.
- Deployments MUST use zero-downtime strategies (rolling deploy
  or blue-green) so the factory never experiences an outage
  during releases.

**Rationale**: The factory is in an industrial area with
occasionally unstable internet. Data loss is the highest-risk
outcome the client wants to prevent.

### VI. Simplicity for Non-Technical Users

- Every data-entry form MUST prefer dropdowns, date pickers,
  and pre-loaded selection lists over free-text input. Manual
  text entry MUST be limited to fields that genuinely require
  it (e.g., remarks, custom descriptions).
- Multi-step workflows (e.g., Gate Pass creation) MUST guide the
  user through a linear sequence with clear "Next" / "Back"
  navigation and a visible progress indicator.
- Error messages MUST be displayed in plain language adjacent to
  the offending field. Technical error codes or stack traces
  MUST NEVER be shown to end users.
- Destructive or irreversible actions MUST require an explicit
  confirmation dialog stating the consequence in plain language.
- The system MUST provide contextual defaults (e.g., today's
  date, logged-in user's name, last-used client) to minimize
  keystrokes.

**Rationale**: The system will be operated by factory managers
and finance staff who are not tech-savvy. One dedicated
operator will be trained to input data; the UI must be
forgiving enough that mistakes are caught before submission.

### VII. Pakistani Business Context

- All monetary values MUST be stored and displayed in Pakistani
  Rupees (PKR). The currency symbol "Rs." or "PKR" MUST prefix
  all displayed amounts.
- Number formatting MUST follow the South Asian convention:
  lakhs (1,00,000) and crores (1,00,00,000) — not the Western
  millions/billions grouping.
- Date display MUST default to `DD-MM-YYYY` (Pakistani
  convention). All dates MUST be stored as ISO-8601 internally.
- Business terminology in the UI MUST use terms familiar to
  Pakistani SMB manufacturing: "Gate Pass" (not "Shipping
  Order"), "Ledger" (not "Accounts Receivable"), "Maal" or
  "Goods" as contextually appropriate.
- Urdu language labels are NOT required in v1 but the UI text
  layer MUST be externalized into a locale file so Urdu
  translation can be added in a future release without code
  changes.

**Rationale**: The client and all users operate in a Pakistani
business environment. Using Western conventions would cause
confusion and reduce trust in the system.

### VIII. Testing Standards

- Every module MUST have integration tests covering cross-module
  transactional flows. Minimum required flows:
  - Gate Pass creation → inventory stock deduction → client
    ledger entry creation (single transaction).
  - Production entry → raw material consumption → inventory
    adjustment.
  - Payment recording → ledger update → balance recalculation.
- All business-logic calculations MUST have unit tests with
  boundary cases. Required coverage areas:
  - Raw material consumption formulas.
  - Due date calculations.
  - Electricity usage validation and cost allocation.
  - Double-entry balance verification.
- Tests MUST run in CI on every pull request. A failing test
  MUST block the merge.
- Test data MUST use realistic Pakistani business values (PKR
  amounts, Pakistani date ranges, Urdu-safe string fields) to
  catch locale-related bugs early.

**Rationale**: The tightly coupled module interactions (gate
pass → stock → ledger) are the highest-risk area for bugs.
Cross-module integration tests are the primary safety net.

### IX. Iterative Delivery

- The system MUST be delivered through 3–4 review cycles. Each
  cycle MUST produce a working, deployable version — not a
  mockup or wireframe.
- Each demo MUST show real data flowing through the system: the
  client expects to enter sample data and see it propagate
  across modules (e.g., enter a gate pass → see stock change →
  see ledger update).
- The delivery order MUST prioritize modules by business
  criticality: Production & Inventory first, then Gate Pass &
  Dispatch, then Finance & Ledger, then Dashboard & Reporting.
- Every review cycle MUST include a changelog describing what
  was added, changed, or fixed since the previous demo.
- Feedback from each review cycle MUST be captured in writing
  and triaged before the next cycle begins.

**Rationale**: The client (factory owner) is investing in a
custom system and needs to see tangible progress early. Working
demos build trust and catch misunderstandings before they
become expensive to fix. BD Matrix (the agency) operates in
short cycles to minimize rework.

## Technical & Business Constraints

- **Agency**: BD Matrix (small development agency).
- **Client**: Plastic zipper manufacturing company, Pakistan.
- **Users**: Factory owner (remote, mobile), factory managers
  (on-site), finance staff (on-site), gate operators (on-site),
  one dedicated data-entry operator.
- **Currency**: PKR only; no multi-currency support required.
- **Language**: English UI in v1; Urdu is a future consideration
  with externalized locale strings ready.
- **Connectivity**: Assume intermittent broadband at factory
  site; 4G mobile for the owner.
- **Data volume**: Small-to-medium (single factory, < 100
  concurrent users, < 10,000 transactions/month).
- **Compliance**: No external regulatory compliance required in
  v1 (e.g., no FBR e-invoicing integration yet), but the audit
  trail design MUST be extensible for future compliance needs.
- **Hosting**: Cloud-hosted (provider TBD); no on-premise
  requirement.
- **Browser support**: Latest Chrome, Safari (iOS), and Edge.
  No IE11 support.

## Development Workflow & Delivery

- **Branching**: Feature branches off `main`; pull requests
  required for all merges.
- **Code review**: Every pull request MUST be reviewed by at
  least one other developer before merge.
- **CI gate**: All tests (unit + integration) MUST pass before
  a PR can be merged.
- **Demo cadence**: One working demo every 1–2 weeks aligned
  with the 3–4 review cycle commitment.
- **Definition of Done**: A feature is done when it passes all
  tests, is accessible on mobile, enforces RBAC, writes audit
  logs, and has been visually verified on a 375px viewport.
- **Commit messages**: Follow Conventional Commits format
  (`feat:`, `fix:`, `docs:`, `test:`, `refactor:`).
- **Environment parity**: Development, staging, and production
  environments MUST use the same database engine and schema
  version.

## Governance

- This constitution is the highest-authority document for the
  ZIP Production ERP project. All design decisions, code
  reviews, and feature specifications MUST be evaluated against
  these principles.
- **Amendment procedure**: Any team member may propose an
  amendment. Amendments MUST be documented in a pull request
  with a clear rationale. The BD Matrix project lead MUST
  approve all amendments before merge.
- **Versioning policy**: The constitution follows Semantic
  Versioning (MAJOR.MINOR.PATCH):
  - MAJOR: Removal or incompatible redefinition of a principle.
  - MINOR: Addition of a new principle or material expansion
    of existing guidance.
  - PATCH: Wording clarifications, typo fixes, non-semantic
    refinements.
- **Compliance review**: At the start of each review cycle,
  the team MUST verify that the current working build complies
  with all active principles. Non-compliance MUST be logged as
  a tracked issue with a remediation deadline.
- **Conflict resolution**: If a principle conflicts with a
  client request, the conflict MUST be escalated to the BD
  Matrix project lead and resolved in writing before
  implementation proceeds.
- **Runtime guidance**: Use the project's agent guidance file
  (`.specify/memory/agent-guidance.md`, when created) for
  day-to-day development conventions that do not rise to
  constitutional level.

**Version**: 1.0.0 | **Ratified**: 2026-04-01 | **Last Amended**: 2026-04-01
