# Feature Specification: Cloud-Based ERP System for ZIP Production

**Feature Branch**: `001-zipper-erp-system`  
**Created**: 2025-07-17  
**Status**: Draft  
**Input**: User description: "Build a custom cloud-based ERP system for a plastic zipper manufacturing company operating in Pakistan with 6 core modules — Production, Raw Material & Inventory, Gate Pass, Order Management, Finance & Accounting, and User Roles & Access Control — plus a real-time dashboard and comprehensive reporting."

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Production Data Entry & Daily Progress Report (Priority: P1)

A designated production operator at one of the two manufacturing plants opens the production entry screen at the start or end of each 12-hour shift. He selects the plant (Plant 1 or Plant 2), the shift (Day: 7 AM–7 PM or Night: 7 PM–7 AM), and the date. He picks the workers on duty from a pre-loaded list of factory workers. He selects the zipper variant being produced from approximately 10 predefined variants, enters the total meters produced during that shift, and the grams-per-meter weight recorded for this run. He also manually enters the electricity units consumed during the shift by reading the plant's submeter at shift start and shift end — the system records these readings and cross-checks against expected consumption based on the machine's kilowatt-hour rating and reported production output. If the electricity consumed does not align with expected output based on machine hours, the system flags an electricity discrepancy for the owner to review. Additionally, the operator records any scrap (defective or waste material) produced during the shift, measured by weight in grams. At month-end, accumulated scrap is sold in a single cash transaction: the scrap buyer comes on-site, weighs the material, pays cash at the current scrap rate. The sale is recorded as a single monthly entry with: date, total weight sold, rate per kilogram, total cash amount received, and buyer name (optional).

All of this forms the Daily Progress Report (DPR) — a shift-level summary the factory owner can view from his mobile phone in real time, including production totals, electricity usage, scrap generated, and any flagged discrepancies.

**Why this priority**: Production is the heartbeat of the factory. Without accurate daily output tracking, no other module (inventory, dispatch, finance) can function. The owner's primary concern is knowing "how much was made today" at any moment. This aligns with the constitution's delivery order: Production & Inventory first.

**Independent Test**: Can be fully tested by having an operator submit a shift's production data and verifying the DPR is visible on a mobile device with correct totals, electricity validation, and scrap tracking — all without requiring any other module.

**Acceptance Scenarios**:

1. **Given** a production operator is logged in and it is the Day shift at Plant 1, **When** he selects the plant, shift, date, workers, variant "V-101 Standard Rice Bag Zipper", enters 5,000 meters produced at 3.2 grams/meter, and 120 electricity units consumed, **Then** the system saves the entry, calculates raw material consumed (16,000 grams = 16 kg), and the DPR displays this shift's data immediately.
2. **Given** Machine A at Plant 1 is rated at 10 kWh and should produce approximately 2,500 meters per 12-hour shift, **When** the operator records 5,000 meters but only 80 electricity units (suggesting only one machine ran full shift), **Then** the system flags an electricity discrepancy alert visible to the owner.
3. **Given** it is the last day of the month and 450 kg of scrap has accumulated, **When** the finance team records a scrap sale of 450 kg at PKR 80/kg for PKR 36,000, **Then** the scrap balance resets, the sale is logged, and the amount appears in the monthly financial summary.
4. **Given** the owner is travelling and opens the DPR on his mobile phone, **When** a Night shift entry has just been submitted at 3 AM, **Then** the owner sees the updated DPR with the latest shift data within seconds of submission.

---

### User Story 2 — Raw Material Procurement & Consumption Tracking (Priority: P2)

The factory purchases plastic grain as its primary raw material. Grain comes in 25 kg bags (25,000 grams each). Procurement happens from two sources: bulk containers (approximately 600 bags per month) and spot market purchases for urgent needs. When a shipment arrives, a designated staff member records the purchase: number of bags, price rate per bag, purchase date, and source (Container or Spot Market). The system supports approximately 10 grain types/categories.

The system automatically calculates grain consumption based on production data. When a production entry records that a variant was produced at X grams/meter and Y meters were produced, the system computes total grams consumed and converts this to bags consumed (dividing by 25,000 grams). This auto-consumption is deducted from raw material stock.

The owner needs a clear view of: current raw material stock (bags on hand per grain type), consumption rate vs. procurement rate, and low-stock alerts when grain inventory falls below a configurable threshold so he can order before running out.

**Why this priority**: Raw material directly feeds production. If the factory runs out of grain, production stops. Tracking procurement and auto-calculating consumption prevents both stockouts and undetected material waste. This is the second half of the "Production & Inventory first" delivery milestone.

**Independent Test**: Can be tested by recording a raw material purchase (e.g., 100 bags of Type A grain), then entering production data that consumes a known quantity, and verifying the raw material stock decreases correctly and a low-stock alert fires at the configured threshold.

**Acceptance Scenarios**:

1. **Given** the current stock of "Type A Grain" is 200 bags, **When** a container shipment of 600 bags at PKR 4,500/bag is recorded, **Then** the stock updates to 800 bags and the purchase appears in procurement history with source "Container".
2. **Given** a production entry records 10,000 meters of a variant at 3.0 grams/meter, **When** the entry is saved, **Then** the system auto-calculates 30,000 grams (30 kg = 1.2 bags) consumed and deducts from the corresponding grain type stock.
3. **Given** the low-stock threshold for "Type A Grain" is set to 50 bags, **When** stock falls to 48 bags after a production entry, **Then** the owner receives a low-stock alert notification.
4. **Given** two spot market purchases at different rates occurred this month, **When** the owner views the raw material procurement report, **Then** both purchases are listed with their individual rates, dates, and the weighted average cost is displayed.

---

