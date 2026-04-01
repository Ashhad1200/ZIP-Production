import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter, log: ['error'] });

async function main() {
  console.log('🌱 Starting seed...');

  // ─── Clear existing data (FK-safe order) ────────────────────────────────
  console.log('🗑️  Clearing existing data...');
  await prisma.auditLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.journalEntryLine.deleteMany();
  await prisma.journalEntry.deleteMany();
  await prisma.gatePassLineItem.deleteMany();
  await prisma.gatePass.deleteMany();
  await prisma.order.deleteMany();
  await prisma.clientRate.deleteMany();
  await prisma.client.deleteMany();
  await prisma.voucher.deleteMany();
  await prisma.expenseCategory.deleteMany();
  await prisma.company.deleteMany();
  await prisma.scrapSale.deleteMany();
  await prisma.rawMaterialPurchase.deleteMany();
  await prisma.finishedGoodsStock.deleteMany();
  await prisma.rawMaterialStock.deleteMany();
  await prisma.productionEntryWorker.deleteMany();
  await prisma.productionEntry.deleteMany();
  await prisma.zipperVariant.deleteMany();
  await prisma.grainType.deleteMany();
  await prisma.worker.deleteMany();
  await prisma.machine.deleteMany();
  await prisma.plant.deleteMany();
  await prisma.account.deleteMany();
  await prisma.systemSetting.deleteMany();
  await prisma.user.deleteMany();

  // ─── 1. Users ───────────────────────────────────────────────────────────
  console.log('👤 Seeding users...');
  const usersData = [
    { name: 'Owner', role: 'SUPER_ADMIN' as const },
    { name: 'Finance Head', role: 'FINANCE_HEAD' as const },
    { name: 'Production Head', role: 'PRODUCTION_HEAD' as const },
    { name: 'Logistics Head', role: 'LOGISTICS_HEAD' as const },
    { name: 'Marketing Head', role: 'MARKETING_HEAD' as const },
    { name: 'Data Entry Operator', role: 'PRODUCTION_HEAD' as const },
  ];

  const users: Record<string, { id: string }> = {};
  for (const u of usersData) {
    const user = await prisma.user.upsert({
      where: { name: u.name },
      update: { role: u.role },
      create: { name: u.name, role: u.role },
    });
    users[u.name] = user;
  }
  const adminId = users['Owner'].id;

  // ─── 2. Plants ──────────────────────────────────────────────────────────
  console.log('🏭 Seeding plants...');
  const plant1 = await prisma.plant.upsert({
    where: { name: 'Plant 1' },
    update: {},
    create: {
      name: 'Plant 1',
      location: 'Main Factory, Industrial Area, Lahore',
      createdBy: adminId,
    },
  });
  const plant2 = await prisma.plant.upsert({
    where: { name: 'Plant 2' },
    update: {},
    create: {
      name: 'Plant 2',
      location: 'Extension Unit, SITE Area, Karachi',
      createdBy: adminId,
    },
  });

  // ─── 3. Machines ────────────────────────────────────────────────────────
  console.log('⚙️  Seeding machines...');
  const machinesData = [
    { identifier: 'Machine A', plantId: plant1.id, kwhRating: 12.5, expectedOutputPerShift: 3000 },
    { identifier: 'Machine B', plantId: plant1.id, kwhRating: 15.0, expectedOutputPerShift: 3500 },
    { identifier: 'Machine C', plantId: plant2.id, kwhRating: 10.0, expectedOutputPerShift: 2500 },
    { identifier: 'Machine D', plantId: plant2.id, kwhRating: 11.5, expectedOutputPerShift: 2800 },
  ];

  const machines: Record<string, { id: string }> = {};
  for (const m of machinesData) {
    const machine = await prisma.machine.create({
      data: {
        identifier: m.identifier,
        plantId: m.plantId,
        kwhRating: m.kwhRating,
        expectedOutputPerShift: m.expectedOutputPerShift,
        createdBy: adminId,
      },
    });
    machines[m.identifier] = machine;
  }

  // ─── 4. Workers ─────────────────────────────────────────────────────────
  console.log('👷 Seeding workers...');
  const workersData = [
    { name: 'Ali Hassan', designation: 'Senior Operator', plantId: plant1.id },
    { name: 'Muhammad Usman', designation: 'Operator', plantId: plant1.id },
    { name: 'Bilal Ahmed', designation: 'Operator', plantId: plant1.id },
    { name: 'Tariq Mehmood', designation: 'Helper', plantId: plant1.id },
    { name: 'Saeed Akhtar', designation: 'Helper', plantId: plant1.id },
    { name: 'Faisal Rashid', designation: 'Senior Operator', plantId: plant2.id },
    { name: 'Imran Khan', designation: 'Operator', plantId: plant2.id },
    { name: 'Naveed Aslam', designation: 'Operator', plantId: plant2.id },
    { name: 'Kashif Ali', designation: 'Helper', plantId: plant2.id },
    { name: 'Waqas Hussain', designation: 'Helper', plantId: plant2.id },
  ];

  const workers: { id: string; name: string }[] = [];
  for (const w of workersData) {
    const worker = await prisma.worker.create({
      data: {
        name: w.name,
        designation: w.designation,
        plantId: w.plantId,
        createdBy: adminId,
      },
    });
    workers.push(worker);
  }

  // ─── 5. Grain Types ────────────────────────────────────────────────────
  console.log('🌾 Seeding grain types...');
  const grainTypesData = [
    { code: 'GT-A', name: 'Type A Grain', bagWeightGrams: 25000 },
    { code: 'GT-B', name: 'Type B Grain', bagWeightGrams: 25000 },
    { code: 'GT-C', name: 'Type C Grain', bagWeightGrams: 25000 },
    { code: 'GT-D', name: 'Type D Grain', bagWeightGrams: 20000 },
    { code: 'GT-E', name: 'Type E Grain', bagWeightGrams: 20000 },
    { code: 'GT-F', name: 'Type F Grain', bagWeightGrams: 30000 },
    { code: 'GT-G', name: 'Type G Grain', bagWeightGrams: 30000 },
    { code: 'GT-H', name: 'Type H Premium', bagWeightGrams: 25000 },
    { code: 'GT-I', name: 'Type I Economy', bagWeightGrams: 25000 },
    { code: 'GT-J', name: 'Type J Special', bagWeightGrams: 25000 },
  ];

  const grainTypes: Record<string, { id: string }> = {};
  for (const gt of grainTypesData) {
    const grainType = await prisma.grainType.upsert({
      where: { code: gt.code },
      update: {},
      create: {
        code: gt.code,
        name: gt.name,
        bagWeightGrams: gt.bagWeightGrams,
        lowStockThresholdBags: 50,
        createdBy: adminId,
      },
    });
    grainTypes[gt.code] = grainType;
  }

  // ─── 6. Zipper Variants ────────────────────────────────────────────────
  console.log('🔗 Seeding zipper variants...');
  const variantsData = [
    { code: 'V-101', name: 'Standard Rice Bag Zipper', standardGramsPerMeter: 3.2, grainTypeCode: 'GT-A' },
    { code: 'V-102', name: 'Heavy Duty Rice Bag', standardGramsPerMeter: 4.0, grainTypeCode: 'GT-A' },
    { code: 'V-201', name: 'Standard Wheat Bag', standardGramsPerMeter: 3.0, grainTypeCode: 'GT-B' },
    { code: 'V-202', name: 'Heavy Wheat Bag', standardGramsPerMeter: 3.8, grainTypeCode: 'GT-B' },
    { code: 'V-301', name: 'Sugar Bag Zipper', standardGramsPerMeter: 3.5, grainTypeCode: 'GT-C' },
    { code: 'V-302', name: 'Premium Sugar Bag', standardGramsPerMeter: 4.2, grainTypeCode: 'GT-C' },
    { code: 'V-401', name: 'Flour Bag Standard', standardGramsPerMeter: 2.8, grainTypeCode: 'GT-D' },
    { code: 'V-501', name: 'Export Quality A', standardGramsPerMeter: 5.0, grainTypeCode: 'GT-E' },
    { code: 'V-502', name: 'Export Quality B', standardGramsPerMeter: 4.5, grainTypeCode: 'GT-F' },
    { code: 'V-601', name: 'Economy Standard', standardGramsPerMeter: 2.5, grainTypeCode: 'GT-G' },
  ];

  const variants: Record<string, { id: string }> = {};
  for (const v of variantsData) {
    const variant = await prisma.zipperVariant.upsert({
      where: { code: v.code },
      update: {},
      create: {
        code: v.code,
        name: v.name,
        standardGramsPerMeter: v.standardGramsPerMeter,
        grainTypeId: grainTypes[v.grainTypeCode].id,
        createdBy: adminId,
      },
    });
    variants[v.code] = variant;
  }

  // ─── 7. Raw Material Stock ──────────────────────────────────────────────
  console.log('📦 Seeding raw material stock...');
  const rawMaterialStockData: { grainTypeCode: string; currentBags: number }[] = [
    { grainTypeCode: 'GT-A', currentBags: 450 },
    { grainTypeCode: 'GT-B', currentBags: 380 },
    { grainTypeCode: 'GT-C', currentBags: 320 },
    { grainTypeCode: 'GT-D', currentBags: 275 },
    { grainTypeCode: 'GT-E', currentBags: 200 },
    { grainTypeCode: 'GT-F', currentBags: 410 },
    { grainTypeCode: 'GT-G', currentBags: 350 },
    { grainTypeCode: 'GT-H', currentBags: 500 },
    { grainTypeCode: 'GT-I', currentBags: 225 },
    { grainTypeCode: 'GT-J', currentBags: 300 },
  ];

  for (const rm of rawMaterialStockData) {
    await prisma.rawMaterialStock.upsert({
      where: { grainTypeId: grainTypes[rm.grainTypeCode].id },
      update: { currentBags: rm.currentBags },
      create: {
        grainTypeId: grainTypes[rm.grainTypeCode].id,
        currentBags: rm.currentBags,
        createdBy: adminId,
      },
    });
  }

  // ─── 8. Finished Goods Stock ────────────────────────────────────────────
  console.log('📦 Seeding finished goods stock...');
  const finishedGoodsData: { variantCode: string; currentMeters: number }[] = [
    { variantCode: 'V-101', currentMeters: 45000 },
    { variantCode: 'V-102', currentMeters: 30000 },
    { variantCode: 'V-201', currentMeters: 38000 },
    { variantCode: 'V-202', currentMeters: 22000 },
    { variantCode: 'V-301', currentMeters: 50000 },
    { variantCode: 'V-302', currentMeters: 15000 },
    { variantCode: 'V-401', currentMeters: 28000 },
    { variantCode: 'V-501', currentMeters: 10000 },
    { variantCode: 'V-502', currentMeters: 12000 },
    { variantCode: 'V-601', currentMeters: 35000 },
  ];

  for (const fg of finishedGoodsData) {
    await prisma.finishedGoodsStock.upsert({
      where: { variantId: variants[fg.variantCode].id },
      update: { currentMeters: fg.currentMeters },
      create: {
        variantId: variants[fg.variantCode].id,
        currentMeters: fg.currentMeters,
        lowStockThreshold: 5000,
        createdBy: adminId,
      },
    });
  }

  // ─── 9. Chart of Accounts ──────────────────────────────────────────────
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

  // Asset sub-accounts
  const leafAccounts = [
    { code: '1100', name: 'Cash', type: 'ASSET' as const, parentId: acc1000.id, isGroup: false },
    { code: '1200', name: 'Bank', type: 'ASSET' as const, parentId: acc1000.id, isGroup: false },
    { code: '1300', name: 'Accounts Receivable', type: 'ASSET' as const, parentId: acc1000.id, isGroup: true },
    { code: '1400', name: 'Inventory - Finished Goods', type: 'ASSET' as const, parentId: acc1000.id, isGroup: false },
    { code: '1500', name: 'Inventory - Raw Materials', type: 'ASSET' as const, parentId: acc1000.id, isGroup: false },
    // Liability sub-accounts
    { code: '2100', name: 'Accounts Payable', type: 'LIABILITY' as const, parentId: acc2000.id, isGroup: false },
    // Equity sub-accounts
    { code: '3100', name: "Owner's Equity", type: 'EQUITY' as const, parentId: acc3000.id, isGroup: false },
    // Revenue sub-accounts
    { code: '4100', name: 'Sales Revenue', type: 'REVENUE' as const, parentId: acc4000.id, isGroup: false },
    { code: '4200', name: 'Scrap Sales Revenue', type: 'REVENUE' as const, parentId: acc4000.id, isGroup: false },
    // Expense sub-accounts
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

  // ─── 10. Expense Categories ─────────────────────────────────────────────
  console.log('🏷️  Seeding expense categories...');

  // Parent categories
  const catFactory = await prisma.expenseCategory.create({
    data: { name: 'Factory Expenses', createdBy: adminId },
  });
  const catDirector = await prisma.expenseCategory.create({
    data: { name: 'Director Expenses', createdBy: adminId },
  });
  const catRawMaterial = await prisma.expenseCategory.create({
    data: { name: 'Raw Material', createdBy: adminId },
  });
  const catUtilities = await prisma.expenseCategory.create({
    data: { name: 'Utilities', createdBy: adminId },
  });
  const catTransport = await prisma.expenseCategory.create({
    data: { name: 'Transport', createdBy: adminId },
  });
  const catShareholder = await prisma.expenseCategory.create({
    data: { name: 'Shareholder/Dividend', createdBy: adminId },
  });
  const catCharity = await prisma.expenseCategory.create({
    data: { name: 'Charity', createdBy: adminId },
  });
  const catHeadOffice = await prisma.expenseCategory.create({
    data: { name: 'Head Office', createdBy: adminId },
  });

  // Sub-categories
  const subCategories = [
    { name: 'Electrical Repair', parentId: catFactory.id },
    { name: 'Machine Maintenance', parentId: catFactory.id },
    { name: 'Labor', parentId: catFactory.id },
    { name: 'Travel', parentId: catDirector.id },
    { name: 'Entertainment', parentId: catDirector.id },
    { name: 'Grain Type A', parentId: catRawMaterial.id },
    { name: 'Grain Type B', parentId: catRawMaterial.id },
    { name: 'Electricity', parentId: catUtilities.id },
    { name: 'Water', parentId: catUtilities.id },
    { name: 'Gas', parentId: catUtilities.id },
    { name: 'Local', parentId: catTransport.id },
    { name: 'Inter-city', parentId: catTransport.id },
  ];

  for (const sc of subCategories) {
    await prisma.expenseCategory.create({
      data: {
        name: sc.name,
        parentId: sc.parentId,
        createdBy: adminId,
      },
    });
  }

  // ─── 11. Companies ──────────────────────────────────────────────────────
  console.log('🏢 Seeding companies...');
  const companiesData = [
    { name: 'ZIP Production Pvt Ltd', taxStructure: 'Private Limited - NTN registered' },
    { name: 'ZIP Trading Co', taxStructure: 'Partnership - Sales Tax registered' },
    { name: 'ZIP Export (Pvt) Ltd', taxStructure: 'Private Limited - Export oriented' },
  ];

  for (const c of companiesData) {
    await prisma.company.upsert({
      where: { name: c.name },
      update: {},
      create: {
        name: c.name,
        taxStructure: c.taxStructure,
        createdBy: adminId,
      },
    });
  }

  // ─── 12. Clients ────────────────────────────────────────────────────────
  console.log('🤝 Seeding clients...');
  const clientsData = [
    { name: 'Alkaram', contactPerson: 'Mr. Hameed', phone: '0300-1234567', address: 'Korangi Industrial Area, Karachi', paymentCycleDays: 30 },
    { name: 'Nishat', contactPerson: 'Mr. Tariq', phone: '0321-9876543', address: 'Faisalabad Road, Lahore', paymentCycleDays: 45 },
    { name: 'Gul Ahmed', contactPerson: 'Mr. Asif', phone: '0333-5551234', address: 'SITE Area, Karachi', paymentCycleDays: 30 },
    { name: 'Al-Karam Textile', contactPerson: 'Mr. Zahid', phone: '0345-6667890', address: 'Multan Road, Lahore', paymentCycleDays: 60 },
    { name: 'Sapphire', contactPerson: 'Ms. Ayesha', phone: '0312-4445678', address: 'Gulberg III, Lahore', paymentCycleDays: 45 },
    { name: 'Bonanza Satrangi', contactPerson: 'Mr. Faheem', phone: '0301-7778901', address: 'North Nazimabad, Karachi', paymentCycleDays: 30 },
    { name: 'J.', contactPerson: 'Mr. Junaid', phone: '0322-2223456', address: 'DHA Phase 5, Karachi', paymentCycleDays: 60 },
    { name: 'Khaadi', contactPerson: 'Ms. Sara', phone: '0315-8889012', address: 'Clifton, Karachi', paymentCycleDays: 30 },
  ];

  const clients: Record<string, { id: string }> = {};
  for (const c of clientsData) {
    const client = await prisma.client.upsert({
      where: { name: c.name },
      update: {},
      create: {
        name: c.name,
        contactPerson: c.contactPerson,
        phone: c.phone,
        address: c.address,
        paymentCycleDays: c.paymentCycleDays,
        createdBy: adminId,
      },
    });
    clients[c.name] = client;
  }

  // ─── 13. Client Rates ───────────────────────────────────────────────────
  console.log('💰 Seeding client rates...');
  const effectiveFrom = new Date('2025-01-01');

  const clientRatesData = [
    // Alkaram - 3 variants
    { clientName: 'Alkaram', variantCode: 'V-101', ratePerMeterPaisa: BigInt(850) },
    { clientName: 'Alkaram', variantCode: 'V-201', ratePerMeterPaisa: BigInt(780) },
    { clientName: 'Alkaram', variantCode: 'V-301', ratePerMeterPaisa: BigInt(920) },
    // Nishat - 2 variants
    { clientName: 'Nishat', variantCode: 'V-101', ratePerMeterPaisa: BigInt(840) },
    { clientName: 'Nishat', variantCode: 'V-102', ratePerMeterPaisa: BigInt(1050) },
    // Gul Ahmed - 3 variants
    { clientName: 'Gul Ahmed', variantCode: 'V-201', ratePerMeterPaisa: BigInt(800) },
    { clientName: 'Gul Ahmed', variantCode: 'V-202', ratePerMeterPaisa: BigInt(990) },
    { clientName: 'Gul Ahmed', variantCode: 'V-301', ratePerMeterPaisa: BigInt(910) },
    // Al-Karam Textile - 2 variants
    { clientName: 'Al-Karam Textile', variantCode: 'V-302', ratePerMeterPaisa: BigInt(1100) },
    { clientName: 'Al-Karam Textile', variantCode: 'V-401', ratePerMeterPaisa: BigInt(720) },
    // Sapphire - 2 variants
    { clientName: 'Sapphire', variantCode: 'V-501', ratePerMeterPaisa: BigInt(1350) },
    { clientName: 'Sapphire', variantCode: 'V-502', ratePerMeterPaisa: BigInt(1200) },
    // Bonanza Satrangi - 2 variants
    { clientName: 'Bonanza Satrangi', variantCode: 'V-101', ratePerMeterPaisa: BigInt(860) },
    { clientName: 'Bonanza Satrangi', variantCode: 'V-601', ratePerMeterPaisa: BigInt(650) },
    // J. - 2 variants
    { clientName: 'J.', variantCode: 'V-501', ratePerMeterPaisa: BigInt(1380) },
    { clientName: 'J.', variantCode: 'V-301', ratePerMeterPaisa: BigInt(930) },
    // Khaadi - 3 variants
    { clientName: 'Khaadi', variantCode: 'V-102', ratePerMeterPaisa: BigInt(1060) },
    { clientName: 'Khaadi', variantCode: 'V-202', ratePerMeterPaisa: BigInt(1000) },
    { clientName: 'Khaadi', variantCode: 'V-601', ratePerMeterPaisa: BigInt(660) },
  ];

  for (const cr of clientRatesData) {
    await prisma.clientRate.create({
      data: {
        clientId: clients[cr.clientName].id,
        variantId: variants[cr.variantCode].id,
        ratePerMeterPaisa: cr.ratePerMeterPaisa,
        effectiveFrom,
        createdBy: adminId,
      },
    });
  }

  // ─── 14. System Settings ────────────────────────────────────────────────
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

  // ─── 15. Notifications (empty initially) ────────────────────────────────
  console.log('🔔 Notifications: none (empty initially)');

  // ─── Summary ────────────────────────────────────────────────────────────
  console.log('');
  console.log('📊 Seed Summary:');
  console.log(`   Users:               ${usersData.length}`);
  console.log(`   Plants:              2`);
  console.log(`   Machines:            ${machinesData.length}`);
  console.log(`   Workers:             ${workersData.length}`);
  console.log(`   Grain Types:         ${grainTypesData.length}`);
  console.log(`   Zipper Variants:     ${variantsData.length}`);
  console.log(`   Raw Material Stock:  ${rawMaterialStockData.length}`);
  console.log(`   Finished Goods Stock:${finishedGoodsData.length}`);
  console.log(`   Accounts:            ${5 + leafAccounts.length}`);
  console.log(`   Expense Categories:  ${8 + subCategories.length}`);
  console.log(`   Companies:           ${companiesData.length}`);
  console.log(`   Clients:             ${clientsData.length}`);
  console.log(`   Client Rates:        ${clientRatesData.length}`);
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
