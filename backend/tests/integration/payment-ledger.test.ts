/**
 * T100 — Payment → Ledger Flow Integration Tests
 *
 * Tests payment recording, outstanding balance, overdue detection,
 * and rate-change isolation.
 */
import { prisma } from '../setup';
import { financeService } from '../../src/services/finance.service';
import { gatePassService } from '../../src/services/gate-pass.service';
import { Prisma } from '@prisma/client';

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function seedUser(role: 'SUPER_ADMIN' | 'FINANCE_HEAD' = 'SUPER_ADMIN') {
  return prisma.user.create({
    data: { name: `fin-user-${Date.now()}`, role },
  });
}

async function seedAccounts() {
  const ar = await prisma.account.create({
    data: { code: '1200', name: 'Accounts Receivable', accountType: 'ASSET' },
  });
  const revenue = await prisma.account.create({
    data: { code: '4100', name: 'Sales Revenue', accountType: 'REVENUE' },
  });
  const cashBank = await prisma.account.create({
    data: { code: '1000', name: 'Cash / Bank', accountType: 'ASSET' },
  });
  const arGeneral = await prisma.account.create({
    data: { code: '1100', name: 'AR General', accountType: 'ASSET' },
  });
  return { ar, revenue, cashBank, arGeneral };
}

async function seedGrainType(userId: string) {
  return prisma.grainType.create({
    data: {
      code: `GT-${Date.now()}`,
      name: 'Nylon',
      bagWeightGrams: 25000,
      createdBy: userId,
    },
  });
}

async function seedVariant(grainTypeId: string, userId: string) {
  return prisma.zipperVariant.create({
    data: {
      code: `ZV-${Date.now()}`,
      name: 'Zipper #5',
      standardGramsPerMeter: new Prisma.Decimal(5),
      grainTypeId,
      createdBy: userId,
    },
  });
}

async function seedClient(userId: string, paymentCycleDays = 30) {
  return prisma.client.create({
    data: {
      name: `Client-${Date.now()}`,
      paymentCycleDays,
      createdBy: userId,
    },
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

async function seedFinishedGoodsStock(variantId: string, meters: number, userId: string) {
  return prisma.finishedGoodsStock.create({
    data: { variantId, currentMeters: meters, createdBy: userId },
  });
}

/** Build full dependency graph and create a gate pass (auto-debit journal). */
async function seedWithGatePass(opts: {
  ratePaisa?: bigint;
  meters?: number;
  paymentCycleDays?: number;
  gatePassDate?: string;
} = {}) {
  const {
    ratePaisa = 1500n,
    meters = 100,
    paymentCycleDays = 30,
    gatePassDate = '2025-06-01',
  } = opts;

  const user = await seedUser();
  const accounts = await seedAccounts();
  const grainType = await seedGrainType(user.id);
  const variant = await seedVariant(grainType.id, user.id);
  const client = await seedClient(user.id, paymentCycleDays);
  await seedFinishedGoodsStock(variant.id, 10000, user.id);
  await seedClientRate(client.id, variant.id, ratePaisa, user.id);

  // Create gate pass — this auto-creates a POSTED debit journal entry
  const gatePass = await gatePassService.create(
    {
      clientId: client.id,
      date: gatePassDate,
      shift: 'DAY',
      lineItems: [{ variantId: variant.id, meters }],
    },
    user.id,
  );

  return { user, accounts, grainType, variant, client, gatePass };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Payment Ledger (T100)', () => {
  it('should decrease outstanding balance after recording a credit payment', async () => {
    const { user, client } = await seedWithGatePass({
      ratePaisa: 2000n,
      meters: 100,
    });
    // Outstanding after gate pass: 100 × 2000 = 200_000 paisa

    const paymentResult = await financeService.recordPayment(
      client.id,
      {
        amountPaisa: 50000n, // pay 50,000 paisa
        date: '2025-06-15',
        paymentMode: 'BANK_TRANSFER',
      },
      user.id,
    );

    // New outstanding = 200_000 − 50_000 = 150_000 paisa
    expect(paymentResult.newOutstandingPaisa).toBe(150000n);
  });

  it('should detect overdue gate passes after payment cycle date passes', async () => {
    // Gate pass on 2025-01-01 with 7-day cycle → due 2025-01-08
    await seedWithGatePass({
      ratePaisa: 1000n,
      meters: 50,
      paymentCycleDays: 7,
      gatePassDate: '2025-01-01',
    });

    // getOverduePayments checks against "now", which is past due date
    const overdueItems = await financeService.getOverduePayments();

    // The gate pass from Jan 1 with 7-day cycle is long overdue
    expect(overdueItems.length).toBeGreaterThanOrEqual(1);
    expect(overdueItems[0].daysOverdue).toBeGreaterThan(0);
  });

  it('should apply rate change only to future gate passes, not retroactive ones', async () => {
    const { user, client, variant } = await seedWithGatePass({
      ratePaisa: 1000n, // original rate: 1000 paisa/m
      meters: 100,
    });
    // First gate pass total: 100 × 1000 = 100_000 paisa

    const firstGP = await prisma.gatePass.findFirst({
      where: { clientId: client.id },
      include: { lineItems: true },
    });
    expect(firstGP!.lineItems[0].ratePerMeterPaisa).toBe(1000n);

    // Update rate to 2000 paisa/m
    await financeService.updateClientRate(client.id, variant.id, 2000n, user.id);

    // Top up stock for a second gate pass
    await prisma.finishedGoodsStock.update({
      where: { variantId: variant.id },
      data: { currentMeters: 5000 },
    });

    // Create another gate pass — should use NEW rate
    await gatePassService.create(
      {
        clientId: client.id,
        date: '2025-07-01',
        shift: 'NIGHT',
        lineItems: [{ variantId: variant.id, meters: 100 }],
      },
      user.id,
    );

    const gatePasses = await prisma.gatePass.findMany({
      where: { clientId: client.id },
      include: { lineItems: true },
      orderBy: { date: 'asc' },
    });

    expect(gatePasses.length).toBe(2);

    // First GP: old rate unchanged
    expect(gatePasses[0].lineItems[0].ratePerMeterPaisa).toBe(1000n);
    // Second GP: new rate
    expect(gatePasses[1].lineItems[0].ratePerMeterPaisa).toBe(2000n);

    // Total outstanding should reflect both rates
    const ledger = await financeService.getClientLedger(client.id, { page: 1, limit: 100 });
    // 100_000 (old GP) + 200_000 (new GP) = 300_000
    expect(ledger.summary.outstanding).toBe(300000n);
  });

  it('should reject payment with zero amount', async () => {
    const { user, client } = await seedWithGatePass();

    await expect(
      financeService.recordPayment(
        client.id,
        {
          amountPaisa: 0n,
          date: '2025-06-15',
          paymentMode: 'CASH',
        },
        user.id,
      ),
    ).rejects.toMatchObject({ code: 'INVALID_AMOUNT' });
  });

  it('should require cheque number for CHEQUE payment mode', async () => {
    const { user, client } = await seedWithGatePass();

    await expect(
      financeService.recordPayment(
        client.id,
        {
          amountPaisa: 10000n,
          date: '2025-06-15',
          paymentMode: 'CHEQUE',
          // chequeNumber intentionally omitted
        },
        user.id,
      ),
    ).rejects.toMatchObject({ code: 'CHEQUE_NUMBER_REQUIRED' });
  });
});
