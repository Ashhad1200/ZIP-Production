# Mizan — Product & Platform Overview

*By Treevoxa · Version 1.0 · 30 July 2026*

What Mizan is, who it's built for, what it does today, and how it's packaged and sold.

## Contents

1. [Summary](#1-summary)
2. [Origin](#2-origin)
3. [Who it's for](#3-who-its-for)
4. [Modules](#4-modules)
5. [What's different](#5-whats-different)
6. [The platform layer](#6-the-platform-layer)
7. [What we're offering](#7-what-were-offering)
8. [Roles & access](#8-roles--access)
9. [Technical stack](#9-technical-stack)
10. [Status & roadmap](#10-status--roadmap)

---

## 1. Summary

Mizan is production-to-ledger software for small and mid-size manufacturers: it tracks raw
material and shop-floor output, dispatches finished goods to clients with QR-verified gate passes, and
keeps a real double-entry ledger — replacing the register, the WhatsApp group, and the spreadsheet a
manufacturer is usually running the business on today.

It started as a single-tenant system built for one Pakistani plastic-zipper manufacturer. That system is
now the base layer of a multi-tenant platform Treevoxa sells to any process manufacturer — the
zipper-specific vocabulary has been generalized, and a Treevoxa–controlled backoffice sits on top to
manage tenants, plans, and billing.

## 2. Origin

The product exists because a real factory's production records lived in three disconnected places: a
paper register on the floor, a WhatsApp thread for dispatch instructions, and an Excel sheet for the
client ledger. None of the three talked to each other, so stock counts, dispatch amounts, and what a
client actually owed routinely drifted apart.

Building the fix for one factory surfaced that most of what it needed — recipe/BOM ratio mixing, FIFO
batch costing, shift and machine tracking, atomic dispatch-to-ledger posting, double-entry accounting — is
generic process-manufacturing machinery. Only the naming (grain types, zipper variants, meters) was
specific to that one client. That's the basis for offering it as a platform.

## 3. Who it's for

A process manufacturer that:

| | |
|---|---|
| **Runs shifts on a factory floor** | Production is logged per shift and machine, not just a monthly total. |
| **Consumes raw material into product** | A recipe/ratio mix of inputs turns into a finished, sellable output. |
| **Dispatches to repeat clients on credit** | Deliveries need a paper trail and a running client balance, not cash-on-delivery. |
| **Still runs the ledger by hand** | Books are in Excel, a register, or a local accountant's notebook — not a real ledger. |
| **Has staff, not just an owner** | Different people need different access — production shouldn't see payroll, marketing shouldn't see margins. |
| **Owner isn't always on-site** | Wants to check today's numbers from a phone, not by calling the factory. |

## 4. Modules

Twelve modules, switched on or off per plan by the backoffice — a tenant only sees and pays for what its
plan includes.

| Module | Key | What it does |
|---|---|---|
| Dashboard | `dashboard` | Cross-module KPI view — production, stock, dispatch, cash, in one screen. |
| Production | `production` | Shift-based production logging, recipes, automatic raw-material consumption. |
| Inventory | `inventory` | Raw material and finished-goods stock, tracked in real time. |
| Packaging | `packaging` | Packaging material as its own tracked inventory line. |
| Gate Pass | `gate-pass` | Dispatch, QR-verified receipt at the client end, sales returns. |
| Orders | `orders` | Client order tracking through to fulfillment. |
| Finance | `finance` | Client ledger, payments, vouchers, standard reports. |
| Accounting | `accounting` | Chart of accounts, journal entries, general ledger, trial balance. |
| HR & Payroll | `hr` | Workers, salary rates, advances, payroll runs. |
| Cost Price Reports | `cost-price` | Per-variant cost price and margin, computed from actual consumption. |
| Monthly Overheads | `monthly-overheads` | Overhead allocation feeding into cost-price calculations. |
| Settings | `settings` | Plants, machines, product variants, clients, users, configuration. |

## 5. What's different

Most of this is invisible until something would otherwise go wrong.

- **Real double-entry accounting** — Chart of accounts, journal entries, general ledger, trial balance —
  debits equal credits, enforced, not a spreadsheet pretending to be a ledger.
- **FIFO batch costing** — Every raw-material purchase is its own batch; consumption draws down the oldest
  batch first, automatically.
- **Dispatch posts atomically** — A gate pass deducts stock and posts the client ledger entry in a single
  database transaction — the two can't drift apart.
- **Money never touches a float** — Every amount is stored as an integer in paisa and formatted in
  lakh/crore PKR convention on the way out.
- **Financial fields are actually hidden** — Roles without finance access don't get money fields redacted
  in the UI — they're stripped server-side before the response is sent.
- **Works with a bad shop-floor connection** — Writes queue on-device when offline and replay automatically
  once connectivity returns — data entry doesn't block on signal.
- **Every tenant is walled off** — One organization's data is scoped at the query layer — no cross-tenant
  read, ever, enforced centrally rather than per-endpoint.
- **Everything is audited** — Who created or changed a record, and when, is captured server-side — never
  trusted from client input.

## 6. The platform layer

Above the tenant application sits a Treevoxa–controlled backoffice — a second, independent login plane
that a tenant admin never sees or reaches.

> **Signup flow:** a visitor picks a plan on the public site → creates an account with a real email and
> password → gets a 3-day trial with that plan's modules switched on → pays by bank transfer and uploads
> the receipt → Treevoxa verifies it manually in the backoffice and the subscription activates. There is
> deliberately no payment gateway in the loop yet.

From the backoffice, Treevoxa can:

- **See every tenant** — Organization list, its current plan, and subscription status at a glance.
- **Manage plans** — Price, included modules, and sub-company limit per plan — changes apply
  platform-wide.
- **Verify payments** — Review an uploaded transfer receipt against the claimed amount and approve or
  reject it.

## 7. What we're offering

One plan today; the pricing model supports adding more without a rebuild.

### Standard Plan — PKR 15,000 / 30 days

- 3-day free trial
- 1 sub-company included
- Unlimited users
- Bank-transfer billing, manually verified
- All 12 modules included: Dashboard, Production, Inventory, Packaging, Gate Pass, Orders, Finance,
  Accounting, HR & Payroll, Cost Price Reports, Monthly Overheads, Settings

The plan model (price, module set, sub-company cap) is data, not code — a tiered lineup (e.g. a
single-plant starter tier alongside a multi-branch tier with a higher sub-company limit) is a backoffice
change, not a release.

## 8. Roles & access

Six roles, enforced both by what an endpoint accepts and by what a response contains.

| Role | Typical user | Sees money fields |
|---|---|---|
| Super Admin | Owner / founder | Yes |
| Finance Head | Accountant, bookkeeper | Yes |
| Logistics Head | Dispatch / gate operations | Yes |
| Production Head | Floor / shift manager | No — stripped server-side |
| Marketing Head | Sales & client relations | No — stripped server-side |
| HR Head | Staff & payroll admin | No — stripped server-side |

## 9. Technical stack

| | |
|---|---|
| **Backend** | Express 5 · TypeScript · Prisma · PostgreSQL |
| **Frontend** | React 19 · Vite · TypeScript · Tailwind v4 |
| **Deployment** | Docker — Postgres, backend, frontend as one compose stack |
| **Data model** | ~40 Prisma models across Production, Inventory, Dispatch, Orders, Accounting, HR |

## 10. Status & roadmap

- ✅ **Done — Phase 1: Platform schema & backoffice.** Organization, Plan, Module, Subscription, Payment,
  BankAccount modeled; backoffice API and UI built.
- ✅ **Done — Phase 2: Tenant data isolation.** `organizationId` propagated across all tenant-scoped
  models; per-tenant uniqueness enforced; query-layer isolation live.
- ✅ **Done — Phase 3 (partial): Real authentication.** Kiosk-style, password-less login replaced with
  email + password across signup, login, and team-member creation.
- ✅ **Done — Phase 4: Public marketing & signup site.** Landing page, plan display, and self-serve signup
  live at the public site's `/get-started` route.
- 🟡 **Next: Domain vocabulary generalization.** A handful of legacy zipper-specific model names remain
  from the original single-tenant build and are mid-migration to generic equivalents.
- ⬜ **Under consideration: Tiered plans & payment gateway.** A second plan tier and a real payment gateway
  are natural next steps once the first tenants are on manual billing.

---

*Mizan — Treevoxa · Product & Platform Overview · v1.0*
