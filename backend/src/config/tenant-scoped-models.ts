/**
 * Prisma model names (as declared in schema.prisma, PascalCase) that carry a
 * nullable organizationId column and should be auto-scoped by the tenant
 * context extension in config/database.ts. Child/line-item tables that are
 * always accessed through an already-scoped parent id (GatePassLineItem,
 * OrderLineItem, JournalEntryLine, SalesReturnLineItem, VariantIngredient,
 * RecipeIngredient, ProductionEntryWorker, ProductionShiftVariant,
 * ProductionBatchConsumption, WorkerSalaryRate, WorkerAdvance) are
 * deliberately excluded — they have no organizationId column of their own.
 */
export const TENANT_SCOPED_MODELS = new Set<string>([
  'User',
  'Company',
  'Plant',
  'Machine',
  'Worker',
  'ProductVariant',
  'Recipe',
  'RawMaterialType',
  'ScrapSale',
  'RawMaterialPurchase',
  'Vendor',
  'RawMaterialBatch',
  'ElectricityRate',
  'RawMaterialStock',
  'FinishedGoodsStock',
  'Client',
  'ClientRate',
  'GatePass',
  'SalesReturn',
  'Order',
  'Account',
  'JournalEntry',
  'Voucher',
  'ExpenseCategory',
  'Notification',
  'AuditLog',
  'SystemSetting',
  'PayrollRecord',
  'MonthlyOverhead',
  'PackagingMaterial',
  'PackagingStockAdjustment',
]);
