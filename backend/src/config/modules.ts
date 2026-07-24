/**
 * Registry of sellable feature modules, keyed to match the route prefixes
 * mounted in src/routes/index.ts. This is the source list seeded into the
 * `Module` table; Plans reference a subset of these keys via PlanModule.
 */
export interface ModuleDefinition {
  key: string;
  name: string;
  description: string;
  sortOrder: number;
}

export const MODULE_DEFINITIONS: ModuleDefinition[] = [
  { key: 'dashboard', name: 'Dashboard', description: 'Cross-module KPI dashboard', sortOrder: 0 },
  { key: 'production', name: 'Production', description: 'Shift-based production logging, recipes, raw material consumption', sortOrder: 10 },
  { key: 'inventory', name: 'Inventory', description: 'Raw material and finished goods stock tracking', sortOrder: 20 },
  { key: 'packaging', name: 'Packaging', description: 'Packaging material inventory', sortOrder: 25 },
  { key: 'gate-pass', name: 'Gate Pass', description: 'Dispatch, QR-verified receipt, sales returns', sortOrder: 30 },
  { key: 'orders', name: 'Orders', description: 'Client order tracking and fulfillment', sortOrder: 40 },
  { key: 'finance', name: 'Finance', description: 'Client ledger, payments, vouchers, reports', sortOrder: 50 },
  { key: 'accounting', name: 'Accounting', description: 'Chart of accounts, journal entries, general ledger, trial balance', sortOrder: 55 },
  { key: 'hr', name: 'HR & Payroll', description: 'Workers, salary rates, advances, payroll', sortOrder: 60 },
  { key: 'cost-price', name: 'Cost Price Reports', description: 'Per-variant cost price and margin analysis', sortOrder: 65 },
  { key: 'monthly-overheads', name: 'Monthly Overheads', description: 'Overhead allocation for cost pricing', sortOrder: 66 },
  { key: 'settings', name: 'Settings', description: 'Plants, machines, variants, clients, users, system configuration', sortOrder: 90 },
];

export const MODULE_KEYS = MODULE_DEFINITIONS.map((m) => m.key);