### User Story 3 — Gate Pass Creation & Automated Stock/Ledger Updates (Priority: P3)

A logistics manager needs to dispatch finished goods to a client. Currently, gate passes are handwritten in booklets, sent with the delivery vehicle, the client signs a receiving copy, the driver brings it back, and it is filed physically. The new system digitizes this entire flow.

The manager opens the gate pass screen, selects the client from a dropdown (populated from the client list), enters the date, his name as the issuing manager, and the current shift. He adds one or more zipper variants with the meters being dispatched for each. The system generates a printable gate pass in a layout provided by the client. Each gate pass includes a QR code — when the client (or driver upon return) scans the QR code, the gate pass is marked as "Received" and the confirmation uploads to the cloud.

When a gate pass is generated, three things happen automatically in a single transaction: (1) finished goods stock is deducted by the dispatched meters per variant, (2) the client's financial ledger is debited (meters × the agreed per-meter rate = amount added to outstanding balance), and (3) a payment due date is set from the delivery date based on the client's configured payment cycle (default: 30 days; configurable per client to support 45-day, 60-day, or custom cycles). All gate passes are permanently stored in the cloud, eliminating the need to retain physical copies beyond a month.

**Why this priority**: Gate passes are the critical bridge between production/inventory and finance. They trigger stock movement and financial obligations. Digitizing them eliminates lost paperwork, enables remote monitoring of dispatches (especially night-shift deliveries), and ensures the ledger stays in sync with actual deliveries. This is the second delivery milestone per the constitution.

**Independent Test**: Can be tested by creating a gate pass for a client with 2 variants, verifying stock deduction, ledger debit creation, payment due date per the client's configured cycle, printable output, and QR code scanning flow — all independently demonstrable.

**Acceptance Scenarios**:

1. **Given** Client "Alkaram" has an agreed rate of PKR 5.50/meter for variant "V-101", a configured payment cycle of 30 days, and current stock of "V-101" is 50,000 meters, **When** a gate pass is created dispatching 10,000 meters of "V-101", **Then** stock of "V-101" drops to 40,000 meters, a ledger debit of PKR 55,000 is created for Alkaram, and a payment due date based on their 30-day payment cycle is set.
2. **Given** a gate pass has been printed and sent with the delivery vehicle, **When** the QR code on the gate pass is scanned at the client's receiving dock, **Then** the gate pass status changes to "Received" with a timestamp and the confirmation is visible in the cloud immediately.
3. **Given** a manager attempts to create a gate pass for 60,000 meters of "V-101" but only 50,000 meters are in stock, **Then** the system prevents the gate pass from being generated and displays an insufficient stock warning.
4. **Given** the owner is checking his phone at midnight, **When** a Night shift gate pass was just created, **Then** the owner sees the new gate pass in his feed with client name, variants, meters dispatched, and total value.

---

### User Story 4 — Order Management with Finance Approval & Production Notification (Priority: P4)

A client places an order (communicated via call or WhatsApp to the marketing team — outside the system). The marketing team relays the order to the finance team. Before entering the order, the finance team checks the client's payment history and outstanding balance to decide whether to approve the order.

Once approved, finance inputs the order: client name (from dropdown), zipper variant, total meters ordered, rate per meter, and delivery timeline. When the order is saved, the production manager receives a notification with the variant, meters required, and delivery deadline — but the rate per meter is hidden from production (production must never see pricing).

An order dashboard shows each client's orders: total meters ordered vs. meters delivered so far, with a status indicator (Pending, Ongoing, Completed). As gate passes are created against an order, the delivered meters accumulate. When delivered meters equal ordered meters, the order automatically transitions to "Completed." Clicking on any client reveals their full order history from day one.

**Why this priority**: Orders drive the entire production-to-dispatch pipeline. Without order tracking, there is no way to know what to produce, for whom, or by when. The finance approval step is a critical business control preventing deliveries to clients with poor payment history. The rate-hiding from production is a key confidentiality requirement.

**Independent Test**: Can be tested by entering an order, verifying the production manager receives a notification (without rate), partially fulfilling via a gate pass, seeing the order status update, and auto-completing when fully delivered.

**Acceptance Scenarios**:

1. **Given** Client "Nishat" has PKR 200,000 outstanding and their credit limit allows new orders, **When** the finance team enters an order for 50,000 meters of "V-205" at PKR 6.00/meter with a 15-day delivery timeline, **Then** the order is saved and the production manager receives a notification showing "Nishat — V-205 — 50,000 meters — Deliver by [date]" with no rate information.
2. **Given** an order for 50,000 meters exists and 30,000 meters have been delivered via gate passes, **When** the order dashboard is viewed, **Then** it shows "30,000 / 50,000 meters delivered" with status "Ongoing".
3. **Given** an order for 50,000 meters has had 50,000 meters delivered across multiple gate passes, **When** the last gate pass is generated fulfilling the remaining meters, **Then** the order status automatically changes to "Completed".
4. **Given** a production manager is logged in, **When** he views order details, **Then** he sees variant, meters, and delivery date but the rate per meter and total value fields are completely absent from the response.

---

### User Story 5 — Client Ledger & Payment Tracking (Priority: P5)

Each of the 20–25 major clients has a running financial ledger from the day they are onboarded. The ledger operates on a debit/credit model:

- **Debits** (goods delivered) are auto-populated every time a gate pass is generated — the system calculates meters × the rate per meter at the time of the gate pass and adds it as a debit entry. Rates are locked at gate-pass time; historical rates are preserved even when rates change later.
- **Credits** (payments received) are manually entered by the finance team: amount, date, and payment mode (cash, cheque, bank transfer).
- **Outstanding balance** = total debits minus total credits.
- **Overdue amounts** = any outstanding amount past the client's configured payment cycle deadline (default 30 days; configurable per client to 45, 60, or custom days). Overdue items are highlighted in red with a days-overdue counter.

