import prisma from '../config/database';
import { JournalEntryStatus, Prisma } from '@prisma/client';

interface JournalEntryLineInput {
  accountId: string;
  clientId?: string;
  description?: string;
  debitAmountPaisa: bigint;
  creditAmountPaisa: bigint;
  lineOrder?: number;
}

interface CreateJournalEntryInput {
  entryNumber: string;
  entryDate: Date;
  description?: string;
  referenceType?: string;
  referenceId?: string;
  lines: JournalEntryLineInput[];
  userId: string;
  autoPost?: boolean; // If true, immediately post after creation
}

export class AccountingService {
  /**
   * Create a journal entry with lines. Optionally auto-post.
   */
  async createJournalEntry(input: CreateJournalEntryInput, tx?: Prisma.TransactionClient) {
    const client = tx || prisma;

    // Validate lines balance
    const totalDebit = input.lines.reduce((sum, l) => sum + l.debitAmountPaisa, 0n);
    const totalCredit = input.lines.reduce((sum, l) => sum + l.creditAmountPaisa, 0n);

    if (totalDebit !== totalCredit) {
      throw Object.assign(
        new Error(`Journal entry is unbalanced: debits=${totalDebit}, credits=${totalCredit}`),
        { statusCode: 422, code: 'JOURNAL_IMBALANCED' }
      );
    }

    if (input.lines.length < 2) {
      throw Object.assign(
        new Error('Journal entry must have at least 2 lines'),
        { statusCode: 422, code: 'INSUFFICIENT_LINES' }
      );
    }

    // Validate that no line has both debit and credit
    for (const line of input.lines) {
      if (line.debitAmountPaisa > 0n && line.creditAmountPaisa > 0n) {
        throw Object.assign(
          new Error('A journal entry line cannot have both debit and credit amounts'),
          { statusCode: 422, code: 'INVALID_LINE' }
        );
      }
    }

    const status = input.autoPost ? JournalEntryStatus.POSTED : JournalEntryStatus.DRAFT;

    const entry = await client.journalEntry.create({
      data: {
        entryNumber: input.entryNumber,
        entryDate: input.entryDate,
        description: input.description,
        status,
        referenceType: input.referenceType,
        referenceId: input.referenceId,
        postedAt: input.autoPost ? new Date() : null,
        postedBy: input.autoPost ? input.userId : null,
        createdBy: input.userId,
        updatedBy: input.userId,
        lines: {
          create: input.lines.map((line, index) => ({
            accountId: line.accountId,
            clientId: line.clientId,
            description: line.description,
            debitAmountPaisa: line.debitAmountPaisa,
            creditAmountPaisa: line.creditAmountPaisa,
            lineOrder: line.lineOrder ?? index,
          })),
        },
      },
      include: {
        lines: {
          include: {
            account: { select: { id: true, code: true, name: true } },
          },
        },
      },
    });

    return entry;
  }

  /**
   * Post a draft journal entry. The database trigger will enforce balance.
   */
  async postEntry(entryId: string, userId: string, tx?: Prisma.TransactionClient) {
    const client = tx || prisma;

    const entry = await client.journalEntry.findUnique({
      where: { id: entryId },
      include: { lines: true },
    });

    if (!entry) {
      throw Object.assign(new Error('Journal entry not found'), { statusCode: 404, code: 'ENTRY_NOT_FOUND' });
    }

    if (entry.status !== JournalEntryStatus.DRAFT) {
      throw Object.assign(
        new Error(`Cannot post entry with status ${entry.status}`),
        { statusCode: 422, code: 'INVALID_STATUS_TRANSITION' }
      );
    }

    return client.journalEntry.update({
      where: { id: entryId },
      data: {
        status: JournalEntryStatus.POSTED,
        postedAt: new Date(),
        postedBy: userId,
        updatedBy: userId,
      },
      include: { lines: true },
    });
  }

