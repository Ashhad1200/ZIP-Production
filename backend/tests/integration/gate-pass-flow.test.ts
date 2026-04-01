/**
 * T098 — Gate Pass Atomic Flow Integration Tests
 *
 * Tests the full gate pass creation pipeline:
 *   stock deduction, journal entry, payment due date,
 *   order fulfillment, insufficient stock, concurrency.
 */
import { prisma } from '../setup';
import { gatePassService } from '../../src/services/gate-pass.service';
import { Prisma } from '@prisma/client';

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function seedUser(role: 'SUPER_ADMIN' | 'FINANCE_HEAD' = 'SUPER_ADMIN') {
  return prisma.user.create({
    data: { name: `test-user-${Date.now()}`, role },
  });
}

async function seedAccounts() {
  // Accounts Receivable (1200) and Sales Revenue (4100) required by gate pass service
  const ar = await prisma.account.create({
    data: { code: '1200', name: 'Accounts Receivable', accountType: 'ASSET' },
  });
  const revenue = await prisma.account.create({
    data: { code: '4100', name: 'Sales Revenue', accountType: 'REVENUE' },
  });
  return { ar, revenue };
}

async function seedGrainType(userId: string) {
  return prisma.grainType.create({
    data: {
      code: `GT-${Date.now()}`,
      name: 'Nylon-6',
      bagWeightGrams: 25000,
      createdBy: userId,
    },
  });
}

async function seedVariant(grainTypeId: string, userId: string) {
  return prisma.zipperVariant.create({
    data: {
      code: `ZV-${Date.now()}`,
      name: 'Standard Zipper #3',
      standardGramsPerMeter: new Prisma.Decimal(5.5),
      grainTypeId,
      createdBy: userId,
    },
  });
}

async function seedClient(userId: string, paymentCycleDays = 30) {
  return prisma.client.create({
    data: {
      name: `Test Client ${Date.now()}`,
      paymentCycleDays,
      createdBy: userId,
    },
  });
}

async function seedFinishedGoodsStock(
  variantId: string,
  currentMeters: number,
  userId: string,
) {
  return prisma.finishedGoodsStock.create({
    data: { variantId, currentMeters, createdBy: userId },
  });
}

async function seedClientRate(
  clientId: string,
  variantId: string,
  ratePerMeterPaisa: bigint,
  userId: string,
) {
  return prisma.clientRate.create({
    data: {
      clientId,
      variantId,
      ratePerMeterPaisa,
      effectiveFrom: new Date('2024-01-01'),
      createdBy: userId,
    },
  });
}

async function seedPlant(userId: string) {
  return prisma.plant.create({
    data: { name: `Plant-${Date.now()}`, createdBy: userId },
  });
}