Rates can be manually updated by finance when market conditions change (e.g., raw material cost increase, petrol price hike). The new rate applies only to future gate passes; historical transactions retain their original rates. New clients can be added at any time. The full ledger for any client is downloadable.

**Why this priority**: The client ledger is the financial backbone — it tells the owner who owes how much and who is late paying. This directly impacts cash flow management. It depends on gate passes being in place (P3) but provides the financial accountability layer the owner needs.

**Independent Test**: Can be tested by creating a client, generating a gate pass (auto-debit), recording a payment (credit), and verifying the outstanding balance, overdue highlighting, and downloadable ledger output.

**Acceptance Scenarios**:

1. **Given** Client "Alkaram" has a total debit of PKR 5,00,000 and total credits of PKR 3,50,000, **When** the finance team views Alkaram's ledger, **Then** the outstanding balance shows PKR 1,50,000 and individual overdue entries past the client's configured payment cycle deadline are highlighted in red with "X days overdue".
2. **Given** a gate pass for 10,000 meters at PKR 5.50/meter is generated for "Alkaram", **When** the gate pass is saved, **Then** a debit of PKR 55,000 appears in Alkaram's ledger with the gate pass reference, date, variant, meters, and rate.
3. **Given** the rate for "V-101" was PKR 5.50/meter last month and has been updated to PKR 6.00/meter today, **When** viewing the ledger history, **Then** last month's gate pass entries still show PKR 5.50/meter and any new gate passes use PKR 6.00/meter.
4. **Given** a payment of PKR 2,00,000 is received from "Nishat" via cheque, **When** finance records the payment with cheque number and date, **Then** Nishat's outstanding balance decreases by PKR 2,00,000 and the payment appears as a credit entry in the ledger.
5. **Given** the finance team wants to share Alkaram's ledger for reconciliation, **When** they click "Download Ledger", **Then** the full transaction history downloads in a printable format with all debits, credits, dates, and running balance.

---

### User Story 6 — Expense & Voucher Management with Approval Workflow (Priority: P6)

Every company expense is recorded as a voucher. The finance team enters: title (brief description), detailed description, date, amount, expense category (from a configurable dropdown), payment mode (cash or cheque — if cheque, the cheque number is recorded), and the company name (dropdown — the business operates through 2–3 companies with different tax structures).

Expense categories are configurable and include: Factory Expenses, Director Expenses, Shareholder/Dividend Payments, Charity, Head Office, Raw Material (with grain sub-categories), Utilities, Transport, and others. The owner can add new categories at any time.

Vouchers above PKR 2,00,000 require super admin (owner) approval before they are processed. The owner receives a mobile notification with the voucher details and can approve or reject remotely. Vouchers below PKR 2,00,000 are auto-approved but remain visible to the owner for review.

A monthly financial report shows: opening cash balance → total inflow (payments received from clients + other income) → total outflow (sum of all vouchers/expenses) → closing cash balance, with a category-wise breakdown of all expenses.

**Why this priority**: Expense management completes the financial picture — the owner needs to see not just what clients owe, but where money is going. The approval workflow for large expenses is a critical financial control. This pairs with the client ledger (P5) to form the complete Finance module.

**Independent Test**: Can be tested by creating vouchers at various amounts, verifying the approval workflow triggers for amounts above PKR 2,00,000, and generating a monthly report with category breakdowns — independent of production or dispatch modules.

**Acceptance Scenarios**:

1. **Given** a finance staff member needs to record a factory maintenance expense, **When** they create a voucher for PKR 1,50,000 under category "Factory Expenses" paid by cash for "Company A", **Then** the voucher is auto-approved and visible in the expense list and to the owner.
2. **Given** a finance staff member creates a voucher for PKR 3,00,000 for raw material purchase, **When** the voucher is saved, **Then** the owner receives a mobile notification requesting approval, and the voucher remains in "Pending Approval" status until the owner approves or rejects it.
3. **Given** the owner receives an approval request on his phone while travelling, **When** he reviews the voucher details and taps "Approve", **Then** the voucher status changes to "Approved" and is included in expense calculations.
4. **Given** it is month-end and multiple vouchers have been recorded across categories, **When** the monthly financial report is generated, **Then** it displays opening balance, total inflow, total outflow, closing balance, and a category-wise breakdown showing exactly how much was spent on Factory, Director, Raw Material, etc.
5. **Given** the owner decides a new expense category "Legal Fees" is needed, **When** he adds the category through settings, **Then** the new category immediately appears in the voucher creation dropdown for all finance users.

---

### User Story 7 — Owner Dashboard & Real-Time Monitoring (Priority: P7)

After selecting their name from the user list, the owner (super admin) lands on a modern, visually rich dashboard that serves as the command center for the entire business — designed to feel like a modern SaaS analytics panel with clean cards, data visualization, and quick-glance KPIs at the top. The dashboard displays:

- **KPI Cards** at the top (clean card layout): today's total production (meters across both plants), pending orders count, total overdue payments (amount in PKR), and current finished goods stock.
- **Production Trend Charts**: line and bar charts showing daily, weekly, and monthly meters produced across both plants, with the ability to filter by plant or variant.
- **Shift-Wise Production Comparison**: side-by-side bar chart comparing Day shift vs. Night shift output, enabling the owner to spot productivity differences between shifts.
- **Revenue Overview**: bar chart of monthly inflow (payments received) vs. outflow (expenses/vouchers), providing a clear cash flow picture.
- **Stock Levels per Variant**: horizontal bar chart showing current finished goods stock for each zipper variant.
- **Overdue Payments Summary**: donut or pie chart showing overdue amounts broken down by client, enabling quick identification of problematic accounts.
- **Pending Orders Count**: visible as a KPI card and as a drill-down list.
- **Recent Gate Passes List**: a live feed of the latest gate passes created with client name, variants, meters dispatched, and timestamps.
- **Recent Activity Feed**: a live feed of the latest orders entered, vouchers recorded, and production entries submitted.

