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
}

export const accountingService = new AccountingService();
