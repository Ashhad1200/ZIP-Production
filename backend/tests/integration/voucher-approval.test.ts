/**
 * T101 — Voucher Approval Workflow Integration Tests
 *
 * Tests voucher creation (auto-approve / pending),
 * approval with journal entry, rejection with comment.
 */
import { prisma } from '../setup';
import { financeService } from '../../src/services/finance.service';

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function seedUser(role: 'SUPER_ADMIN' | 'FINANCE_HEAD' = 'SUPER_ADMIN') {
  return prisma.user.create({
    data: { name: `vch-user-${role}-${Date.now()}`, role },
  });
}

async function seedAccounts() {
  const cashBank = await prisma.account.create({
    data: { code: '1000', name: 'Cash / Bank', accountType: 'ASSET' },
  });
  const expense = await prisma.account.create({
    data: { code: '5000', name: 'Operating Expenses', accountType: 'EXPENSE' },
  });
  return { cashBank, expense };
}

async function seedExpenseCategory(userId: string) {
  return prisma.expenseCategory.create({
    data: { name: `Category-${Date.now()}`, createdBy: userId },
  });
}

async function seedCompany(userId: string) {
  return prisma.company.create({
    data: { name: `Company-${Date.now()}`, createdBy: userId },
  });
}

/** Build all prerequisite records. */
async function seedAll() {
  const superAdmin = await seedUser('SUPER_ADMIN');
  const financeHead = await seedUser('FINANCE_HEAD');
  const accounts = await seedAccounts();
  const category = await seedExpenseCategory(superAdmin.id);
  const company = await seedCompany(superAdmin.id);

  return { superAdmin, financeHead, accounts, category, company };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Voucher Approval (T101)', () => {
  it('should auto-approve voucher below PKR 2L (< 20_000_000 paisa) and create journal entry', async () => {
    const { superAdmin, category, company } = await seedAll();

    const result = await financeService.createVoucher(
      {
        title: 'Office Supplies',
        date: '2025-06-01',
        amountPaisa: 19999999n, // just below threshold
        categoryId: category.id,
        paymentMode: 'CASH',
        companyId: company.id,
      },
      superAdmin.id,
    );

    expect(result.approvalStatus).toBe('AUTO_APPROVED');
    expect(result.requiresApproval).toBe(false);

    // Journal entry should have been created
    const voucher = await prisma.voucher.findUnique({
      where: { id: result.id },
      include: { journalEntry: { include: { lines: true } } },
    });

    expect(voucher).not.toBeNull();
    expect(voucher!.journalEntryId).not.toBeNull();
    expect(voucher!.journalEntry).not.toBeNull();
    expect(voucher!.journalEntry!.status).toBe('POSTED');

    // Journal entry should be balanced
    const lines = voucher!.journalEntry!.lines;
    const totalDebit = lines.reduce((s, l) => s + BigInt(l.debitAmountPaisa), 0n);
    const totalCredit = lines.reduce((s, l) => s + BigInt(l.creditAmountPaisa), 0n);
    expect(totalDebit).toBe(totalCredit);
    expect(totalDebit).toBe(19999999n);
  });

  it('should set voucher to PENDING and send notification when >= PKR 2L', async () => {
    const { superAdmin, category, company } = await seedAll();

    const result = await financeService.createVoucher(
      {
        title: 'Heavy Machinery Purchase',
        date: '2025-06-01',
        amountPaisa: 20000000n, // exactly at threshold
        categoryId: category.id,
        paymentMode: 'BANK_TRANSFER',
        companyId: company.id,
      },
      superAdmin.id,
    );

    expect(result.approvalStatus).toBe('PENDING');
    expect(result.requiresApproval).toBe(true);
    expect(result.notificationSent).toBe(true);

    // No journal entry yet
    const voucher = await prisma.voucher.findUnique({ where: { id: result.id } });
    expect(voucher!.journalEntryId).toBeNull();

    // Notification should exist for SUPER_ADMIN role
    const notifications = await prisma.notification.findMany({
      where: {
        referenceId: result.id,
        type: 'VOUCHER_APPROVAL',
      },
    });
    expect(notifications.length).toBeGreaterThanOrEqual(1);
  });

  it('should create journal entry when a PENDING voucher is approved', async () => {
    const { superAdmin, financeHead, category, company } = await seedAll();

    // Create a large voucher (PENDING)
    const created = await financeService.createVoucher(
      {
        title: 'Generator Set',
        date: '2025-06-01',
        amountPaisa: 50000000n, // 5 lakh
        categoryId: category.id,
        paymentMode: 'BANK_TRANSFER',
        companyId: company.id,
      },
      superAdmin.id,
    );

    expect(created.approvalStatus).toBe('PENDING');

    // Approve
    const approved = await financeService.approveOrRejectVoucher(
      created.id,
      'APPROVE',
      undefined,
      financeHead.id,
    );

    expect(approved!.approvalStatus).toBe('APPROVED');
    expect(approved!.approvedBy).toBe(financeHead.id);
    expect(approved!.journalEntryId).not.toBeNull();

    // Verify journal entry is POSTED and balanced
    const je = await prisma.journalEntry.findUnique({
      where: { id: approved!.journalEntryId! },
      include: { lines: true },
    });
    expect(je).not.toBeNull();
    expect(je!.status).toBe('POSTED');

    const totalDebit = je!.lines.reduce((s, l) => s + BigInt(l.debitAmountPaisa), 0n);
    const totalCredit = je!.lines.reduce((s, l) => s + BigInt(l.creditAmountPaisa), 0n);
    expect(totalDebit).toBe(totalCredit);
    expect(totalDebit).toBe(50000000n);
  });

  it('should reject voucher with comment — no journal entry created', async () => {
    const { superAdmin, financeHead, category, company } = await seedAll();

    const created = await financeService.createVoucher(
      {
        title: 'Land Acquisition',
        date: '2025-06-01',
        amountPaisa: 100000000n, // 1 crore
        categoryId: category.id,
        paymentMode: 'BANK_TRANSFER',
        companyId: company.id,
      },
      superAdmin.id,
    );

    expect(created.approvalStatus).toBe('PENDING');

    const rejected = await financeService.approveOrRejectVoucher(
      created.id,
      'REJECT',
      'Budget not allocated for this quarter',
      financeHead.id,
    );

    expect(rejected!.approvalStatus).toBe('REJECTED');
    expect(rejected!.rejectionReason).toBe('Budget not allocated for this quarter');
    expect(rejected!.journalEntryId).toBeNull();
  });

  it('should require comment when rejecting a voucher', async () => {
    const { superAdmin, financeHead, category, company } = await seedAll();

    const created = await financeService.createVoucher(
      {
        title: 'Misc Expense',
        date: '2025-06-01',
        amountPaisa: 30000000n,
        categoryId: category.id,
        paymentMode: 'CASH',
        companyId: company.id,
      },
      superAdmin.id,
    );

    await expect(
      financeService.approveOrRejectVoucher(
        created.id,
        'REJECT',
        undefined,
        financeHead.id,
      ),
    ).rejects.toMatchObject({ code: 'COMMENT_REQUIRED' });
  });

  it('should not allow approving an already approved voucher', async () => {
    const { superAdmin, financeHead, category, company } = await seedAll();

    // Auto-approved voucher (below threshold)
    const created = await financeService.createVoucher(
      {
        title: 'Stationery',
        date: '2025-06-01',
        amountPaisa: 5000n,
        categoryId: category.id,
        paymentMode: 'CASH',
        companyId: company.id,
      },
      superAdmin.id,
    );

    expect(created.approvalStatus).toBe('AUTO_APPROVED');

    // Trying to approve again should fail — status is not PENDING
    await expect(
      financeService.approveOrRejectVoucher(
        created.id,
        'APPROVE',
        undefined,
        financeHead.id,
      ),
    ).rejects.toMatchObject({ code: 'INVALID_STATUS' });
  });
});