All charts are interactive with hover tooltips showing exact values. The dashboard is fully responsive — the owner primarily views it on his mobile phone while away from the factory, especially during night shifts and weekend deliveries. The overall aesthetic should be a clean, modern SaaS analytics panel with consistent card-based layout, professional color palette, and smooth data visualizations.

**Why this priority**: The dashboard is the owner's primary interaction with the system. However, it depends on data flowing through all other modules (production, inventory, gate passes, orders, finance), which is why it is prioritized after the data-entry modules. It is the final piece that makes the entire system valuable for the owner's remote monitoring needs.

**Independent Test**: Can be tested by populating sample data across modules and verifying that all KPI cards, charts, and the activity feed display correctly on both desktop and a 375px mobile viewport, with interactive tooltips working.

**Acceptance Scenarios**:

1. **Given** today's production across both plants totals 25,000 meters, there are 8 pending orders, PKR 12,00,000 in overdue payments, and 1,50,000 meters total stock, **When** the owner opens the dashboard on his phone, **Then** four KPI cards display these numbers prominently at the top in a clean card-based layout.
2. **Given** production data has been entered for the past 30 days, **When** the owner views the production trend chart, **Then** he sees a line/bar chart with daily production values, can hover for exact numbers, can filter by plant or variant, and can view a shift-wise comparison (Day vs. Night) as a side-by-side bar chart.
3. **Given** gate passes, orders, and vouchers have been created in the last hour, **When** the owner views the recent activity feed and recent gate passes list, **Then** the latest entries appear in reverse chronological order with timestamps, user who created them, and key details.
4. **Given** the owner views the dashboard on a 375px mobile screen, **When** all sections load, **Then** charts stack vertically, KPI cards are readable, and all interactive elements have touch-friendly tap targets of at least 44×44 pixels.

---

### User Story 8 — User Roles, Access Control & System Administration (Priority: P8)

The system supports role-based access control with the following predefined roles. In v1, there is no password-based login — users select their name from a pre-loaded list (kiosk mode), similar to a shared-device factory terminal. This is appropriate for the controlled factory environment where physical access implies authorization. Proper authentication with passwords/OTP will be implemented in Phase 2. The predefined roles are:

- **Super Admin (Owner)**: Full unrestricted access to all modules, ability to create and manage user accounts, approve high-value vouchers, edit or override saved records, and configure system settings (categories, thresholds, client rates).
- **Finance Head**: Full access to orders, client ledgers, vouchers/expenses, and read-only access to stock/inventory. No access to production entry.
- **Production Head**: Access to production data entry and stock viewing. Receives order notifications with variant, meters, and deadline — but rate per meter and all financial data are completely hidden.
- **Logistics Head**: Access to create gate passes, track deliveries, and view stock (read-only). No access to financial data or production entry.
- **Marketing Head**: Read-only view of orders and client list. No data input capabilities.

Approximately 5–6 user accounts are needed initially. Only one trained operator inputs production data (though the production head can also enter). No user except the super admin can edit or delete saved records — all other users operate in an append-only mode. The sidebar navigation adapts to show only the modules and screens relevant to each user's role.

**Why this priority**: RBAC is a foundational requirement (per the constitution, it is a prerequisite for feature completion). However, it is listed at P8 for independent testing purposes because it can be verified independently — each role's access can be tested by logging in and confirming visible/hidden modules. In practice, RBAC enforcement is built alongside each module.

**Independent Test**: Can be tested by creating user accounts for each role, logging in with each, and verifying that the correct modules are visible, financial data is hidden from production, and only the super admin can edit saved records.

**Acceptance Scenarios**:

1. **Given** a user account with the "Production Head" role, **When** the user selects their name from the user list, **Then** the sidebar shows only Production and Stock modules, order notifications show variant/meters/deadline but no rates, and attempting to access finance URLs returns an access denied response.
2. **Given** a "Finance Head" user is logged in, **When** they view the stock/inventory screen, **Then** they can see current stock levels but cannot create production entries or gate passes.
3. **Given** a "Logistics Head" user creates a gate pass, **When** they attempt to view a client's ledger, **Then** the system denies access and the ledger menu item is not visible in navigation.
4. **Given** the super admin needs to correct a data entry error, **When** they edit a previously saved production entry, **Then** the system allows the edit, preserves the original value in the audit log, and records the change with the admin's identity and timestamp.
5. **Given** a new employee joins the finance team, **When** the super admin creates a new user account with the "Finance Head" role, **Then** the new user appears in the user selection list and upon selecting their name immediately sees only the finance-relevant modules.

---

### Edge Cases

