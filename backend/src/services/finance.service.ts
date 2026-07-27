import prisma from '../config/database';
import { AuditAction, ApprovalStatus, NotificationType, PaymentMode, Prisma, Role } from '@prisma/client';
import { formatPaisaToRupees } from '../utils/currency';
import { toISODate, addDays, daysBetween, startOfDay, endOfDay } from '../utils/date';
import { generateSequenceNumber } from '../utils/sequence';
import { accountingService } from './accounting.service';
import { auditService } from './audit.service';
import { notificationService } from './notification.service';

// ─── Auto-approval threshold: PKR 2,00,000 = 20,000,000 paisa ──────────────
const AUTO_APPROVAL_THRESHOLD_PAISA = 20000000n;

export class FinanceService {
  // ═══════════════════════════════════════════════════════════════════════════
  //  CLIENT LEDGER
  // ═══════════════════════════════════════════════════════════════════════════

  async listClientsWithBalances(params: {
    page: number;
    limit: number;
    search?: string;
    hasOverdue?: boolean;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }) {
    const { page, limit, search, hasOverdue, sortBy = 'name', sortOrder = 'asc' } = params;
    const now = new Date();

    // Get non-deleted clients, optionally filtered by name
    const where: Prisma.ClientWhereInput = {
      isDeleted: false,
      ...(search ? { name: { contains: search, mode: 'insensitive' as Prisma.QueryMode } } : {}),
    };

    const allClients = await prisma.client.findMany({
      where,
      select: {
        id: true,
        name: true,
        contactPerson: true,
        phone: true,
        paymentCycleDays: true,
        openingBalancePaisa: true,
      },
    });

    // Aggregate balances and overdue info per client
    const enriched = await Promise.all(
      allClients.map(async (client) => {
        const openingBalance = BigInt(client.openingBalancePaisa ?? 0n);

        // Sum debits / credits from journal entry lines
        const agg = await prisma.journalEntryLine.aggregate({
          where: {
            clientId: client.id,
            entry: { isDeleted: false, status: 'POSTED' },
          },
          _sum: { debitAmountPaisa: true, creditAmountPaisa: true },
        });

        const journalDebits = BigInt(agg._sum.debitAmountPaisa ?? 0n);
        const totalDebits = journalDebits + openingBalance;
        const totalCredits = BigInt(agg._sum.creditAmountPaisa ?? 0n);
        const outstanding = totalDebits - totalCredits;

        // Overdue gate passes
        const overdueGPs = await prisma.gatePass.findMany({
          where: {
            clientId: client.id,
            isDeleted: false,
            paymentDueDate: { lt: now },
            status: { not: 'RECEIVED' },
          },
          select: { totalAmountPaisa: true, paymentDueDate: true },
        });

        const overdueAmountPaisa = overdueGPs.reduce(
          (sum, gp) => sum + BigInt(gp.totalAmountPaisa),
          0n,
        );
        const daysOverdue = overdueGPs.length > 0
          ? Math.max(...overdueGPs.map((gp) => daysBetween(gp.paymentDueDate, now)))
          : 0;

        return {
          id: client.id,
          name: client.name,
          contactPerson: client.contactPerson,
          phone: client.phone,
          paymentCycleDays: client.paymentCycleDays,
          totalDebits,
          totalDebitsDisplay: formatPaisaToRupees(totalDebits),
          totalCredits,
          totalCreditsDisplay: formatPaisaToRupees(totalCredits),
          outstanding,
          outstandingDisplay: formatPaisaToRupees(outstanding),
          overdueAmountPaisa,
          overdueAmountDisplay: formatPaisaToRupees(overdueAmountPaisa),
          daysOverdue,
        };
      }),
    );

    // Filter by overdue
    let filtered = hasOverdue ? enriched.filter((c) => c.daysOverdue > 0) : enriched;

    // Sort
    filtered.sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'outstanding') {
        cmp = Number(a.outstanding - b.outstanding);
      } else if (sortBy === 'daysOverdue') {
        cmp = a.daysOverdue - b.daysOverdue;
      } else {
        cmp = a.name.localeCompare(b.name);
      }
      return sortOrder === 'desc' ? -cmp : cmp;
    });

    // Paginate
    const total = filtered.length;
    const totalPages = Math.ceil(total / limit);
    const start = (page - 1) * limit;
    const data = filtered.slice(start, start + limit);

    return { data, meta: { page, limit, total, totalPages } };
  }

  // ─────────────────────────────────────────────────────────────────────────

  async getClientLedger(
    clientId: string,
    params: { page: number; limit: number; dateFrom?: string; dateTo?: string; type?: string },
  ) {
    const { page, limit, dateFrom, dateTo, type } = params;

    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true, name: true, paymentCycleDays: true, isDeleted: true, openingBalancePaisa: true },
    });
    if (!client || client.isDeleted) {
      throw Object.assign(new Error('Client not found'), { statusCode: 404, code: 'CLIENT_NOT_FOUND' });
    }

    const openingBalancePaisa = BigInt(client.openingBalancePaisa ?? 0n);

    // Summary — include opening balance as an implicit debit
    const agg = await prisma.journalEntryLine.aggregate({
      where: {
        clientId,
        entry: { isDeleted: false, status: 'POSTED' },
      },
      _sum: { debitAmountPaisa: true, creditAmountPaisa: true },
    });
    const journalDebits = BigInt(agg._sum.debitAmountPaisa ?? 0n);
    const totalDebits = journalDebits + openingBalancePaisa;
    const totalCredits = BigInt(agg._sum.creditAmountPaisa ?? 0n);
    const outstanding = totalDebits - totalCredits;

    // Build where clause for lines
    const lineWhere: Prisma.JournalEntryLineWhereInput = {
      clientId,
      entry: {
        isDeleted: false,
        status: 'POSTED',
        ...(dateFrom || dateTo
          ? {
              entryDate: {
                ...(dateFrom ? { gte: startOfDay(dateFrom) } : {}),
                ...(dateTo ? { lte: endOfDay(dateTo) } : {}),
              },
            }
          : {}),
      },
    };

    // Fetch ALL lines ordered oldest→newest for running balance
    const allLines = await prisma.journalEntryLine.findMany({
      where: lineWhere,
      include: {
        entry: {
          select: {
            id: true,
            entryNumber: true,
            entryDate: true,
            description: true,
            referenceType: true,
            referenceId: true,
          },
        },
      },
      orderBy: { entry: { entryDate: 'asc' } },
    });

    // Filter by type if requested
    let filtered = allLines;
    if (type === 'DEBIT') {
      filtered = allLines.filter((l) => BigInt(l.debitAmountPaisa) > 0n);
    } else if (type === 'CREDIT') {
      filtered = allLines.filter((l) => BigInt(l.creditAmountPaisa) > 0n);
    }

    // Build ledger entries with running balance — start from opening balance
    let runningBalance = openingBalancePaisa;
    const journalLedgerEntries = await Promise.all(
      filtered.map(async (line) => {
        const isDebit = BigInt(line.debitAmountPaisa) > 0n;
        const amountPaisa = isDebit ? BigInt(line.debitAmountPaisa) : BigInt(line.creditAmountPaisa);
        runningBalance = isDebit ? runningBalance + amountPaisa : runningBalance - amountPaisa;

        // Look up gate pass number if referenceType is gate_pass
        let gatePassNumber: string | null = null;
        if (line.entry.referenceType === 'gate_pass' && line.entry.referenceId) {
          const gp = await prisma.gatePass.findUnique({
            where: { id: line.entry.referenceId },
            select: { gatePassNumber: true },
          });
          gatePassNumber = gp?.gatePassNumber ?? null;
        }

        const entryDate = line.entry.entryDate;
        const paymentDueDate = isDebit ? addDays(entryDate, client.paymentCycleDays) : null;
        const now = new Date();
        const isOverdue = paymentDueDate ? paymentDueDate < now : false;
        const daysOverdueVal = isOverdue && paymentDueDate ? daysBetween(paymentDueDate, now) : 0;

        return {
          id: line.id,
          date: toISODate(entryDate),
          type: isDebit ? 'DEBIT' : 'CREDIT',
          description: line.entry.description ?? line.description,
          referenceType: line.entry.referenceType,
          referenceId: line.entry.referenceId,
          gatePassNumber,
          amountPaisa,
          amountDisplay: formatPaisaToRupees(amountPaisa),
          paymentDueDate: paymentDueDate ? toISODate(paymentDueDate) : null,
          isOverdue,
          daysOverdue: daysOverdueVal,
          runningBalancePaisa: runningBalance,
          runningBalanceDisplay: formatPaisaToRupees(runningBalance),
        };
      }),
    );

    // Prepend opening balance row if non-zero
    const openingEntry = openingBalancePaisa > 0n
      ? [{
          id: 'opening-balance',
          date: 'Opening Balance',
          type: 'DEBIT' as const,
          description: 'Opening Balance (Day 0)',
          referenceType: 'opening_balance',
          referenceId: null,
          gatePassNumber: null,
          amountPaisa: openingBalancePaisa,
          amountDisplay: formatPaisaToRupees(openingBalancePaisa),
          paymentDueDate: null,
          isOverdue: false,
          daysOverdue: 0,
          runningBalancePaisa: openingBalancePaisa,
          runningBalanceDisplay: formatPaisaToRupees(openingBalancePaisa),
        }]
      : [];

    const ledgerEntries = [...openingEntry, ...journalLedgerEntries];

    // Paginate
    const total = ledgerEntries.length;
    const totalPages = Math.ceil(total / limit);
    const startIdx = (page - 1) * limit;
    const entries = ledgerEntries.slice(startIdx, startIdx + limit);

    return {
      client: { id: client.id, name: client.name, paymentCycleDays: client.paymentCycleDays, openingBalancePaisa },
      summary: {
        openingBalancePaisa,
        openingBalanceDisplay: formatPaisaToRupees(openingBalancePaisa),
        totalDebits,
        totalDebitsDisplay: formatPaisaToRupees(totalDebits),
        totalCredits,
        totalCreditsDisplay: formatPaisaToRupees(totalCredits),
        outstanding,
        outstandingDisplay: formatPaisaToRupees(outstanding),
      },
      entries,
      meta: { page, limit, total, totalPages },
    };
  }

  // ─────────────────────────────────────────────────────────────────────────

  async recordPayment(
    clientId: string,
    input: {
      amountPaisa: bigint;
      date: string;
      paymentMode: PaymentMode;
      chequeNumber?: string;
      notes?: string;
    },
    userId: string,
  ) {
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true, name: true, accountId: true, isDeleted: true },
    });
    if (!client || client.isDeleted) {
      throw Object.assign(new Error('Client not found'), { statusCode: 404, code: 'CLIENT_NOT_FOUND' });
    }

    const amount = BigInt(input.amountPaisa);
    if (amount <= 0n) {
      throw Object.assign(new Error('Amount must be greater than 0'), {
        statusCode: 422,
        code: 'INVALID_AMOUNT',
      });
    }

    if (input.paymentMode === 'CHEQUE' && !input.chequeNumber) {
      throw Object.assign(new Error('Cheque number is required for cheque payments'), {
        statusCode: 422,
        code: 'CHEQUE_NUMBER_REQUIRED',
      });
    }

    // Look up accounts
    const cashBankAccount = await accountingService.getAccountByCode('1000');

    // Client sub-ledger account (AR)
    let arAccountId: string;
    if (client.accountId) {
      arAccountId = client.accountId;
    } else {
      // Fallback: use a general AR account
      const arAccount = await accountingService.getAccountByCode('1100');
      arAccountId = arAccount.id;
    }

    const chequeNote = input.chequeNumber ? ` — Cheque #${input.chequeNumber}` : '';
    const description = `Payment received from ${client.name}${chequeNote}`;

    const entryNumber = await generateSequenceNumber('JE', 'journalEntry');

    const journalEntry = await accountingService.createJournalEntry({
      entryNumber,
      entryDate: new Date(input.date),
      description,
      referenceType: 'payment',
      referenceId: clientId,
      lines: [
        {
          accountId: cashBankAccount.id,
          debitAmountPaisa: amount,
          creditAmountPaisa: 0n,
          description: `Cash/Bank receipt — ${client.name}`,
        },
        {
          accountId: arAccountId,
          clientId,
          debitAmountPaisa: 0n,
          creditAmountPaisa: amount,
          description: `AR settlement — ${client.name}`,
        },
      ],
      userId,
      autoPost: true,
    });

    // Calculate new outstanding
    const agg = await prisma.journalEntryLine.aggregate({
      where: {
        clientId,
        entry: { isDeleted: false, status: 'POSTED' },
      },
      _sum: { debitAmountPaisa: true, creditAmountPaisa: true },
    });
    const newOutstanding =
      BigInt(agg._sum.debitAmountPaisa ?? 0n) - BigInt(agg._sum.creditAmountPaisa ?? 0n);

    await auditService.log({
      entityType: 'Client',
      entityId: clientId,
      action: AuditAction.CREATE,
      newValue: {
        type: 'payment',
        amountPaisa: amount.toString(),
        paymentMode: input.paymentMode,
        chequeNumber: input.chequeNumber,
        journalEntryId: journalEntry.id,
      },
      userId,
    });

    return {
      id: journalEntry.id,
      journalEntryId: journalEntry.id,
      newOutstandingPaisa: newOutstanding,
      newOutstandingDisplay: formatPaisaToRupees(newOutstanding),
    };
  }

  // ─────────────────────────────────────────────────────────────────────────

  async getOverduePayments(sortBy?: string, sortOrder?: 'asc' | 'desc') {
    const now = new Date();

    const overdueGPs = await prisma.gatePass.findMany({
      where: {
        isDeleted: false,
        paymentDueDate: { lt: now },
        status: { not: 'RECEIVED' },
      },
      include: {
        client: { select: { id: true, name: true } },
      },
      orderBy: { paymentDueDate: 'asc' },
    });

    const items = overdueGPs.map((gp) => ({
      clientId: gp.client.id,
      clientName: gp.client.name,
      gatePassNumber: gp.gatePassNumber,
      amountPaisa: gp.totalAmountPaisa,
      amountDisplay: formatPaisaToRupees(gp.totalAmountPaisa),
      dueDate: toISODate(gp.paymentDueDate),
      daysOverdue: daysBetween(gp.paymentDueDate, now),
    }));

    // Sort
    items.sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'amount') {
        cmp = Number(BigInt(a.amountPaisa) - BigInt(b.amountPaisa));
      } else if (sortBy === 'clientName') {
        cmp = a.clientName.localeCompare(b.clientName);
      } else {
        cmp = a.daysOverdue - b.daysOverdue;
      }
      return (sortOrder === 'asc' ? 1 : -1) * cmp;
    });

    return items;
  }

  // ─────────────────────────────────────────────────────────────────────────

  async getClientRates(clientId: string) {
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true, isDeleted: true },
    });
    if (!client || client.isDeleted) {
      throw Object.assign(new Error('Client not found'), { statusCode: 404, code: 'CLIENT_NOT_FOUND' });
    }

    const rates = await prisma.clientRate.findMany({
      where: { clientId },
      include: {
        variant: { select: { id: true, name: true, code: true } },
      },
      orderBy: { effectiveFrom: 'desc' },
    });

    // Group by variant
    const grouped: Record<
      string,
      { variant: { id: string; name: string; code: string }; current: unknown; history: unknown[] }
    > = {};

    for (const rate of rates) {
      const vid = rate.variantId;
      if (!grouped[vid]) {
        grouped[vid] = { variant: rate.variant, current: null, history: [] };
      }
      const entry = {
        id: rate.id,
        ratePerMeterPaisa: rate.ratePerMeterPaisa,
        ratePerMeterDisplay: formatPaisaToRupees(rate.ratePerMeterPaisa),
        effectiveFrom: toISODate(rate.effectiveFrom),
        effectiveTo: rate.effectiveTo ? toISODate(rate.effectiveTo) : null,
      };
      if (!rate.effectiveTo) {
        grouped[vid].current = entry;
      } else {
        grouped[vid].history.push(entry);
      }
    }

    return Object.values(grouped);
  }

  // ─────────────────────────────────────────────────────────────────────────

  async updateClientRate(
    clientId: string,
    variantId: string,
    newRatePerMeterPaisa: bigint,
    userId: string,
  ) {
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true, isDeleted: true },
    });
    if (!client || client.isDeleted) {
      throw Object.assign(new Error('Client not found'), { statusCode: 404, code: 'CLIENT_NOT_FOUND' });
    }

    const today = new Date();
    const todayISO = toISODate(today);

    return prisma.$transaction(async (tx) => {
      // Archive current rate
      await tx.clientRate.updateMany({
        where: { clientId, variantId, effectiveTo: null },
        data: { effectiveTo: new Date(todayISO) },
      });

      // Create new rate
      const newRate = await tx.clientRate.create({
        data: {
          clientId,
          variantId,
          ratePerMeterPaisa: BigInt(newRatePerMeterPaisa),
          effectiveFrom: new Date(todayISO),
          createdBy: userId,
        },
        include: { variant: { select: { id: true, name: true, code: true } } },
      });

      await auditService.log({
        entityType: 'ClientRate',
        entityId: newRate.id,
        action: AuditAction.CREATE,
        newValue: {
          clientId,
          variantId,
          ratePerMeterPaisa: newRatePerMeterPaisa.toString(),
          effectiveFrom: todayISO,
        },
        userId,
      });

      return {
        id: newRate.id,
        ratePerMeterPaisa: newRate.ratePerMeterPaisa,
        ratePerMeterDisplay: formatPaisaToRupees(newRate.ratePerMeterPaisa),
        effectiveFrom: todayISO,
      };
    });
  }

  // ─────────────────────────────────────────────────────────────────────────

  async getLedgerDownloadData(clientId: string, format: 'csv' | 'pdf') {
    // Full ledger (no pagination)
    const result = await this.getClientLedger(clientId, { page: 1, limit: 999999 });

    if (format === 'csv') {
      return result.entries.map((e) => ({
        Date: e.date,
        Type: e.type,
        Description: e.description,
        'Gate Pass #': e.gatePassNumber ?? '',
        Amount: e.amountDisplay,
        'Due Date': e.paymentDueDate ?? '',
        Overdue: e.isOverdue ? 'Yes' : 'No',
        'Days Overdue': e.daysOverdue,
        'Running Balance': e.runningBalanceDisplay,
      }));
    }

    // PDF structured data
    return {
      client: result.client,
      summary: result.summary,
      entries: result.entries,
      generatedAt: new Date().toISOString(),
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  VOUCHERS
  // ═══════════════════════════════════════════════════════════════════════════

  async listVouchers(params: {
    page: number;
    limit: number;
    categoryId?: string;
    companyId?: string;
    approvalStatus?: ApprovalStatus;
    dateFrom?: string;
    dateTo?: string;
    paymentMode?: PaymentMode;
  }) {
    const { page, limit, categoryId, companyId, approvalStatus, dateFrom, dateTo, paymentMode } =
      params;

    const where: Prisma.VoucherWhereInput = {
      isDeleted: false,
      ...(categoryId ? { categoryId } : {}),
      ...(companyId ? { companyId } : {}),
      ...(approvalStatus ? { approvalStatus } : {}),
      ...(paymentMode ? { paymentMode } : {}),
      ...(dateFrom || dateTo
        ? {
            voucherDate: {
              ...(dateFrom ? { gte: startOfDay(dateFrom) } : {}),
              ...(dateTo ? { lte: endOfDay(dateTo) } : {}),
            },
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      prisma.voucher.findMany({
        where,
        include: {
          category: { select: { id: true, name: true } },
          company: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.voucher.count({ where }),
    ]);

    const enriched = data.map((v) => ({
      ...v,
      amountDisplay: formatPaisaToRupees(v.amountPaisa),
    }));

    return {
      data: enriched,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  // ─────────────────────────────────────────────────────────────────────────

  async createVoucher(
    input: {
      title: string;
      description?: string;
      date: string;
      amountPaisa: bigint;
      categoryId: string;
      paymentMode: PaymentMode;
      chequeNumber?: string;
      companyId: string;
    },
    userId: string,
  ) {
    const amount = BigInt(input.amountPaisa);
    if (amount <= 0n) {
      throw Object.assign(new Error('Amount must be greater than 0'), {
        statusCode: 422,
        code: 'INVALID_AMOUNT',
      });
    }

    if (input.paymentMode === 'CHEQUE' && !input.chequeNumber) {
      throw Object.assign(new Error('Cheque number is required for cheque payments'), {
        statusCode: 422,
        code: 'CHEQUE_NUMBER_REQUIRED',
      });
    }

    const [category, company] = await Promise.all([
      prisma.expenseCategory.findUnique({ where: { id: input.categoryId } }),
      prisma.company.findUnique({ where: { id: input.companyId } }),
    ]);

    if (!category || category.isDeleted) {
      throw Object.assign(new Error('Expense category not found'), {
        statusCode: 404,
        code: 'CATEGORY_NOT_FOUND',
      });
    }
    if (!company) {
      throw Object.assign(new Error('Company not found'), {
        statusCode: 404,
        code: 'COMPANY_NOT_FOUND',
      });
    }

    const voucherNumber = await generateSequenceNumber('VCH', 'voucher');

    const requiresApproval = amount >= AUTO_APPROVAL_THRESHOLD_PAISA;
    const approvalStatus: ApprovalStatus = requiresApproval ? 'PENDING' : 'AUTO_APPROVED';

    let journalEntryId: string | null = null;
    let notificationSent = false;

    if (!requiresApproval) {
      // Auto-approved: create and post journal entry immediately
      const cashBankAccount = await accountingService.getAccountByCode('1000');
      const expenseAccount = await accountingService.getAccountByCode('5000');
      const jeNumber = await generateSequenceNumber('JE', 'journalEntry');

      const je = await accountingService.createJournalEntry({
        entryNumber: jeNumber,
        entryDate: new Date(input.date),
        description: `Voucher ${voucherNumber}: ${input.title}`,
        referenceType: 'voucher',
        lines: [
          {
            accountId: expenseAccount.id,
            debitAmountPaisa: amount,
            creditAmountPaisa: 0n,
            description: `Expense — ${category.name}`,
          },
          {
            accountId: cashBankAccount.id,
            debitAmountPaisa: 0n,
            creditAmountPaisa: amount,
            description: `Cash/Bank payment`,
          },
        ],
        userId,
        autoPost: true,
      });
      journalEntryId = je.id;
    }

    const voucher = await prisma.voucher.create({
      data: {
        voucherNumber,
        title: input.title,
        description: input.description,
        date: new Date(input.date),
        amountPaisa: amount,
        categoryId: input.categoryId,
        paymentMode: input.paymentMode,
        chequeNumber: input.chequeNumber,
        companyId: input.companyId,
        approvalStatus,
        journalEntryId,
        createdBy: userId,
        updatedBy: userId,
      },
    });

    // Update journal entry referenceId now that we have the voucher id
    if (journalEntryId) {
      await prisma.journalEntry.update({
        where: { id: journalEntryId },
        data: { referenceId: voucher.id },
      });
    }

    if (requiresApproval) {
      await notificationService.notifyRole({
        recipientRole: Role.SUPER_ADMIN,
        type: NotificationType.VOUCHER_APPROVAL,
        title: 'Voucher Requires Approval',
        message: `Voucher ${voucherNumber}: ${input.title} — ${formatPaisaToRupees(amount)}. Category: ${category.name}. Approval required.`,
        referenceType: 'voucher',
        referenceId: voucher.id,
      });
      notificationSent = true;
    }

    await auditService.log({
      entityType: 'Voucher',
      entityId: voucher.id,
      action: AuditAction.CREATE,
      newValue: {
        voucherNumber,
        title: input.title,
        amountPaisa: amount.toString(),
        approvalStatus,
        categoryId: input.categoryId,
        companyId: input.companyId,
      },
      userId,
    });

    return {
      id: voucher.id,
      voucherNumber,
      approvalStatus,
      requiresApproval,
      notificationSent,
      version: voucher.version,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────

  async approveOrRejectVoucher(
    id: string,
    action: 'APPROVE' | 'REJECT',
    comment: string | undefined,
    userId: string,
  ) {
    const voucher = await prisma.voucher.findUnique({
      where: { id },
      include: { category: { select: { name: true } } },
    });

    if (!voucher || voucher.isDeleted) {
      throw Object.assign(new Error('Voucher not found'), {
        statusCode: 404,
        code: 'VOUCHER_NOT_FOUND',
      });
    }

    if (voucher.approvalStatus !== 'PENDING') {
      throw Object.assign(
        new Error(`Voucher is not pending approval (current status: ${voucher.approvalStatus})`),
        { statusCode: 422, code: 'INVALID_STATUS' },
      );
    }

    if (action === 'APPROVE') {
      // Create journal entry for the approved expense
      const cashBankAccount = await accountingService.getAccountByCode('1000');
      const expenseAccount = await accountingService.getAccountByCode('5000');
      const jeNumber = await generateSequenceNumber('JE', 'journalEntry');

      const je = await accountingService.createJournalEntry({
        entryNumber: jeNumber,
        entryDate: voucher.date,
        description: `Voucher ${voucher.voucherNumber}: ${voucher.title}`,
        referenceType: 'voucher',
        referenceId: voucher.id,
        lines: [
          {
            accountId: expenseAccount.id,
            debitAmountPaisa: BigInt(voucher.amountPaisa),
            creditAmountPaisa: 0n,
            description: `Expense — ${voucher.category.name}`,
          },
          {
            accountId: cashBankAccount.id,
            debitAmountPaisa: 0n,
            creditAmountPaisa: BigInt(voucher.amountPaisa),
            description: 'Cash/Bank payment',
          },
        ],
        userId,
        autoPost: true,
      });

      await prisma.voucher.update({
        where: { id },
        data: {
          approvalStatus: ApprovalStatus.APPROVED,
          approvedBy: userId,
          approvedAt: new Date(),
          journalEntryId: je.id,
          updatedBy: userId,
          version: { increment: 1 },
        },
      });

      // Notify the creator
      await notificationService.notifyUser({
        recipientUserId: voucher.createdBy,
        type: NotificationType.VOUCHER_APPROVAL,
        title: 'Voucher Approved',
        message: `Your voucher ${voucher.voucherNumber} has been approved.`,
        referenceType: 'voucher',
        referenceId: voucher.id,
      });
    } else {
      // REJECT
      if (!comment) {
        throw Object.assign(new Error('Comment is required when rejecting a voucher'), {
          statusCode: 422,
          code: 'COMMENT_REQUIRED',
        });
      }

      await prisma.voucher.update({
        where: { id },
        data: {
          approvalStatus: ApprovalStatus.REJECTED,
          rejectionReason: comment,
          updatedBy: userId,
          version: { increment: 1 },
        },
      });

      await notificationService.notifyUser({
        recipientUserId: voucher.createdBy,
        type: NotificationType.VOUCHER_APPROVAL,
        title: 'Voucher Rejected',
        message: `Your voucher ${voucher.voucherNumber} has been rejected. Reason: ${comment}`,
        referenceType: 'voucher',
        referenceId: voucher.id,
      });
    }

    await auditService.log({
      entityType: 'Voucher',
      entityId: id,
      action: AuditAction.UPDATE,
      previousValue: { approvalStatus: voucher.approvalStatus },
      newValue: {
        approvalStatus: action === 'APPROVE' ? 'APPROVED' : 'REJECTED',
        comment,
      },
      changedFields: ['approvalStatus', 'approvalComment'],
      userId,
    });

    const updated = await prisma.voucher.findUnique({ where: { id } });
    return {
      ...updated,
      amountDisplay: formatPaisaToRupees(updated!.amountPaisa),
    };
  }

  // ─────────────────────────────────────────────────────────────────────────

  async getMonthlyReport(year: number, month: number, companyId?: string) {
    const monthStart = startOfDay(`${year}-${String(month).padStart(2, '0')}-01`);
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    const monthEnd = startOfDay(`${nextYear}-${String(nextMonth).padStart(2, '0')}-01`);

    // Get cash/bank account
    const cashBankAccount = await accountingService.getAccountByCode('1000');

    // Opening balance: sum all cash/bank movements before this month
    const openingAgg = await prisma.journalEntryLine.aggregate({
      where: {
        accountId: cashBankAccount.id,
        entry: {
          isDeleted: false,
          status: 'POSTED',
          entryDate: { lt: monthStart },
          ...(companyId
            ? {
                OR: [
                  { voucher: { companyId } },
                  { voucher: null },
                ],
              }
            : {}),
        },
      },
      _sum: { debitAmountPaisa: true, creditAmountPaisa: true },
    });
    const openingDebits = openingAgg._sum.debitAmountPaisa ?? 0n;
    const openingCredits = openingAgg._sum.creditAmountPaisa ?? 0n;
    const openingBalance = BigInt(openingDebits) - BigInt(openingCredits);

    // Inflow: credits to cash/bank during the month (money coming in)
    const inflowLines = await prisma.journalEntryLine.findMany({
      where: {
        accountId: cashBankAccount.id,
        debitAmountPaisa: { gt: 0 },
        entry: {
          isDeleted: false,
          status: 'POSTED',
          entryDate: { gte: monthStart, lt: monthEnd },
        },
      },
      include: {
        entry: { select: { referenceType: true, referenceId: true } },
      },
    });

    let clientPayments = 0n;
    let scrapSales = 0n;
    let otherInflows = 0n;

    for (const line of inflowLines) {
      const amount = BigInt(line.debitAmountPaisa);
      if (line.entry.referenceType === 'payment') {
        clientPayments += amount;
      } else if (line.entry.referenceType === 'ScrapSale') {
        scrapSales += amount;
      } else {
        otherInflows += amount;
      }
    }
    const totalInflow = clientPayments + scrapSales + otherInflows;

    // Outflow: credits from cash/bank during the month (money going out, i.e. voucher expenses)
    const outflowLines = await prisma.journalEntryLine.findMany({
      where: {
        accountId: cashBankAccount.id,
        creditAmountPaisa: { gt: 0 },
        entry: {
          isDeleted: false,
          status: 'POSTED',
          entryDate: { gte: monthStart, lt: monthEnd },
          ...(companyId ? { voucher: { companyId } } : {}),
        },
      },
      include: {
        entry: {
          select: {
            referenceType: true,
            referenceId: true,
            voucher: { select: { categoryId: true, category: { select: { id: true, name: true } } } },
          },
        },
      },
    });

    let totalOutflow = 0n;
    const categoryBreakdown: Record<string, { categoryId: string; categoryName: string; totalPaisa: bigint }> = {};

    for (const line of outflowLines) {
      const amount = BigInt(line.creditAmountPaisa);
      totalOutflow += amount;

      if (line.entry.voucher?.category) {
        const cat = line.entry.voucher.category;
        if (!categoryBreakdown[cat.id]) {
          categoryBreakdown[cat.id] = { categoryId: cat.id, categoryName: cat.name, totalPaisa: 0n };
        }
        categoryBreakdown[cat.id].totalPaisa += amount;
      }
    }

    const closingBalance = openingBalance + totalInflow - totalOutflow;

    const categories = Object.values(categoryBreakdown).map((c) => ({
      ...c,
      totalDisplay: formatPaisaToRupees(c.totalPaisa),
    }));

    return {
      year,
      month,
      companyId: companyId ?? null,
      openingBalance,
      openingBalanceDisplay: formatPaisaToRupees(openingBalance),
      inflow: {
        clientPayments,
        clientPaymentsDisplay: formatPaisaToRupees(clientPayments),
        scrapSales,
        scrapSalesDisplay: formatPaisaToRupees(scrapSales),
        otherInflows,
        otherInflowsDisplay: formatPaisaToRupees(otherInflows),
        total: totalInflow,
        totalDisplay: formatPaisaToRupees(totalInflow),
      },
      outflow: {
        total: totalOutflow,
        totalDisplay: formatPaisaToRupees(totalOutflow),
        categories,
      },
      closingBalance,
      closingBalanceDisplay: formatPaisaToRupees(closingBalance),
    };
  }

  async getProfitLoss(year: number, month: number) {
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 1);
    const gatePasses = await prisma.gatePass.findMany({
      where: { isDeleted: false, createdAt: { gte: start, lt: end } },
      include: { lineItems: { select: { lineAmountPaisa: true } } },
    });
    const revenuePaisa = gatePasses.reduce((acc: number, gp: { lineItems: { lineAmountPaisa: bigint }[] }) => {
      return acc + gp.lineItems.reduce((s: number, li: { lineAmountPaisa: bigint }) => s + Number(li.lineAmountPaisa), 0);
    }, 0);
    // COGS = actual FIFO raw-material cost consumed by completed production
    // entries this month (ProductionEntry has no costPricePaisa field — this
    // previously referenced one that never existed in the schema and would
    // have thrown a Prisma validation error at runtime; batchConsumptions is
    // the real per-entry cost source, already tracked for FIFO costing).
    const productions = await prisma.productionEntry.findMany({
      where: { isDeleted: false, status: 'COMPLETED', date: { gte: start, lt: end } },
      select: { batchConsumptions: { select: { totalCostPaisa: true } } },
    });
    const cogsPaisa = productions.reduce((acc: number, pe: { batchConsumptions: { totalCostPaisa: bigint }[] }) => {
      return acc + pe.batchConsumptions.reduce((s: number, bc: { totalCostPaisa: bigint }) => s + Number(bc.totalCostPaisa), 0);
    }, 0);
    // findFirst (not findUnique) so the tenant-scoping extension can inject
    // organizationId — {year, month} alone is no longer globally unique (Phase 2).
    const overhead = await prisma.monthlyOverhead.findFirst({ where: { year, month } });
    const laborPaisa = Number(overhead?.laborPaisa ?? 0);
    const rentPaisa = Number(overhead?.rentPaisa ?? 0);
    const transportationPaisa = Number(overhead?.transportationPaisa ?? 0);
    const packingPaisa = Number(overhead?.packingPaisa ?? 0);
    const miscellaneousPaisa = Number(overhead?.miscellaneousPaisa ?? 0);
    const totalOverheadPaisa = laborPaisa + rentPaisa + transportationPaisa + packingPaisa + miscellaneousPaisa;
    const grossProfitPaisa = revenuePaisa - cogsPaisa;
    const netProfitPaisa = grossProfitPaisa - totalOverheadPaisa;
    return {
      year, month,
      revenue: { paisa: revenuePaisa, display: formatPaisaToRupees(revenuePaisa) },
      cogs: { paisa: cogsPaisa, display: formatPaisaToRupees(cogsPaisa) },
      grossProfit: { paisa: grossProfitPaisa, display: formatPaisaToRupees(grossProfitPaisa) },
      overheads: {
        labor: { paisa: laborPaisa, display: formatPaisaToRupees(laborPaisa) },
        rent: { paisa: rentPaisa, display: formatPaisaToRupees(rentPaisa) },
        transportation: { paisa: transportationPaisa, display: formatPaisaToRupees(transportationPaisa) },
        packing: { paisa: packingPaisa, display: formatPaisaToRupees(packingPaisa) },
        miscellaneous: { paisa: miscellaneousPaisa, display: formatPaisaToRupees(miscellaneousPaisa) },
        total: { paisa: totalOverheadPaisa, display: formatPaisaToRupees(totalOverheadPaisa) },
      },
      netProfit: { paisa: netProfitPaisa, display: formatPaisaToRupees(netProfitPaisa) },
    };
  }
}
export const financeService = new FinanceService();
