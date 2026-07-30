import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { randomBytes, scryptSync } from 'crypto';

// Duplicated from src/utils/password.ts on purpose — the Dockerfile compiles
// this file in isolation (`tsc prisma/seed.ts --outDir dist/prisma`), so it
// must not import from src/ or the output path/module graph can shift.
function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

// All seed data belongs to the legacy/default tenant (organizationId = null
// — the original single-tenant zipper deployment predating Phase 2's
// multi-tenancy). Compound unique keys like `organizationId_code` require a
// non-null value in Prisma's generated types, so `.upsert()` can't target a
// null-organizationId row directly; find-then-write instead.
async function upsertAccountByCode(code: string, create: Parameters<typeof prisma.account.create>[0]['data'], update: Parameters<typeof prisma.account.update>[0]['data'] = {}) {
  const existing = await prisma.account.findFirst({ where: { code, organizationId: null } });
  if (existing) {
    return Object.keys(update).length ? prisma.account.update({ where: { id: existing.id }, data: update }) : existing;
  }
  return prisma.account.create({ data: create });
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter, log: ['error'] });

async function main() {
  console.log('🌱 Starting production seed...');

  // ─── 1. Users ───────────────────────────────────────────────────────────
  // Dev-only default password for every seeded demo user — not for production tenants.
  console.log('👤 Seeding users...');
  const DEV_PASSWORD = 'Passw0rd!';
  const usersData = [
    { name: 'Owner', email: 'owner@zipdemo.local', role: 'SUPER_ADMIN' as const },
    { name: 'Finance Head', email: 'finance@zipdemo.local', role: 'FINANCE_HEAD' as const },
    { name: 'Production Head', email: 'production@zipdemo.local', role: 'PRODUCTION_HEAD' as const },
    { name: 'Logistics Head', email: 'logistics@zipdemo.local', role: 'LOGISTICS_HEAD' as const },
    { name: 'Marketing Head', email: 'marketing@zipdemo.local', role: 'MARKETING_HEAD' as const },
    { name: 'HR Head', email: 'hr@zipdemo.local', role: 'HR_HEAD' as const },
    { name: 'Data Entry Operator', email: 'data-entry@zipdemo.local', role: 'PRODUCTION_HEAD' as const },
  ];

  for (const u of usersData) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name, role: u.role },
      create: { name: u.name, email: u.email, passwordHash: hashPassword(DEV_PASSWORD), role: u.role },
    });
  }
  console.log(`   Demo login password for all seeded users: ${DEV_PASSWORD}`);
  const admin = await prisma.user.findFirst({ where: { email: 'owner@zipdemo.local' } });
  const adminId = admin!.id;

  // ─── 2. Chart of Accounts ──────────────────────────────────────────────
  console.log('📒 Seeding chart of accounts...');

  const acc1000 = await upsertAccountByCode('1000', { code: '1000', name: 'Assets', accountType: 'ASSET', isGroup: true });
  const acc2000 = await upsertAccountByCode('2000', { code: '2000', name: 'Liabilities', accountType: 'LIABILITY', isGroup: true });
  const acc3000 = await upsertAccountByCode('3000', { code: '3000', name: 'Equity', accountType: 'EQUITY', isGroup: true });
  const acc4000 = await upsertAccountByCode('4000', { code: '4000', name: 'Revenue', accountType: 'REVENUE', isGroup: true });
  const acc5000 = await upsertAccountByCode('5000', { code: '5000', name: 'Expenses', accountType: 'EXPENSE', isGroup: true });

  const leafAccounts = [
    { code: '1100', name: 'Cash', type: 'ASSET' as const, parentId: acc1000.id, isGroup: false },
    { code: '1200', name: 'Bank', type: 'ASSET' as const, parentId: acc1000.id, isGroup: false },
    { code: '1300', name: 'Accounts Receivable', type: 'ASSET' as const, parentId: acc1000.id, isGroup: true },
    { code: '1400', name: 'Inventory - Finished Goods', type: 'ASSET' as const, parentId: acc1000.id, isGroup: false },
    { code: '1500', name: 'Inventory - Raw Materials', type: 'ASSET' as const, parentId: acc1000.id, isGroup: false },
    { code: '2100', name: 'Accounts Payable', type: 'LIABILITY' as const, parentId: acc2000.id, isGroup: false },
    { code: '3100', name: "Owner's Equity", type: 'EQUITY' as const, parentId: acc3000.id, isGroup: false },
    { code: '4100', name: 'Sales Revenue', type: 'REVENUE' as const, parentId: acc4000.id, isGroup: false },
    { code: '4200', name: 'Scrap Sales Revenue', type: 'REVENUE' as const, parentId: acc4000.id, isGroup: false },
    { code: '5100', name: 'Factory Expenses', type: 'EXPENSE' as const, parentId: acc5000.id, isGroup: false },
    { code: '5200', name: 'Director Expenses', type: 'EXPENSE' as const, parentId: acc5000.id, isGroup: false },
    { code: '5300', name: 'Shareholder/Dividend', type: 'EXPENSE' as const, parentId: acc5000.id, isGroup: false },
    { code: '5400', name: 'Charity', type: 'EXPENSE' as const, parentId: acc5000.id, isGroup: false },
    { code: '5500', name: 'Head Office', type: 'EXPENSE' as const, parentId: acc5000.id, isGroup: false },
    { code: '5600', name: 'Raw Material Purchases', type: 'EXPENSE' as const, parentId: acc5000.id, isGroup: false },
    { code: '5700', name: 'Utilities', type: 'EXPENSE' as const, parentId: acc5000.id, isGroup: false },
    { code: '5800', name: 'Transport', type: 'EXPENSE' as const, parentId: acc5000.id, isGroup: false },
    { code: '5900', name: 'Other Expenses', type: 'EXPENSE' as const, parentId: acc5000.id, isGroup: false },
  ];

  for (const acc of leafAccounts) {
    await upsertAccountByCode(acc.code, {
      code: acc.code,
      name: acc.name,
      accountType: acc.type,
      parentId: acc.parentId,
      isGroup: acc.isGroup,
    });
  }

  // ─── 3. Expense Categories ─────────────────────────────────────────────
  console.log('🏷️  Seeding expense categories...');

  const parentCatNames = [
    'Factory Expenses', 'Director Expenses', 'Raw Material',
    'Utilities', 'Transport', 'Shareholder/Dividend', 'Charity', 'Head Office',
  ];
  const parentMap: Record<string, string> = {};
  for (const name of parentCatNames) {
    let cat = await prisma.expenseCategory.findFirst({ where: { name, parentId: null } });
    if (!cat) {
      cat = await prisma.expenseCategory.create({ data: { name, createdBy: adminId } });
    }
    parentMap[name] = cat.id;
  }

  const subCategories = [
    { name: 'Electrical Repair', parentName: 'Factory Expenses' },
    { name: 'Machine Maintenance', parentName: 'Factory Expenses' },
    { name: 'Labor', parentName: 'Factory Expenses' },
    { name: 'Travel', parentName: 'Director Expenses' },
    { name: 'Entertainment', parentName: 'Director Expenses' },
    { name: 'Grade A (SG-A) - 27k/bag', parentName: 'Raw Material' },
    { name: 'Grade B (SG-B) - 22k/bag', parentName: 'Raw Material' },
    { name: 'Grade C (SG-C) - 24k/bag', parentName: 'Raw Material' },
    { name: 'Electricity', parentName: 'Utilities' },
    { name: 'Water', parentName: 'Utilities' },
    { name: 'Gas', parentName: 'Utilities' },
    { name: 'Local', parentName: 'Transport' },
    { name: 'Inter-city', parentName: 'Transport' },
  ];

  for (const sc of subCategories) {
    const existing = await prisma.expenseCategory.findFirst({
      where: { name: sc.name, parentId: parentMap[sc.parentName] },
    });
    if (!existing) {
      await prisma.expenseCategory.create({
        data: { name: sc.name, parentId: parentMap[sc.parentName], createdBy: adminId },
      });
    }
  }

  // ─── 4. System Settings ────────────────────────────────────────────────
  console.log('⚙️  Seeding system settings...');
  const settingsData = [
    { key: 'electricity_discrepancy_threshold', value: '15', description: 'Percentage threshold for electricity consumption discrepancy alerts' },
    { key: 'voucher_approval_threshold_paisa', value: '20000000', description: 'Voucher amount (in paisa) above which approval is required (200,000 PKR)' },
    { key: 'verify_token_expiry_hours', value: '48', description: 'Hours before gate pass verify token expires' },
  ];

  for (const s of settingsData) {
    const existing = await prisma.systemSetting.findFirst({ where: { key: s.key, organizationId: null } });
    if (existing) {
      await prisma.systemSetting.update({ where: { id: existing.id }, data: { value: s.value, description: s.description } });
    } else {
      await prisma.systemSetting.create({ data: { key: s.key, value: s.value, description: s.description } });
    }
  }

  // ─── 5. Raw Material Types ────────────────────────────────────────────────────
  // Three raw material grades derived from the product cost formulas.
  // Bag cost is set at purchase time (FIFO); grade here identifies the material.
  console.log('🌾 Seeding raw material types...');
  const rawMaterialTypeData = [
    { code: 'SG-A', name: 'Standard Grade A', description: 'Standard grade — 27,000 Rs/25 kg bag. Used for SL-11 and PEF-13/12/11.' },
    { code: 'SG-B', name: 'Standard Grade B', description: 'Standard grade — 22,000 Rs/25 kg bag. Used for S3a.' },
    { code: 'SG-C', name: 'Standard Grade C', description: 'Standard grade — 24,000 Rs/25 kg bag. Used for Rice Zipper and SL-25.' },
  ];

  const rawMaterialTypeMap: Record<string, string> = {};
  for (const g of rawMaterialTypeData) {
    const existingGrain = await prisma.rawMaterialType.findFirst({ where: { code: g.code, organizationId: null } });
    const grain = existingGrain
      ? await prisma.rawMaterialType.update({ where: { id: existingGrain.id }, data: { name: g.name, description: g.description } })
      : await prisma.rawMaterialType.create({ data: { code: g.code, name: g.name, description: g.description, bagWeightGrams: 25000, createdBy: adminId } });
    rawMaterialTypeMap[g.code] = grain.id;

    // Ensure a zero-stock entry exists for each raw material type
    const stockExists = await prisma.rawMaterialStock.findUnique({ where: { rawMaterialTypeId: grain.id } });
    if (!stockExists) {
      await prisma.rawMaterialStock.create({
        data: { rawMaterialTypeId: grain.id, currentBags: 0, createdBy: adminId },
      });
    }
  }

  // ─── 6. Packaging Materials (Cartons) ─────────────────────────────────
  // One carton type per unique (meters-per-carton, price) combination from formulas.
  console.log('📦 Seeding packaging materials...');
  const packagingData = [
    { name: 'Carton (2500 m)', ratePerUnitPaisa: BigInt(40000) },  // 400 Rs — SL-11
    { name: 'Carton (4000 m)', ratePerUnitPaisa: BigInt(40000) },  // 400 Rs — S3a
    { name: 'Carton (3000 m)', ratePerUnitPaisa: BigInt(40000) },  // 400 Rs — PEF-13/12/11
    { name: 'Carton (1000 m)', ratePerUnitPaisa: BigInt(50000) },  // 500 Rs — Rice Zipper & SL-25
  ];

  const packagingMap: Record<string, string> = {};
  for (const p of packagingData) {
    let mat = await prisma.packagingMaterial.findFirst({ where: { name: p.name } });
    if (!mat) {
      mat = await prisma.packagingMaterial.create({
        data: { name: p.name, unit: 'pcs', ratePerUnitPaisa: p.ratePerUnitPaisa, currentStock: 0 },
      });
    }
    packagingMap[p.name] = mat.id;
  }

  // ─── 7. Plant & Machines ───────────────────────────────────────────────
  // kwhRating: machine power in kW (kWh per hour).
  // expectedOutputPerShift: meters produced in a 12-hour shift at rated speed.
  // Formula: electricity_cost_per_meter = (kwhRating × SHIFT_HOURS / expectedOutputPerShift) × rate
  //   SL/S3a/PEF (45 m/min): 6.75 kW, 32,400 m → 0.0025 kWh/m × 50 Rs = 0.125 Rs/m ✓
  //   Rice Zipper (18 m/min): 12.22 kW, 12,960 m → 0.01131 kWh/m × 45 Rs = 0.509 Rs/m ✓
  //   SL-25 (30 m/min):       12.22 kW, 21,600 m → 0.00679 kWh/m × 60 Rs = 0.407 Rs/m ✓
  console.log('🏭 Seeding plant & machines...');
  const existingPlant = await prisma.plant.findFirst({ where: { name: 'Main Factory', organizationId: null } });
  const plant = existingPlant ?? await prisma.plant.create({
    data: { name: 'Main Factory', location: 'Main Production Floor', createdBy: adminId },
  });

  const machineData = [
    {
      identifier: 'M-01',
      kwhRating: 6.75,
      expectedOutputPerShift: 32400,
      description: 'Standard machine — 45 m/min (SL-11, S3a, PEF-13/12/11)',
    },
    {
      identifier: 'M-02',
      kwhRating: 12.22,
      expectedOutputPerShift: 12960,
      description: 'Rice Zipper machine — 18 m/min',
    },
    {
      identifier: 'M-03',
      kwhRating: 12.22,
      expectedOutputPerShift: 21600,
      description: 'Heavy-duty machine — 30 m/min (SL-25)',
    },
  ];

  for (const m of machineData) {
    const existing = await prisma.machine.findFirst({
      where: { plantId: plant.id, identifier: m.identifier },
    });
    if (!existing) {
      await prisma.machine.create({
        data: {
          plantId: plant.id,
          identifier: m.identifier,
          kwhRating: m.kwhRating,
          expectedOutputPerShift: m.expectedOutputPerShift,
          createdBy: adminId,
        },
      });
    } else {
      await prisma.machine.update({
        where: { id: existing.id },
        data: { kwhRating: m.kwhRating, expectedOutputPerShift: m.expectedOutputPerShift },
      });
    }
  }

  // ─── 8. Product Variants ────────────────────────────────────────────────
  // Each variant has exactly one raw-material ingredient (100%) from the formula sheets.
  console.log('🤐 Seeding product variants...');
  const variantData = [
    {
      code: 'SL-11',
      name: 'SL-11',
      description: 'SL-11 zipper — 6.6 g/m, 45 m/min output',
      standardConsumptionRatio: 6.6,
      metersPerCarton: 2500,
      packagingName: 'Carton (2500 m)',
      grainCode: 'SG-A',
    },
    {
      code: 'S3A',
      name: 'S3a',
      description: 'S3a zipper — 4.1 g/m, 45 m/min output',
      standardConsumptionRatio: 4.1,
      metersPerCarton: 4000,
      packagingName: 'Carton (4000 m)',
      grainCode: 'SG-B',
    },
    {
      code: 'PEF-13',
      name: 'PEF-13/12/11',
      description: 'PEF-13/12/11 zipper — 5.5 g/m, 45 m/min output',
      standardConsumptionRatio: 5.5,
      metersPerCarton: 3000,
      packagingName: 'Carton (3000 m)',
      grainCode: 'SG-A',
    },
    {
      code: 'RICE',
      name: 'Rice Zipper',
      description: 'Rice Zipper — 30 g/m, 18 m/min output (heavy-duty bag zipper)',
      standardConsumptionRatio: 30,
      metersPerCarton: 1000,
      packagingName: 'Carton (1000 m)',
      grainCode: 'SG-C',
    },
    {
      code: 'SL-25',
      name: 'SL-25',
      description: 'SL-25 zipper — 18 g/m, 30 m/min output',
      standardConsumptionRatio: 18,
      metersPerCarton: 1000,
      packagingName: 'Carton (1000 m)',
      grainCode: 'SG-C',
    },
  ];

  for (const v of variantData) {
    const existingVariant = await prisma.productVariant.findFirst({ where: { code: v.code, organizationId: null } });
    const variant = existingVariant
      ? await prisma.productVariant.update({
          where: { id: existingVariant.id },
          data: {
            name: v.name,
            description: v.description,
            standardConsumptionRatio: v.standardConsumptionRatio,
            metersPerCarton: v.metersPerCarton,
            packagingMaterialId: packagingMap[v.packagingName],
          },
        })
      : await prisma.productVariant.create({
          data: {
            code: v.code,
            name: v.name,
            description: v.description,
            standardConsumptionRatio: v.standardConsumptionRatio,
            metersPerCarton: v.metersPerCarton,
            packagingMaterialId: packagingMap[v.packagingName],
            createdBy: adminId,
          },
        });

    // Upsert the single ingredient (100% of one raw material type)
    await prisma.variantIngredient.upsert({
      where: { variantId_rawMaterialTypeId: { variantId: variant.id, rawMaterialTypeId: rawMaterialTypeMap[v.grainCode] } },
      update: { ratioPercent: 100 },
      create: { variantId: variant.id, rawMaterialTypeId: rawMaterialTypeMap[v.grainCode], ratioPercent: 100 },
    });
  }

  // ─── 9. Electricity Rate ───────────────────────────────────────────────
  // 50 Rs/kWhr = 5,000 paisa/unit (standard tariff from formulas).
  // Rice Zipper uses 45 Rs and SL-25 uses 60 Rs in the formulas; those
  // differences reflect different tariff connections and should be updated
  // by the user in Settings → Electricity Rates when needed.
  console.log('⚡ Seeding electricity rate...');
  const existingRate = await prisma.electricityRate.findFirst({
    where: { effectiveTo: null },
    orderBy: { effectiveFrom: 'desc' },
  });
  if (!existingRate) {
    await prisma.electricityRate.create({
      data: {
        ratePaisaPerUnit: BigInt(5000),  // 50 Rs/kWh
        effectiveFrom: new Date('2024-01-01'),
        notes: 'Initial rate — 50 Rs/kWhr (peak and non-peak variable charge per formula)',
        createdBy: adminId,
      },
    });
  }

  // ─── 10. Monthly Overheads ─────────────────────────────────────────────
  // From all formula sheets: Rent 90k + Transport 100k + Operator 150k +
  // Labour 210k + Petty Cash 60k = 610,000 Rs/month.
  // Seed the last 6 months including current month (April 2026).
  console.log('🧾 Seeding monthly overheads...');
  const overheadMonths = [
    { year: 2025, month: 11 },
    { year: 2025, month: 12 },
    { year: 2026, month: 1 },
    { year: 2026, month: 2 },
    { year: 2026, month: 3 },
    { year: 2026, month: 4 },
  ];

  for (const { year, month } of overheadMonths) {
    const existingOverhead = await prisma.monthlyOverhead.findFirst({ where: { year, month, organizationId: null } });
    if (!existingOverhead) {
      // Don't overwrite if user has already customised — only create when absent.
      await prisma.monthlyOverhead.create({
        data: {
          year,
          month,
          laborPaisa: BigInt(36000000),        // 360,000 Rs (operator 150k + labour 210k)
          rentPaisa: BigInt(9000000),           // 90,000 Rs
          transportationPaisa: BigInt(10000000), // 100,000 Rs
          packingPaisa: BigInt(0),
          miscellaneousPaisa: BigInt(6000000),  // 60,000 Rs (petty cash)
          notes: 'Seeded from formula sheets — total 610,000 Rs/month',
        },
      });
    }
  }

  // ─── Platform plane (multi-tenant SaaS billing/backoffice) ────────────────
  // Duplicated list — keep in sync with backend/src/config/modules.ts.
  console.log('🏢 Seeding platform modules, starter plan, bank account, platform admin...');
  const moduleDefs = [
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
  for (const m of moduleDefs) {
    await prisma.module.upsert({ where: { key: m.key }, update: { name: m.name, description: m.description, sortOrder: m.sortOrder }, create: m });
  }
  const allModules = await prisma.module.findMany();

  const starterPlan = await prisma.plan.upsert({
    where: { code: 'standard' },
    update: {},
    create: {
      name: 'Standard',
      code: 'standard',
      pricePaisa: 1500000n, // PKR 15,000 / month
      billingCycleDays: 30,
      trialDays: 3,
      maxSubCompanies: 1,
      sortOrder: 0,
    },
  });
  const existingPlanModules = await prisma.planModule.count({ where: { planId: starterPlan.id } });
  if (existingPlanModules === 0) {
    await prisma.planModule.createMany({
      data: allModules.map((m) => ({ planId: starterPlan.id, moduleId: m.id })),
    });
  }

  const existingBankAccount = await prisma.bankAccount.findFirst();
  if (!existingBankAccount) {
    await prisma.bankAccount.create({
      data: {
        bankName: 'PLACEHOLDER BANK — update in backoffice',
        accountTitle: 'BD Matrix (Pvt) Ltd',
        accountNumber: '0000000000000',
        sortOrder: 0,
      },
    });
  }

  // Platform admin credentials come from env so no real password ships in
  // source control; falls back to a dev-only default (logged loudly) if unset.
  const platformAdminEmail = process.env.PLATFORM_ADMIN_EMAIL || 'admin@bdmatrix.org';
  const existingPlatformAdmin = await prisma.platformAdmin.findUnique({ where: { email: platformAdminEmail } });
  if (!existingPlatformAdmin) {
    const platformAdminPassword = process.env.PLATFORM_ADMIN_PASSWORD || 'change-me-in-production';
    if (!process.env.PLATFORM_ADMIN_PASSWORD) {
      console.warn('   ⚠️  PLATFORM_ADMIN_PASSWORD not set — seeded backoffice admin with a default dev password. Change it immediately.');
    }
    await prisma.platformAdmin.create({
      data: {
        name: 'Platform Owner',
        email: platformAdminEmail,
        passwordHash: hashPassword(platformAdminPassword),
      },
    });
  }

  // ─── Summary ────────────────────────────────────────────────────────────
  console.log('');
  console.log('📊 Seed Summary:');
  console.log(`   Users:               ${usersData.length}`);
  console.log(`   Accounts:            ${5 + leafAccounts.length}`);
  console.log(`   Expense Categories:  ${parentCatNames.length + subCategories.length}`);
  console.log(`   System Settings:     ${settingsData.length}`);
  console.log(`   Raw Material Types:         ${rawMaterialTypeData.length}`);
  console.log(`   Packaging Materials: ${packagingData.length}`);
  console.log(`   Plant:               1 (Main Factory with ${machineData.length} machines)`);
  console.log(`   Product Variants:     ${variantData.length}`);
  console.log(`   Electricity Rate:    50 Rs/kWhr (5,000 paisa/unit)`);
  console.log(`   Monthly Overheads:   ${overheadMonths.length} months`);
  console.log(`   Platform Modules:    ${moduleDefs.length}`);
  console.log(`   Platform Plan:       Standard (PKR 15,000/mo, all modules)`);
  console.log(`   Platform Admin:      ${platformAdminEmail}`);
  console.log('');
  console.log('✅ Seed complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