- What happens when a gate pass is created for a variant that has zero stock? The system MUST prevent the gate pass and show a clear "Insufficient stock" message with the current available quantity.
- What happens when a production entry is submitted for a date/shift/plant combination that already exists? The system MUST prevent duplicate entries and inform the operator that this shift has already been recorded.
- What happens when the electricity consumption entered is zero but meters produced is non-zero? The system MUST flag this as an anomaly (machines cannot produce without electricity).
- What happens when a client's outstanding balance exceeds a very large amount and a new order is being entered? The system MUST display the current outstanding balance prominently on the order entry screen so finance can make an informed decision.
- What happens when the internet connection drops mid-submission of a production entry? The system MUST queue the entry locally and replay it when connectivity resumes, with a visible offline indicator.
- What happens when two users attempt to create gate passes that together exceed available stock? The system MUST handle concurrent stock deductions atomically — the first gate pass succeeds, and the second receives an insufficient stock error if the remaining stock is inadequate.
- What happens when the owner rejects a high-value voucher? The voucher MUST be marked as "Rejected" with the owner's comments, and the finance team MUST be notified to take corrective action.
- What happens when a rate is updated for a variant while an order using the old rate is still being fulfilled? Existing orders retain their original rate. The new rate applies only to new orders and gate passes created after the rate change.
- What happens when a user attempts to access another plant's data? In v1, each plant's data is independent — there are no inter-plant transfers. Users see data scoped to their assigned plant(s). Cross-plant reporting is available only on the owner's dashboard.
- What happens at midnight when a Night shift (7 PM–7 AM) spans two calendar dates? The production entry date MUST correspond to the shift start date (e.g., a night shift starting on Jan 15 at 7 PM is recorded as Jan 15, even though it ends Jan 16 at 7 AM).
- What happens when scrap is recorded but no scrap sale occurs for several months? Scrap accumulates indefinitely until a sale is recorded. The system MUST show the running accumulated scrap weight clearly.

## Requirements *(mandatory)*

### Functional Requirements

**Module 1 — Production**

- **FR-001**: System MUST allow a designated operator to record a production entry by selecting: plant (from predefined list of 2 plants), shift (Day 7 AM–7 PM or Night 7 PM–7 AM), date, workers on duty (multi-select from pre-loaded worker list), zipper variant (from ~10 predefined variants), meters produced, and grams-per-meter weight.
- **FR-002**: System MUST allow the shift operator to manually enter electricity units consumed per shift by recording submeter readings at shift start and shift end. The system records these units and cross-checks against expected consumption based on the machine's kilowatt-hour rating and reported production output.
- **FR-003**: System MUST flag an electricity discrepancy alert when recorded consumption deviates significantly from expected consumption (based on machine capacity × hours run), visible to the super admin.
- **FR-004**: System MUST allow daily scrap recording by weight (in grams or kilograms) per plant/shift and maintain a running monthly scrap accumulation total.
- **FR-005**: System MUST allow recording of monthly scrap sales as a single cash transaction entry with: date, total weight sold, rate per kilogram, total cash amount received, and buyer name (optional). Scrap sales are cash-only transactions — the scrap buyer weighs the material on-site and pays immediately.
- **FR-006**: System MUST generate a Daily Progress Report (DPR) viewable per shift, per plant, showing production output, electricity usage, scrap, workers on duty, and any flagged discrepancies.
- **FR-007**: System MUST prevent duplicate production entries for the same plant + shift + date combination.
- **FR-008**: System MUST associate Night shift entries with the shift start date (e.g., night shift starting Jan 15 at 7 PM is recorded under Jan 15).

**Module 2 — Raw Material & Inventory**

