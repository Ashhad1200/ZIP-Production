/**
 * One-time migration: assign every existing organizationId = null row (the
 * original single-tenant zipper deployment, predating Phase 2 multi-tenancy)
 * to a real Organization, so it behaves as "tenant #1" going forward instead
 * of "unrestricted / legacy" under the tenant-scoping Prisma extension.
 *
 * Safe to run multiple times (idempotent — finds-or-creates the org, and
 * every update is scoped to `organizationId: null` rows only, so re-running
 * after a successful backfill is a no-op).
 *
 * NOT run automatically by seed.ts or the Dockerfile CMD — this touches an
 * existing deployment's real data and should be run deliberately, once,
 * when that tenant is ready to be onboarded onto the SaaS platform. Rehearse
 * against a copy of the database first.
 *
 * Run with: npx ts-node backfill-default-organization.ts
 */
import * as dotenv from 'dotenv';
dotenv.config();

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const DEFAULT_ORG_SLUG = 'zip-production';
const DEFAULT_ORG_NAME = 'ZIP Production';
const DEFAULT_ORG_EMAIL = 'owner@zip-production.local';

// Same list as backend/src/config/tenant-scoped-models.ts, but as the
// lowercase Prisma Client accessor names rather than PascalCase model names.
const TENANT_SCOPED_ACCESSORS = [
  'user', 'company', 'plant', 'machine', 'worker', 'zipperVariant', 'recipe',
  'grainType', 'scrapSale', 'rawMaterialPurchase', 'vendor', 'rawMaterialBatch',
  'electricityRate', 'rawMaterialStock', 'finishedGoodsStock', 'client',
  'clientRate', 'gatePass', 'salesReturn', 'order', 'account', 'journalEntry',
  'voucher', 'expenseCategory', 'notification', 'auditLog', 'systemSetting',
  'payrollRecord', 'monthlyOverhead', 'packagingMaterial', 'packagingStockAdjustment',
] as const;

async function main() {
  console.log('=== Backfill: default Organization for legacy (organizationId = null) data ===\n');

  console.log('1. Finding or creating the default Organization + Standard subscription...');
  let org = await prisma.organization.findUnique({ where: { slug: DEFAULT_ORG_SLUG } });
  if (!org) {
    const plan = await prisma.plan.findUnique({ where: { code: 'standard' } });
    if (!plan) {
      throw new Error("Plan 'standard' not found — run the seed script first (npx prisma db seed).");
    }
    org = await prisma.organization.create({
      data: {
        name: DEFAULT_ORG_NAME,
        slug: DEFAULT_ORG_SLUG,
        contactName: 'Owner',
        contactEmail: DEFAULT_ORG_EMAIL,
        industry: 'Plastic Zipper Manufacturing',
        status: 'ACTIVE',
        trialEndsAt: new Date(),
      },
    });
    await prisma.subscription.create({
      data: {
        organizationId: org.id,
        planId: plan.id,
        status: 'ACTIVE',
        trialEndsAt: new Date(),
        currentPeriodStart: new Date(),
        // Far-future period end — this is the pre-SaaS tenant being
        // grandfathered in, not a real billing cycle.
        currentPeriodEnd: new Date('2099-12-31'),
        nextDueDate: new Date('2099-12-31'),
      },
    });
    console.log(`   Created organization "${DEFAULT_ORG_NAME}" (${org.id})`);
  } else {
    console.log(`   Organization already exists (${org.id})`);
  }

  console.log('\n2. Backfilling organizationId on every tenant-scoped table...');
  for (const accessor of TENANT_SCOPED_ACCESSORS) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const model = (prisma as any)[accessor];
    const result = await model.updateMany({
      where: { organizationId: null },
      data: { organizationId: org.id },
    });
    if (result.count > 0) {
      console.log(`   ${accessor}: ${result.count} row(s) updated`);
    }
  }

  console.log('\n✅ Backfill complete. All previously-legacy rows now belong to organization ' + org.id);
}

main()
  .catch((e) => {
    console.error('❌ Backfill failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