/** Build the full prerequisite graph and return all IDs. */
async function seedAll(opts: { stockMeters?: number; ratePaisa?: bigint; paymentCycleDays?: number } = {}) {
  const { stockMeters = 1000, ratePaisa = 1500n, paymentCycleDays = 30 } = opts;

  const user = await seedUser();
  const accounts = await seedAccounts();
  const grainType = await seedGrainType(user.id);
  const variant = await seedVariant(grainType.id, user.id);
  const client = await seedClient(user.id, paymentCycleDays);
  const stock = await seedFinishedGoodsStock(variant.id, stockMeters, user.id);
  const rate = await seedClientRate(client.id, variant.id, ratePaisa, user.id);

  return { user, accounts, grainType, variant, client, stock, rate };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Gate Pass Flow (T098)', () => {
  it('should deduct finished goods stock per variant line item', async () => {
    const { user, variant, client } = await seedAll({ stockMeters: 500 });

    await gatePassService.create(
      {
        clientId: client.id,
        date: '2025-06-01',
        shift: 'DAY',
        lineItems: [{ variantId: variant.id, meters: 200 }],
      },
      user.id,
    );

    const updatedStock = await prisma.finishedGoodsStock.findUnique({
      where: { variantId: variant.id },
    });
    expect(updatedStock).not.toBeNull();
    expect(updatedStock!.currentMeters).toBe(300); // 500 − 200
  });

  it('should create a balanced journal entry (Debit AR = Credit Revenue)', async () => {
    const { user, variant, client, rate } = await seedAll({ ratePaisa: 2000n });

    const result = await gatePassService.create(
      {
        clientId: client.id,
        date: '2025-06-01',
        shift: 'DAY',
        lineItems: [{ variantId: variant.id, meters: 100 }],
      },
      user.id,
    );

    // result has journalEntry via the serialized gate pass — look up directly
    const gatePass = await prisma.gatePass.findFirst({
      where: { clientId: client.id },
      include: { journalEntry: { include: { lines: true } } },
    });

    expect(gatePass).not.toBeNull();
    expect(gatePass!.journalEntry).not.toBeNull();

    const lines = gatePass!.journalEntry!.lines;
    expect(lines.length).toBe(2);

    const totalDebit = lines.reduce((s, l) => s + BigInt(l.debitAmountPaisa), 0n);
    const totalCredit = lines.reduce((s, l) => s + BigInt(l.creditAmountPaisa), 0n);

    expect(totalDebit).toBe(totalCredit);

    // Expected total: 100 meters × 2000 paisa = 200_000 paisa
    const expectedAmount = 2000n * 100n;
    expect(totalDebit).toBe(expectedAmount);
    expect(gatePass!.journalEntry!.status).toBe('POSTED');
  });

  it('should calculate paymentDueDate = gate pass date + client.paymentCycleDays', async () => {
    const { user, variant, client } = await seedAll({ paymentCycleDays: 45 });

    await gatePassService.create(
      {
        clientId: client.id,
        date: '2025-03-10',
        shift: 'NIGHT',
        lineItems: [{ variantId: variant.id, meters: 50 }],
      },
      user.id,
    );

    const gatePass = await prisma.gatePass.findFirst({
      where: { clientId: client.id },
    });

    expect(gatePass).not.toBeNull();
    // 2025-03-10 + 45 days = 2025-04-24
    const expected = new Date('2025-04-24T00:00:00.000Z');
    expect(gatePass!.paymentDueDate.toISOString().slice(0, 10)).toBe(
      expected.toISOString().slice(0, 10),
    );
  });

  it('should update order metersDelivered and auto-complete when fully delivered', async () => {
    const { user, variant, client } = await seedAll();

    // Create an order for 200 meters
    const order = await prisma.order.create({
      data: {
        orderNumber: `ORD-${Date.now()}`,
        clientId: client.id,
        variantId: variant.id,
        metersOrdered: 200,
        ratePerMeterPaisa: 1500n,
        totalAmountPaisa: 300000n,
        deliveryDeadline: new Date('2025-12-31'),
        createdBy: user.id,
      },
    });

    // Gate pass delivers all 200 meters
    await gatePassService.create(
      {
        clientId: client.id,
        date: '2025-06-01',
        shift: 'DAY',
        orderId: order.id,
        lineItems: [{ variantId: variant.id, meters: 200 }],
      },
      user.id,
    );

    const updatedOrder = await prisma.order.findUnique({ where: { id: order.id } });
    expect(updatedOrder!.metersDelivered).toBe(200);
    expect(updatedOrder!.status).toBe('COMPLETED');
  });

  it('should throw INSUFFICIENT_STOCK when requested meters exceed available stock', async () => {
    const { user, variant, client } = await seedAll({ stockMeters: 50 });

    await expect(
      gatePassService.create(
        {
          clientId: client.id,
          date: '2025-06-01',
          shift: 'DAY',
          lineItems: [{ variantId: variant.id, meters: 100 }],
        },
        user.id,
      ),
    ).rejects.toMatchObject({ code: 'INSUFFICIENT_STOCK' });
  });

  it('should handle concurrent stock deductions without over-deducting', async () => {
    const { user, variant, client, rate } = await seedAll({ stockMeters: 300 });

    // Two gate passes each requesting 200m — only one should succeed (300 < 200+200)
    const p1 = gatePassService.create(
      {
        clientId: client.id,
        date: '2025-06-01',
        shift: 'DAY',
        lineItems: [{ variantId: variant.id, meters: 200 }],
      },
      user.id,
    );
    const p2 = gatePassService.create(
      {
        clientId: client.id,
        date: '2025-06-02',
        shift: 'NIGHT',
        lineItems: [{ variantId: variant.id, meters: 200 }],
      },
      user.id,
    );

    const results = await Promise.allSettled([p1, p2]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    // At least one must succeed; the other may fail with INSUFFICIENT_STOCK or succeed
    // if both succeed the stock should be ≥ 0 (Prisma transactions serialize)
    expect(fulfilled.length).toBeGreaterThanOrEqual(1);

    const finalStock = await prisma.finishedGoodsStock.findUnique({
      where: { variantId: variant.id },
    });
    expect(finalStock!.currentMeters).toBeGreaterThanOrEqual(0);

    if (fulfilled.length === 1) {
      expect(finalStock!.currentMeters).toBe(100); // 300 − 200
      expect(rejected.length).toBe(1);
    }
  });
});