- **FR-009**: System MUST allow recording of raw material purchases with: number of bags (each bag = 25 kg / 25,000 grams), rate per bag, purchase date, grain type (from ~10 predefined categories), and source (Container or Spot Market).
- **FR-010**: System MUST auto-calculate grain consumption when a production entry is saved: (grams per meter × meters produced) = total grams consumed, converted to bags consumed (÷ 25,000 grams per bag), and deducted from the corresponding grain type stock.
- **FR-011**: System MUST maintain a finished goods inventory tracking stock per zipper variant in meters.
- **FR-012**: System MUST increase finished goods stock automatically when a production entry is recorded (meters produced added to the variant's stock).
- **FR-013**: System MUST decrease finished goods stock automatically when a gate pass is generated (meters dispatched deducted from the variant's stock).
- **FR-014**: System MUST send low-stock alerts to the owner when raw material or finished goods inventory falls below a configurable threshold per item.
- **FR-015**: System MUST prevent finished goods stock from going negative — gate passes that would cause negative stock MUST be rejected.

**Module 3 — Gate Pass**

- **FR-016**: System MUST allow a logistics manager to create a gate pass by selecting: client (dropdown), date, issuing manager name, shift, and one or more zipper variants with meters for each line item.
- **FR-017**: System MUST generate a printable gate pass document with a clean default template including all line items, client details, date, and a unique gate pass number. The template MUST support customization for client-specified layout, fields, and company logo placement when the client provides the exact format. Multiple zipper variants with their respective meters can appear on a single gate pass (e.g., delivering 3 different zipper types to the same client in one trip).
- **FR-018**: System MUST generate a QR code on each gate pass that, when scanned, marks the gate pass as "Received" with a timestamp and uploads the confirmation to the cloud.
- **FR-019**: When a gate pass is saved, the system MUST atomically in a single transaction: (a) deduct finished goods stock per variant, (b) create a debit entry in the client's ledger (meters × rate = amount), and (c) set a payment due date from the delivery date based on the client's configured payment cycle (default: 30 days; configurable per client to support 45-day, 60-day, or custom cycles).
- **FR-020**: System MUST permanently store all gate passes in the cloud with full search, filter, and retrieval capabilities.
- **FR-021**: System MUST track gate pass status: Created → Dispatched → Received (via QR scan).

**Module 4 — Order Management**

- **FR-022**: System MUST allow finance users to input orders with: client name (dropdown), zipper variant, total meters ordered, rate per meter, and delivery timeline/deadline.
- **FR-023**: When an order is saved, the system MUST send a notification to the production manager containing: client name, variant, meters required, and delivery deadline — with the rate per meter explicitly excluded.
- **FR-024**: System MUST maintain an order dashboard showing per-client: total meters ordered, meters delivered to date, and order status (Pending / Ongoing / Completed).
- **FR-025**: System MUST automatically transition an order's status to "Completed" when total meters delivered (via gate passes) equals or exceeds total meters ordered.
- **FR-026**: System MUST provide a full order history per client accessible by clicking on the client, showing all orders from the client's first order onwards.
- **FR-027**: System MUST display the client's current outstanding balance on the order entry screen so finance can assess creditworthiness before entering a new order.

**Module 5A — Client Ledger**

- **FR-028**: System MUST maintain a running debit/credit ledger for each client from their onboarding date.
- **FR-029**: Debit entries MUST be auto-created from gate passes: meters × the rate per meter at the time of the gate pass.
- **FR-030**: Credit entries MUST be manually recorded by finance with: amount, date, and payment mode (cash, cheque with cheque number, or bank transfer).
- **FR-031**: System MUST calculate and display outstanding balance (total debits minus total credits) for each client.
- **FR-032**: System MUST highlight overdue amounts (past the client's configured payment cycle deadline) in red with a days-overdue counter.
- **FR-033**: System MUST allow finance to update the rate per meter for a variant — new rate applies to future gate passes only; all historical transactions retain their original rate.
- **FR-034**: System MUST allow creation of new clients at any time with relevant details (name, contact information, address, agreed rates per variant, payment cycle in days — default 30, configurable to 45/60/custom).
- **FR-035**: System MUST provide a downloadable ledger report per client showing complete transaction history with running balance.

**Module 5B — Expense/Voucher Management**

- **FR-036**: System MUST allow finance users to create expense vouchers with: title, description, date, amount, expense category (configurable dropdown), payment mode (cash or cheque — if cheque, cheque number required), and company name (dropdown from 2–3 predefined companies).
- **FR-037**: System MUST require super admin approval for vouchers with amounts of PKR 2,00,000 or above. The approval request MUST appear as a mobile notification to the super admin.
- **FR-038**: Vouchers below PKR 2,00,000 MUST be auto-approved but remain visible to the super admin for review.
- **FR-039**: System MUST allow the super admin to approve or reject vouchers remotely, with an optional comment field for rejections.
- **FR-040**: System MUST allow the super admin to create, edit, and delete expense categories at any time, including sub-categories (e.g., Raw Material → Grain Type A, Grain Type B).
- **FR-041**: System MUST generate a monthly financial report showing: opening balance, total inflow (client payments + other income), total outflow (sum of approved vouchers), closing balance, and category-wise expense breakdown.

**Module 6 — User Roles & Access Control**

- **FR-042**: System MUST enforce role-based access control on every screen and every data operation with the following predefined roles: Super Admin, Finance Head, Production Head, Logistics Head, Marketing Head.
- **FR-043**: Super Admin MUST have unrestricted access to all modules, the ability to create/manage user accounts, approve vouchers, edit saved records, and configure all system settings.
- **FR-044**: Finance Head MUST have full access to orders, client ledgers, and vouchers/expenses, with read-only access to stock/inventory.
- **FR-045**: Production Head MUST have access to production entry and stock viewing. All financial data (rates, prices, ledger balances) MUST be completely hidden from this role at the data level — not merely hidden in the UI.
- **FR-046**: Logistics Head MUST have access to gate pass creation, delivery tracking, and read-only stock viewing. No access to financial data or production entry.
- **FR-047**: Marketing Head MUST have read-only access to orders and client list only. No data input or financial data access.
- **FR-048**: No user except the super admin MUST be able to edit or delete previously saved records. All other roles operate in append-only mode.
- **FR-049**: The sidebar navigation MUST dynamically adapt to show only modules and screens relevant to the logged-in user's role.
- **FR-050**: System MUST support creation of approximately 5–6 initial user accounts with the ability to add more as needed. In v1, users access the system by selecting their name from a pre-loaded user list (kiosk mode) — no password or credentials required. The user list is managed by the super admin. Proper authentication with passwords/OTP is deferred to Phase 2.

**Cross-Module & System-Wide**

- **FR-051**: All cross-module side effects (gate pass → stock deduction → ledger entry) MUST execute within a single atomic transaction. If any step fails, the entire operation MUST roll back.
- **FR-052**: Every data mutation MUST create an audit log entry with: previous value, new value, acting user, and timestamp.
- **FR-053**: All monetary values MUST be stored and displayed in Pakistani Rupees with the "PKR" prefix (e.g., PKR 20,00,000 — not PKR 2,000,000) using South Asian number formatting (lakhs and crores). The "PKR" prefix MUST always precede the amount in all displays, reports, and exports.
- **FR-054**: All dates MUST display in DD-MM-YYYY format to the user while stored internally in ISO-8601 format.
- **FR-055**: The system MUST handle brief connectivity interruptions (up to 60 seconds) by queuing pending mutations on the client and replaying them when connectivity resumes, with a visible offline indicator.
- **FR-056**: System MUST provide an in-app-only notification system using popup alerts and badge counters within the application UI. Real-time alerts include: order notifications to production, voucher approval requests to owner, and low-stock alerts. No SMS, email, or browser push notification integration in v1.

**Reporting**

- **FR-057**: System MUST generate a Daily Progress Report per shift, per plant.
- **FR-058**: System MUST generate a monthly production summary across both plants.
- **FR-059**: System MUST generate a stock summary per variant (finished goods and raw material).
- **FR-060**: System MUST generate a client ledger report (downloadable per client).
- **FR-061**: System MUST generate an order fulfillment status report showing all orders and their completion percentage.
- **FR-062**: System MUST generate a monthly expense report with category-wise breakdown.
- **FR-063**: System MUST generate a raw material consumption vs. procurement report showing usage efficiency.
- **FR-064**: System MUST generate an overdue payments list showing all clients with past-due amounts, sorted by days overdue.

**Dashboard**

- **FR-065**: System MUST display a modern, visually rich landing dashboard after user selection, designed as a SaaS-style analytics panel with clean cards and professional data visualizations. The dashboard MUST include: (a) KPI cards at the top for quick-glance metrics (today's production, pending orders, overdue payments in PKR, total stock), (b) production trend charts — line/bar charts showing daily, weekly, and monthly meters produced with plant/variant filters, (c) shift-wise production comparison — side-by-side bar chart comparing Day vs. Night shift output, (d) revenue overview — bar chart of monthly inflow vs. outflow, (e) overdue payments summary — pie or donut chart breaking down overdue amounts by client, (f) stock levels per variant — horizontal bar chart, (g) recent gate passes list with client name/variants/meters/timestamps, and (h) a recent activity feed of orders, vouchers, and production entries.
- **FR-066**: All dashboard charts MUST be interactive with hover tooltips showing exact values.
- **FR-067**: The dashboard MUST be fully responsive and usable on a 375px mobile viewport with touch-friendly interactions.

### Key Entities

- **Plant**: A manufacturing facility. Attributes: name/identifier, location, list of machines. The company has 2 plants.
- **Machine**: A production machine within a plant. Attributes: identifier, plant it belongs to, kilowatt-hour rating, expected output capacity (meters per shift). Used for electricity validation.
- **Worker**: A factory employee who can be assigned to shifts. Attributes: name, role/designation, active status. Selected from a pre-loaded list during production entry.
- **Zipper Variant**: A specific type of plastic zipper product. Attributes: variant code, name, description, standard grams-per-meter weight, associated grain type. Approximately 10 variants.
- **Grain Type**: A category of plastic grain raw material. Attributes: name/code, description, standard bag weight (25 kg). Approximately 10 types.
- **Production Entry**: A shift-level record of manufacturing output. Attributes: plant, shift (day/night), date, workers on duty, variant produced, meters produced, grams-per-meter, electricity units consumed, scrap weight. Forms the basis of the DPR.
- **Raw Material Purchase**: A procurement record. Attributes: grain type, number of bags, rate per bag, date, source (Container/Spot Market).
- **Raw Material Stock**: Running inventory of grain per type, measured in bags.
- **Finished Goods Stock**: Running inventory of each zipper variant, measured in meters. Increases with production, decreases with gate passes.
- **Gate Pass**: A delivery document for dispatching goods. Attributes: unique number, client, date, issuing manager, shift, status (Created/Dispatched/Received), QR code, one or more line items. Triggers stock deduction and ledger debit.
- **Gate Pass Line Item**: A single variant + meters entry on a gate pass. Attributes: variant, meters dispatched, rate at time of dispatch, line total.
- **Client**: A customer of the company. Attributes: name, contact information, address, agreed rates per variant, payment cycle (default 30 days; configurable per client to 45, 60, or custom days), credit terms. Approximately 20–25 major clients.
- **Order**: A client's request for goods. Attributes: client, variant, meters ordered, rate per meter, delivery deadline, status (Pending/Ongoing/Completed), meters delivered to date.
- **Ledger Entry**: A single debit or credit transaction in a client's ledger. Attributes: type (debit/credit), amount, date, reference (gate pass number or payment details), payment mode (for credits), running balance.
- **Voucher/Expense**: A company expense record. Attributes: title, description, date, amount, category, sub-category, payment mode (cash/cheque + cheque number), company name, approval status (Auto-Approved/Pending/Approved/Rejected).
- **Expense Category**: A configurable classification for expenses. Attributes: name, parent category (for sub-categories), active status. Managed by super admin.
- **Company**: A legal entity under which business is conducted. Attributes: name, tax structure details. 2–3 companies.
- **User**: A system user. Attributes: name, role, active status. In v1, users are identified by selecting their name from a list (kiosk mode) — no email/password credentials. Approximately 5–6 initial users. Password-based authentication is a Phase 2 feature.
- **Scrap Record**: Daily waste/defective material log. Attributes: date, plant, shift, weight, running monthly total.
- **Scrap Sale**: A monthly bulk sale of accumulated scrap (cash-only transaction). Attributes: date, total weight sold, rate per kg, total cash amount received, buyer name (optional). Recorded as a single monthly entry when the scrap buyer visits the factory, weighs the material, and pays cash immediately.
- **Notification**: An in-app-only alert (popup and badge counter — no SMS or email in v1). Attributes: recipient user/role, type (order, approval request, low stock, etc.), message, read status, timestamp.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A production operator can complete a full shift entry (plant, shift, date, workers, variant, meters, grams/meter, electricity, scrap) in under 3 minutes on a mobile device.
- **SC-002**: The factory owner can view the current day's production summary (DPR) on his mobile phone within 5 seconds of opening the dashboard, reflecting data entered within the last 60 seconds.
- **SC-003**: When a gate pass is generated, the corresponding stock deduction and client ledger debit appear in the system within 2 seconds, with no manual reconciliation required.
- **SC-004**: 100% of gate passes, production entries, and financial transactions are permanently stored with complete audit trails — no data loss under any connectivity scenario tested.
- **SC-005**: The system supports 20–25 concurrent users (factory operators, finance staff, logistics, owner) without performance degradation on screens or data entry forms.
- **SC-006**: Overdue payment amounts are correctly identified and highlighted for 100% of client accounts past their configured payment cycle deadline (default 30 days; may be 45, 60, or custom days per client), with accurate days-overdue counters.
- **SC-007**: The production head can view order details (variant, meters, deadline) but has zero visibility into rates, prices, or any financial data — verified by role-based testing of every screen and data response.
- **SC-008**: Voucher approval requests for amounts ≥ PKR 2,00,000 reach the owner's mobile device within 30 seconds of submission.
- **SC-009**: The raw material auto-consumption calculation matches manual calculation (grams/meter × meters produced ÷ 25,000 grams per bag) with 100% accuracy for every production entry.
- **SC-010**: The monthly financial report (opening balance → inflow → outflow → closing balance) reconciles to within PKR 0 variance when cross-checked against individual ledger and voucher entries.
- **SC-011**: All screens load and are fully interactive on a 375px mobile viewport within 3 seconds on a 4G connection, with touch targets of at least 44×44 pixels.
- **SC-012**: The system correctly handles the transition from handwritten gate passes to digital — within the first month of use, 100% of dispatches are processed through the digital gate pass system with no parallel paper process needed.
- **SC-013**: Electricity discrepancy alerts are generated for 100% of cases where recorded consumption deviates from expected consumption by more than a configurable tolerance threshold.
- **SC-014**: The client ledger outstanding balance matches the sum of (all debits – all credits) for every client at all times, verified by automated reconciliation checks.

## Assumptions

- **Users and connectivity**: Factory staff have intermittent broadband internet at the factory site. The owner relies on 4G mobile. The system must tolerate brief connectivity drops (up to 60 seconds) without data loss, per the constitution's Cloud-Native & Offline-Resilient principle.
- **Single currency**: All transactions are in Pakistani Rupees (PKR). No multi-currency support is required.
- **English UI**: The user interface is in English for v1. Urdu translation is a future consideration — all UI text will be externalized for localization readiness.
- **Number formatting**: South Asian convention (lakhs and crores) per the constitution's Pakistani Business Context principle.
- **HR Module**: The HR Head role and HR module are explicitly out of scope for v1. The role placeholder exists in the description but will be defined and built in a future release.
- **Gate pass layout**: The client will provide the exact gate pass printable format (layout, fields, company logo placement) during development. For v1, a clean default template will be implemented that can be customized when the client's exact specifications arrive.
- **QR code scanning**: The QR code on gate passes can be scanned by any standard smartphone camera or QR reader app. Scanning triggers a confirmation via a web URL embedded in the QR code — no custom mobile app is required for scanning.
- **Authentication method**: v1 uses simple user selection (pick your name from a pre-loaded list) similar to a kiosk mode — no password, no login credentials required. This is appropriate for the controlled factory environment where physical access to the terminal implies authorization. Proper authentication with passwords/OTP is a Phase 2 feature. No SSO or OAuth integration is required.
- **Client rate structure**: Each client has agreed-upon rates per zipper variant. Rates are set and updated manually by finance. There is no automated pricing engine or volume discount logic.
- **Grain-to-variant mapping**: Each zipper variant uses a specific grain type. The grams-per-meter specification on the variant determines consumption of that grain type when production is recorded.
- **Scrap is not variant-specific**: Scrap is recorded as a general weight per shift, not broken down by variant. All scrap is aggregated monthly for bulk sale regardless of origin.
- **Order-to-gate-pass linking**: Gate passes can be linked to orders to track fulfillment. If a gate pass is created without an associated order (e.g., a spot delivery), it still deducts stock and creates a ledger entry but does not affect order fulfillment tracking.
- **Browser support**: Latest versions of Chrome, Safari (iOS), and Edge. No Internet Explorer support.
- **Electricity validation tolerance**: The threshold for flagging electricity discrepancies is configurable by the super admin (e.g., ±15% deviation from expected).
- **Data migration**: No legacy data migration is required for v1. The system starts fresh; historical data from the paper-based system is not imported.
- **Notification delivery**: In-app notifications only (popup alerts and badge counters within the application UI). No SMS, email, or browser push notifications in v1.
- **Inter-plant transfers**: Not supported in v1. Each plant's data is independent. There are no transfers of finished goods, raw materials, or workers between plants tracked in the system. Cross-plant data is visible only on the owner's aggregated dashboard.
- **Backup and retention**: Cloud-hosted data is backed up automatically. No specific retention period is mandated — all data is retained indefinitely.
- **Regulatory compliance**: No FBR (Federal Board of Revenue) e-invoicing or tax filing integration is required for v1, but the audit trail design supports future compliance needs.

## Clarifications

### Session 2025-07-17

- Q: How do users authenticate in v1? → A: Simple user selection from a pre-loaded list (kiosk mode). No passwords. Phase 2 adds password/OTP authentication.
- Q: What gate pass printable format should be used? → A: Clean default template for v1; client will provide exact layout/fields/logo placement later for customization.
- Q: How should currency be displayed? → A: Always "PKR" prefix with Pakistani number formatting (lakhs/crores, e.g., PKR 20,00,000).
- Q: Is the 30-day payment cycle fixed? → A: Default is 30 days, but configurable per client (some clients have 45-day or 60-day cycles).
- Q: How does scrap sale work? → A: Cash transaction. Scrap buyer comes, weighs scrap, pays cash. Recorded as single monthly entry (date, weight, rate/kg, total amount, buyer name optional).
- Q: How are electricity units captured? → A: Manually entered by shift operator who reads the submeter at shift start and end. System records units and cross-checks against expected consumption.
- Q: Can multiple variants go in a single gate pass? → A: Yes, e.g., delivering 3 different zipper types to the same client in one trip.
- Q: Does the system handle inter-plant transfers? → A: No, not in v1. Each plant's data is independent.
- Q: What should the dashboard look like? → A: Modern SaaS analytics panel with KPI cards, production trend line/bar charts, shift-wise comparison, revenue bar chart (inflow vs outflow), overdue payments pie/donut chart, stock levels horizontal bar chart, recent gate passes list, and activity feed.
- Q: What notification channels are supported? → A: In-app only (popup alerts and badge counters). No SMS or email in v1.