  /**
   * Reverse a posted journal entry by creating a new entry with swapped debits/credits.
   */
  async reverseEntry(entryId: string, userId: string) {
    return prisma.$transaction(async (tx) => {
      const entry = await tx.journalEntry.findUnique({
        where: { id: entryId },
        include: { lines: true },
      });

      if (!entry) {
        throw Object.assign(new Error('Journal entry not found'), { statusCode: 404, code: 'ENTRY_NOT_FOUND' });
      }

      if (entry.status !== JournalEntryStatus.POSTED) {
        throw Object.assign(
          new Error('Only posted entries can be reversed'),
          { statusCode: 422, code: 'INVALID_STATUS_TRANSITION' }
        );
      }

      // Mark original as reversed
      await tx.journalEntry.update({
        where: { id: entryId },
        data: { status: JournalEntryStatus.REVERSED, updatedBy: userId },
      });

      // Create reversal entry with swapped debits/credits
      const reversalEntry = await this.createJournalEntry({
        entryNumber: `REV-${entry.entryNumber}`,
        entryDate: new Date(),
        description: `Reversal of ${entry.entryNumber}`,
        referenceType: entry.referenceType ?? undefined,
        referenceId: entry.referenceId ?? undefined,
        lines: entry.lines.map(line => ({
          accountId: line.accountId,
          clientId: line.clientId ?? undefined,
          description: `Reversal: ${line.description || ''}`,
          debitAmountPaisa: line.creditAmountPaisa, // Swap
          creditAmountPaisa: line.debitAmountPaisa, // Swap
          lineOrder: line.lineOrder,
        })),
        userId,
        autoPost: true,
      }, tx);

      return reversalEntry;
    });
  }

  /**
   * Get account by code (for use in service layer).
   */
  async getAccountByCode(code: string, tx?: Prisma.TransactionClient) {
    const client = tx || prisma;
    const account = await client.account.findUnique({ where: { code } });
    if (!account) {
      throw Object.assign(new Error(`Account with code ${code} not found`), { statusCode: 404, code: 'ACCOUNT_NOT_FOUND' });
    }
    return account;
  }

