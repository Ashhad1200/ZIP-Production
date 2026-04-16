import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter, log: ['error'] });

async function main() {
  console.log('🌱 Starting production seed...');

  // ─── 1. Users ───────────────────────────────────────────────────────────
  console.log('👤 Seeding users...');
  const usersData = [
    { name: 'Owner', role: 'SUPER_ADMIN' as const },
    { name: 'Finance Head', role: 'FINANCE_HEAD' as const },
    { name: 'Production Head', role: 'PRODUCTION_HEAD' as const },
    { name: 'Logistics Head', role: 'LOGISTICS_HEAD' as const },
    { name: 'Marketing Head', role: 'MARKETING_HEAD' as const },
    { name: 'HR Head', role: 'HR_HEAD' as const },
    { name: 'Data Entry Operator', role: 'PRODUCTION_HEAD' as const },
  ];

  for (const u of usersData) {
    await prisma.user.upsert({
      where: { name: u.name },
      update: { role: u.role },
      create: { name: u.name, role: u.role },
    });
  }
  const admin = await prisma.user.findFirst({ where: { name: 'Owner' } });
  const adminId = admin!.id;

  // ─── 2. Chart of Accounts ──────────────────────────────────────────────
  console.log('📒 Seeding chart of accounts...');

  // Top-level group accounts
  const acc1000 = await prisma.account.upsert({
    where: { code: '1000' },
    update: {},
    create: { code: '1000', name: 'Assets', accountType: 'ASSET', isGroup: true },
  });
  const acc2000 = await prisma.account.upsert({
    where: { code: '2000' },
    update: {},
    create: { code: '2000', name: 'Liabilities', accountType: 'LIABILITY', isGroup: true },
  });
  const acc3000 = await prisma.account.upsert({
    where: { code: '3000' },
    update: {},
    create: { code: '3000', name: 'Equity', accountType: 'EQUITY', isGroup: true },
  });
  const acc4000 = await prisma.account.upsert({
    where: { code: '4000' },
    update: {},
    create: { code: '4000', name: 'Revenue', accountType: 'REVENUE', isGroup: true },
  });
  const acc5000 = await prisma.account.upsert({
    where: { code: '5000' },
    update: {},
    create: { code: '5000', name: 'Expenses', accountType: 'EXPENSE', isGroup: true },
  });

  // Sub-accounts
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
    await prisma.account.upsert({
      where: { code: acc.code },
      update: {},
      create: {
        code: acc.code,
        name: acc.name,
        accountType: acc.type,
        parentId: acc.parentId,
        isGroup: acc.isGroup,
      },
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
    { name: 'Grain Type A', parentName: 'Raw Material' },
    { name: 'Grain Type B', parentName: 'Raw Material' },
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
    await prisma.systemSetting.upsert({
      where: { key: s.key },
      update: { value: s.value, description: s.description },
      create: { key: s.key, value: s.value, description: s.description },
    });
  }

  // ─── Summary ────────────────────────────────────────────────────────────
  console.log('');
  console.log('📊 Seed Summary:');
  console.log(`   Users:               ${usersData.length}`);
  console.log(`   Accounts:            ${5 + leafAccounts.length}`);
  console.log(`   Expense Categories:  ${parentCatNames.length + subCategories.length}`);
  console.log(`   System Settings:     ${settingsData.length}`);
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
