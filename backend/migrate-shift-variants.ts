/**
 * Migration: Add production_shift_variants table and migrate existing data.
 * Run with: npx ts-node migrate-shift-variants.ts
 */
import * as dotenv from 'dotenv';
dotenv.config();

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('=== Migration: production_shift_variants ===\n');

  // 1. Create production_shift_variants table
  console.log('1. Creating production_shift_variants table...');
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS production_shift_variants (
      id                TEXT NOT NULL PRIMARY KEY,
      "entryId"         TEXT NOT NULL REFERENCES production_entries(id),
      "variantId"       TEXT NOT NULL REFERENCES zipper_variants(id),
      "metersProduced"  INTEGER NOT NULL DEFAULT 0,
      "gramsPerMeter"   DECIMAL(65,30),
      "scrapWeightGrams" INTEGER NOT NULL DEFAULT 0,
      CONSTRAINT uq_shift_variant UNIQUE ("entryId", "variantId")
    )
  `);
  console.log('   ✅ Table created (or already exists).');

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS idx_psv_entry ON production_shift_variants ("entryId");
    CREATE INDEX IF NOT EXISTS idx_psv_variant ON production_shift_variants ("variantId");
  `);
  console.log('   ✅ Indexes created.');

  // 2. Migrate existing production entries to shift variants
  console.log('\n2. Migrating existing production entries...');
  const entries = await prisma.$queryRawUnsafe<{
    id: string;
    variantId: string | null;
    metersProduced: number | null;
    gramsPerMeter: string | null;
    scrapWeightGrams: number | null;
  }[]>(`
    SELECT id, "variantId", "metersProduced", "gramsPerMeter"::TEXT, "scrapWeightGrams"
    FROM production_entries
    WHERE "variantId" IS NOT NULL
  `);

  console.log(`   Found ${entries.length} existing entries with variantId.`);
  let migrated = 0;
  for (const entry of entries) {
    if (!entry.variantId) continue;
    await prisma.$executeRawUnsafe(`
      INSERT INTO production_shift_variants (id, "entryId", "variantId", "metersProduced", "gramsPerMeter", "scrapWeightGrams")
      VALUES (gen_random_uuid()::TEXT, $1, $2, $3, $4, $5)
      ON CONFLICT ("entryId", "variantId") DO NOTHING
    `,
      entry.id,
      entry.variantId,
      entry.metersProduced ?? 0,
      entry.gramsPerMeter ? parseFloat(entry.gramsPerMeter) : null,
      entry.scrapWeightGrams ?? 0
    );
    migrated++;
  }
  console.log(`   ✅ Migrated ${migrated} entries → shift variants.`);

  // 3. Make variantId nullable (ALTER TABLE)
  console.log('\n3. Making production_entries.variantId nullable...');
  await prisma.$executeRawUnsafe(`
    ALTER TABLE production_entries ALTER COLUMN "variantId" DROP NOT NULL
  `);
  console.log('   ✅ variantId is now nullable.');

  console.log('\n=== Migration complete ===');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