  /**
   * Get journal entries for a reference (e.g., all JEs for a gate pass).
   */
  async getEntriesByReference(referenceType: string, referenceId: string) {
    return prisma.journalEntry.findMany({
      where: { referenceType, referenceId },
      include: {
        lines: {
          include: {
            account: { select: { id: true, code: true, name: true } },
            client: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { entryDate: 'desc' },
    });
  }

  /**
   * List journal entries with pagination and filters.
   */
  async listJournalEntries(opts: {
    page?: number;
    limit?: number;
    status?: JournalEntryStatus;
    dateFrom?: string;
    dateTo?: string;
    referenceType?: string;
    search?: string;
  }) {
    const page = opts.page || 1;
    const limit = opts.limit || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.JournalEntryWhereInput = { isDeleted: false };

    if (opts.status) where.status = opts.status;
    if (opts.referenceType) where.referenceType = opts.referenceType;
    if (opts.dateFrom || opts.dateTo) {
      where.entryDate = {};
      if (opts.dateFrom) (where.entryDate as any).gte = new Date(opts.dateFrom);
      if (opts.dateTo) (where.entryDate as any).lte = new Date(opts.dateTo);
    }
    if (opts.search) {
      where.OR = [
        { entryNumber: { contains: opts.search, mode: 'insensitive' } },
        { description: { contains: opts.search, mode: 'insensitive' } },
      ];
    }

    const [entries, total] = await Promise.all([
      prisma.journalEntry.findMany({
        where,
        include: {
          lines: {
            include: {
              account: { select: { id: true, code: true, name: true, accountType: true } },
              client: { select: { id: true, name: true } },
            },
            orderBy: { lineOrder: 'asc' },
          },
        },
        orderBy: { entryDate: 'desc' },
        skip,
        take: limit,
      }),
      prisma.journalEntry.count({ where }),
    ]);

    // Convert BigInt fields to numbers for JSON serialization
    const serialized = entries.map((e) => ({
      ...e,
      lines: e.lines.map((l) => ({
        ...l,
        debitAmountPaisa: Number(l.debitAmountPaisa),
        creditAmountPaisa: Number(l.creditAmountPaisa),
      })),
    }));

    return { data: serialized, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  /**
   * General Ledger: transactions grouped by account for a date range.
   */
  async getGeneralLedger(opts: {
    dateFrom: string;
    dateTo: string;
    accountId?: string;
  }) {
    const dateFrom = new Date(opts.dateFrom);
    const dateTo = new Date(opts.dateTo);

    // Get all accounts
    const accountFilter: Prisma.AccountWhereInput = opts.accountId
      ? { id: opts.accountId }
      : { isGroup: false, isActive: true };

    const accounts = await prisma.account.findMany({
      where: accountFilter,
      orderBy: { code: 'asc' },
    });

    const results = [];
    for (const account of accounts) {
      // Opening balance: sum of all POSTED lines before dateFrom
      const openingLines = await prisma.journalEntryLine.findMany({
        where: {
          accountId: account.id,
          entry: { status: 'POSTED', isDeleted: false, entryDate: { lt: dateFrom } },
        },
        select: { debitAmountPaisa: true, creditAmountPaisa: true },
      });
      const openingDebit = openingLines.reduce((s, l) => s + Number(l.debitAmountPaisa), 0);
      const openingCredit = openingLines.reduce((s, l) => s + Number(l.creditAmountPaisa), 0);
      const openingBalance = openingDebit - openingCredit;

      // Period transactions
      const periodLines = await prisma.journalEntryLine.findMany({
        where: {
          accountId: account.id,
          entry: { status: 'POSTED', isDeleted: false, entryDate: { gte: dateFrom, lte: dateTo } },
        },
        include: {
          entry: { select: { id: true, entryNumber: true, entryDate: true, description: true, referenceType: true, referenceId: true } },
          client: { select: { id: true, name: true } },
        },
        orderBy: { entry: { entryDate: 'asc' } },
      });

      const totalDebit = periodLines.reduce((s, l) => s + Number(l.debitAmountPaisa), 0);
      const totalCredit = periodLines.reduce((s, l) => s + Number(l.creditAmountPaisa), 0);
      const closingBalance = openingBalance + totalDebit - totalCredit;

      // Only include accounts that have transactions or an opening balance
      if (openingBalance !== 0 || periodLines.length > 0) {
        results.push({
          account: { id: account.id, code: account.code, name: account.name, accountType: account.accountType },
          openingBalance,
          transactions: periodLines.map((l) => ({
            id: l.id,
            date: l.entry.entryDate,
            entryNumber: l.entry.entryNumber,
            description: l.description || l.entry.description,
            referenceType: l.entry.referenceType,
            referenceId: l.entry.referenceId,
            clientName: l.client?.name || null,
            debitPaisa: Number(l.debitAmountPaisa),
            creditPaisa: Number(l.creditAmountPaisa),
          })),
          totalDebit,
          totalCredit,
          closingBalance,
        });
      }
    }

    return results;
  }

  /**
   * Trial Balance: debit & credit totals per account for a date range.
   */
  async getTrialBalance(opts: { dateFrom: string; dateTo: string }) {
    const dateFrom = new Date(opts.dateFrom);
    const dateTo = new Date(opts.dateTo);

    const accounts = await prisma.account.findMany({
      where: { isGroup: false, isActive: true },
      orderBy: { code: 'asc' },
    });

    const rows = [];
    let grandTotalDebit = 0;
    let grandTotalCredit = 0;

    for (const account of accounts) {
      // Sum all POSTED lines in date range
      const lines = await prisma.journalEntryLine.findMany({
        where: {
          accountId: account.id,
          entry: { status: 'POSTED', isDeleted: false, entryDate: { gte: dateFrom, lte: dateTo } },
        },
        select: { debitAmountPaisa: true, creditAmountPaisa: true },
      });

      const totalDebit = lines.reduce((s, l) => s + Number(l.debitAmountPaisa), 0);
      const totalCredit = lines.reduce((s, l) => s + Number(l.creditAmountPaisa), 0);

      if (totalDebit !== 0 || totalCredit !== 0) {
        // For trial balance, show net balance in debit or credit column
        const netBalance = totalDebit - totalCredit;
        const debitBalance = netBalance > 0 ? netBalance : 0;
        const creditBalance = netBalance < 0 ? Math.abs(netBalance) : 0;

        grandTotalDebit += debitBalance;
        grandTotalCredit += creditBalance;

        rows.push({
          accountCode: account.code,
          accountName: account.name,
          accountType: account.accountType,
          totalDebit,
          totalCredit,
          debitBalance,
          creditBalance,
        });
      }
    }

    return {
      rows,
      grandTotalDebit,
      grandTotalCredit,
      isBalanced: Math.abs(grandTotalDebit - grandTotalCredit) < 1, // Allow ±1 paisa rounding
    };
  }

  /**
   * List all accounts (for dropdowns and GL filter).
   */
  async listAccounts() {
    const accounts = await prisma.account.findMany({
      where: { isActive: true },
      orderBy: { code: 'asc' },
      select: { id: true, code: true, name: true, accountType: true, isGroup: true, parentId: true },
    });
    return accounts;
  }
}

export const accountingService = new AccountingService();
