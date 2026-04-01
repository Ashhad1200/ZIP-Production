/**
 * T099 — Production → Raw Material Consumption Integration Tests
 *
 * Tests production entry creation:
 *   raw material deduction, finished goods increase,
 *   duplicate rejection, electricity discrepancy flagging.
 */
import { prisma } from '../setup';
import { productionService } from '../../src/services/production.service';
import { Prisma } from '@prisma/client';

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function seedUser() {
  return prisma.user.create({
    data: { name: `prod-user-${Date.now()}`, role: 'PRODUCTION_HEAD' },
  });
}

async function seedPlant(userId: string) {
  return prisma.plant.create({
    data: { name: `Plant-${Date.now()}`, createdBy: userId },
  });
}

async function seedMachine(
  plantId: string,
  userId: string,
  opts: { kwhRating?: number; expectedOutputPerShift?: number } = {},
) {
  const { kwhRating = 10, expectedOutputPerShift = 500 } = opts;
  return prisma.machine.create({
    data: {
      plantId,
      identifier: `M-${Date.now()}`,
      kwhRating: new Prisma.Decimal(kwhRating),
      expectedOutputPerShift,
      createdBy: userId,
    },
  });
}

async function seedGrainType(userId: string, bagWeightGrams = 25000) {
  return prisma.grainType.create({
    data: {
      code: `GT-${Date.now()}`,
      name: `Grain-${Date.now()}`,
      bagWeightGrams,
      createdBy: userId,
    },
  });
}

async function seedVariant(grainTypeId: string, userId: string) {
  return prisma.zipperVariant.create({
    data: {
      code: `ZV-${Date.now()}`,
      name: `Variant-${Date.now()}`,
      standardGramsPerMeter: new Prisma.Decimal(5.0),
      grainTypeId,
      createdBy: userId,
    },
  });
}

async function seedRawMaterialStock(grainTypeId: string, bags: number, userId: string) {
  return prisma.rawMaterialStock.create({
    data: {
      grainTypeId,
      currentBags: new Prisma.Decimal(bags),
      createdBy: userId,
    },
  });
}

/** Build the full prerequisite graph. */
async function seedAll(opts: { bags?: number; bagWeightGrams?: number } = {}) {
  const { bags = 100, bagWeightGrams = 25000 } = opts;
  const user = await seedUser();
  const plant = await seedPlant(user.id);
  const machine = await seedMachine(plant.id, user.id);
  const grainType = await seedGrainType(user.id, bagWeightGrams);
  const variant = await seedVariant(grainType.id, user.id);
  const rawStock = await seedRawMaterialStock(grainType.id, bags, user.id);

  return { user, plant, machine, grainType, variant, rawStock };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Production Consumption (T099)', () => {
  it('should decrease raw material stock by the formula (gramsPerMeter × meters / bagWeight)', async () => {
    const { user, plant, variant, grainType } = await seedAll({ bags: 100, bagWeightGrams: 25000 });

    const gramsPerMeter = 5;
    const metersProduced = 1000;
    // expected consumption: 5 × 1000 = 5000 grams = 5000/25000 = 0.2 bags

    await productionService.createEntry(
      {
        plantId: plant.id,
        shift: 'DAY',
        date: '2025-06-01',
        variantId: variant.id,
        metersProduced,
        gramsPerMeter,
        electricityUnitsConsumed: 100,
      },
      user.id,
    );

    const stock = await prisma.rawMaterialStock.findUnique({
      where: { grainTypeId: grainType.id },
    });
    expect(stock).not.toBeNull();

    const remainingBags = Number(stock!.currentBags);
    // 100 − 0.2 = 99.8
    expect(remainingBags).toBeCloseTo(99.8, 2);
  });

  it('should increase finished goods stock by metersProduced', async () => {
    const { user, plant, variant } = await seedAll();

    const metersProduced = 750;

    await productionService.createEntry(
      {
        plantId: plant.id,
        shift: 'DAY',
        date: '2025-06-01',
        variantId: variant.id,
        metersProduced,
        gramsPerMeter: 5,
        electricityUnitsConsumed: 100,
      },
      user.id,
    );

    const fgStock = await prisma.finishedGoodsStock.findUnique({
      where: { variantId: variant.id },
    });
    expect(fgStock).not.toBeNull();
    expect(fgStock!.currentMeters).toBe(750);
  });

  it('should reject duplicate entry for same plant + shift + date', async () => {
    const { user, plant, variant } = await seedAll();

    const baseInput = {
      plantId: plant.id,
      shift: 'DAY' as const,
      date: '2025-06-01',
      variantId: variant.id,
      metersProduced: 100,
      gramsPerMeter: 5,
      electricityUnitsConsumed: 50,
    };

    // First entry succeeds
    await productionService.createEntry(baseInput, user.id);

    // Duplicate should fail with DUPLICATE_ENTRY
    await expect(
      productionService.createEntry(baseInput, user.id),
    ).rejects.toMatchObject({ code: 'DUPLICATE_ENTRY' });
  });

  it('should flag electricity discrepancy when actual exceeds expected by >15%', async () => {
    // Machine: kwhRating=10, expectedOutput=500
    // For 500 meters: expectedUnits = 10 × 12 × (500/500) = 120
    // Actual: 200 → deviation = |200-120|/120 × 100 = 66.7% → flagged
    const { user, plant, variant } = await seedAll();

    const result = await productionService.createEntry(
      {
        plantId: plant.id,
        shift: 'DAY',
        date: '2025-06-01',
        variantId: variant.id,
        metersProduced: 500,
        gramsPerMeter: 5,
        electricityUnitsConsumed: 200, // way over expected 120
      },
      user.id,
    );

    expect(result.hasElectricityDiscrepancy).toBe(true);

    // Also verify the persisted entry
    const entry = await prisma.productionEntry.findUnique({
      where: { id: result.id },
    });
    expect(entry!.hasElectricityDiscrepancy).toBe(true);
    expect(entry!.electricityDiscrepancyNotes).toBeTruthy();
  });

  it('should NOT flag electricity discrepancy when within threshold', async () => {
    // Expected: 10 × 12 × (500/500) = 120 units
    // Actual: 125 → deviation ≈ 4.2% < 15%
    const { user, plant, variant } = await seedAll();

    const result = await productionService.createEntry(
      {
        plantId: plant.id,
        shift: 'DAY',
        date: '2025-06-01',
        variantId: variant.id,
        metersProduced: 500,
        gramsPerMeter: 5,
        electricityUnitsConsumed: 125,
      },
      user.id,
    );

    expect(result.hasElectricityDiscrepancy).toBe(false);
  });

  it('should throw INSUFFICIENT_RAW_MATERIAL when stock is too low', async () => {
    // 0.01 bags available, but production needs much more
    const { user, plant, variant } = await seedAll({ bags: 0.01, bagWeightGrams: 25000 });

    await expect(
      productionService.createEntry(
        {
          plantId: plant.id,
          shift: 'DAY',
          date: '2025-06-01',
          variantId: variant.id,
          metersProduced: 10000, // needs 50000g / 25000 = 2 bags
          gramsPerMeter: 5,
          electricityUnitsConsumed: 100,
        },
        user.id,
      ),
    ).rejects.toMatchObject({ code: 'INSUFFICIENT_RAW_MATERIAL' });
  });
});
