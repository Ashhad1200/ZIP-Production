import prisma from '../config/database';
import { AuditAction } from '@prisma/client';
import { generateSequenceNumber } from '../utils/sequence';
import { accountingService } from './accounting.service';
import { auditService } from './audit.service';
import { formatPaisaToRupees } from '../utils/currency';
import { startOfDay, endOfDay } from '../utils/date';

// ─── Interfaces ──────────────────────────────────────────────────────────────

interface ReturnLineItemInput {
  gatePassLineItemId: string;
  metersReturned: number;
}

interface CreateSalesReturnInput {
  gatePassId: string;
  date: string; // YYYY-MM-DD
  reason?: string;
  lineItems: ReturnLineItemInput[];
}

interface SalesReturnListFilters {
  page?: number;
  limit?: number;
  clientId?: string;
  gatePassId?: string;
  dateFrom?: string;
  dateTo?: string;
}

// ─── Service ─────────────────────────────────────────────────────────────────

export class SalesReturnService {
  /**
   * Create a sales return against an existing gate pass.
   * - Each returned line references a GatePassLineItem (for the original rate)
   * - Returned meters must not exceed the originally dispatched meters
   * - Finished goods stock is restored (meters added back)
   * - Journal entry: Dr Sales Revenue 4100 / Cr Accounts Receivable 1200
   *   (reverses portion of original sale — reduces client ledger balance)
   */
  async create(input: CreateSalesReturnInput, userId: string) {
    return prisma.$transaction(async (tx) => {
      if (!input.lineItems || input.lineItems.length === 0) {
        throw Object.assign(new Error('At least one line item is required'), {
          statusCode: 422,
          code: 'VALIDATION_ERROR',
        });
      }

      // 1. Load gate pass with its line items
      const gatePass = await tx.gatePass.findUnique({
        where: { id: input.gatePassId, isDeleted: false },
        include: {
          client: { select: { id: true, name: true } },
          lineItems: true,
        },
      });
      if (!gatePass) {
        throw Object.assign(new Error('Gate pass not found'), {
          statusCode: 404,
          code: 'GATE_PASS_NOT_FOUND',
        });
      }

      // 2. Build a map of existing returns for this gate pass so we can enforce
      //    that total returned ≤ originally dispatched per line item
      const existingReturnLines = await tx.salesReturnLineItem.findMany({
        where: {
          gatePassLineItem: { gatePassId: input.gatePassId },
        },
        select: { gatePassLineItemId: true, metersReturned: true },
      });
      const alreadyReturned = new Map<string, number>();
      for (const r of existingReturnLines) {
        alreadyReturned.set(
          r.gatePassLineItemId,
          (alreadyReturned.get(r.gatePassLineItemId) ?? 0) + r.metersReturned,
        );
      }

      // 3. Validate each return line and resolve rate from original line item
      type ResolvedReturnLine = {
        gatePassLineItemId: string;
        variantId: string;
        metersReturned: number;
        ratePerMeterPaisa: bigint;
        lineAmountPaisa: bigint;
      };

      const resolvedLines: ResolvedReturnLine[] = [];

      for (const item of input.lineItems) {
        if (!item.gatePassLineItemId || item.metersReturned <= 0) {
          throw Object.assign(
            new Error('Each line item needs gatePassLineItemId and metersReturned > 0'),
            { statusCode: 422, code: 'VALIDATION_ERROR' },
          );
        }

        const original = gatePass.lineItems.find((li) => li.id === item.gatePassLineItemId);
        if (!original) {
          throw Object.assign(
            new Error(`Line item ${item.gatePassLineItemId} not found on gate pass`),
            { statusCode: 404, code: 'LINE_ITEM_NOT_FOUND' },
          );
        }

        const prevReturned = alreadyReturned.get(item.gatePassLineItemId) ?? 0;
        const maxReturnable = original.meters - prevReturned;

        if (item.metersReturned > maxReturnable) {
          throw Object.assign(
            new Error(
              `Cannot return ${item.metersReturned}m for line item ${item.gatePassLineItemId}. ` +
                `Dispatched: ${original.meters}m, Already returned: ${prevReturned}m, ` +
                `Max returnable: ${maxReturnable}m`,
            ),
            { statusCode: 422, code: 'RETURN_EXCEEDS_DISPATCHED' },
          );
        }

        const lineAmountPaisa = original.ratePerMeterPaisa * BigInt(item.metersReturned);
        resolvedLines.push({
          gatePassLineItemId: item.gatePassLineItemId,
          variantId: original.variantId,
          metersReturned: item.metersReturned,
          ratePerMeterPaisa: original.ratePerMeterPaisa,
          lineAmountPaisa,
        });
      }

      // 4. Restore finished goods stock for each returned line
      for (const line of resolvedLines) {
        await tx.finishedGoodsStock.upsert({
          where: { variantId: line.variantId },
          update: { currentMeters: { increment: line.metersReturned }, updatedBy: userId },
          create: {
            variantId: line.variantId,
            currentMeters: line.metersReturned,
            createdBy: userId,
            updatedBy: userId,
          },
        });
      }

      // 5. Total return amount
      const totalAmountPaisa = resolvedLines.reduce((sum, l) => sum + l.lineAmountPaisa, 0n);

      // 6. Generate return number and journal entry
      const returnNumber = await generateSequenceNumber('SR', 'salesReturn');
      const returnDate = new Date(`${input.date}T00:00:00.000Z`);

      // Journal: Dr Sales Revenue 4100 (reduce revenue) / Cr AR 1200 (reduce client balance)
      const arAccount = await accountingService.getAccountByCode('1200', tx);
      const revenueAccount = await accountingService.getAccountByCode('4100', tx);

      const journalEntry = await accountingService.createJournalEntry(
        {
          entryNumber: `JE-${returnNumber}`,
          entryDate: returnDate,
          description: `Sales return ${returnNumber} from ${gatePass.client.name} (GP: ${gatePass.gatePassNumber})`,
          referenceType: 'SALES_RETURN',
          referenceId: '', // updated after creation
          lines: [
            {
              accountId: revenueAccount.id,
              description: `Sales Return - ${returnNumber}`,
              debitAmountPaisa: totalAmountPaisa,
              creditAmountPaisa: 0n,
            },
            {
              accountId: arAccount.id,
              clientId: gatePass.client.id,
              description: `CR Note - ${gatePass.client.name}`,
              debitAmountPaisa: 0n,
              creditAmountPaisa: totalAmountPaisa,
            },
          ],
          userId,
          autoPost: true,
        },
        tx,
      );

      // 7. Create the sales return record
      const salesReturn = await tx.salesReturn.create({
        data: {
          returnNumber,
          gatePassId: input.gatePassId,
          clientId: gatePass.clientId,
          date: returnDate,
          reason: input.reason ?? null,
          totalAmountPaisa,
          journalEntryId: journalEntry.id,
          createdBy: userId,
          updatedBy: userId,
        },
      });

      // Update journal entry referenceId
      await tx.journalEntry.update({
        where: { id: journalEntry.id },
        data: { referenceId: salesReturn.id },
      });

      // 8. Create line items
      for (const line of resolvedLines) {
        await tx.salesReturnLineItem.create({
          data: {
            salesReturnId: salesReturn.id,
            gatePassLineItemId: line.gatePassLineItemId,
            variantId: line.variantId,
            metersReturned: line.metersReturned,
            ratePerMeterPaisa: line.ratePerMeterPaisa,
            lineAmountPaisa: line.lineAmountPaisa,
          },
        });
      }

      // 9. Audit log
      await auditService.log({
        entityType: 'SalesReturn',
        entityId: salesReturn.id,
        action: AuditAction.CREATE,
        newValue: {
          returnNumber,
          gatePassId: input.gatePassId,
          clientId: gatePass.clientId,
          totalAmountPaisa: totalAmountPaisa.toString(),
          lineItems: resolvedLines.map((l) => ({
            variantId: l.variantId,
            metersReturned: l.metersReturned,
            ratePerMeterPaisa: l.ratePerMeterPaisa.toString(),
          })),
        },
        userId,
      });

      // 10. Re-fetch full result
      const result = await tx.salesReturn.findUnique({
        where: { id: salesReturn.id },
        include: {
          gatePass: { select: { id: true, gatePassNumber: true } },
          client: { select: { id: true, name: true } },
          lineItems: {
            include: {
              variant: { select: { id: true, code: true, name: true } },
              gatePassLineItem: { select: { id: true, meters: true } },
            },
          },
        },
      });

      return this.serialize(result!);
    });
  }

  /**
   * List sales returns with optional filters.
   */
  async list(filters: SalesReturnListFilters) {
    const { page = 1, limit = 20, clientId, gatePassId, dateFrom, dateTo } = filters;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (clientId) where.clientId = clientId;
    if (gatePassId) where.gatePassId = gatePassId;
    if (dateFrom || dateTo) {
      where.date = {
        ...(dateFrom ? { gte: startOfDay(dateFrom) } : {}),
        ...(dateTo ? { lte: endOfDay(dateTo) } : {}),
      };
    }

    const [total, items] = await Promise.all([
      prisma.salesReturn.count({ where }),
      prisma.salesReturn.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          gatePass: { select: { id: true, gatePassNumber: true } },
          client: { select: { id: true, name: true } },
          lineItems: {
            include: {
              variant: { select: { id: true, code: true, name: true } },
              gatePassLineItem: { select: { id: true, meters: true } },
            },
          },
        },
      }),
    ]);

    return {
      data: items.map((r) => this.serialize(r)),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * Get a single sales return by id.
   */
  async getById(id: string) {
    const result = await prisma.salesReturn.findUnique({
      where: { id },
      include: {
        gatePass: { select: { id: true, gatePassNumber: true } },
        client: { select: { id: true, name: true } },
        lineItems: {
          include: {
            variant: { select: { id: true, code: true, name: true } },
            gatePassLineItem: { select: { id: true, meters: true } },
          },
        },
      },
    });

    if (!result) {
      throw Object.assign(new Error('Sales return not found'), {
        statusCode: 404,
        code: 'NOT_FOUND',
      });
    }

    return this.serialize(result);
  }

  // ─── Serializer ──────────────────────────────────────────────────────────────

  private serialize(r: {
    id: string;
    returnNumber: string;
    gatePassId: string;
    clientId: string;
    date: Date;
    reason: string | null;
    totalAmountPaisa: bigint;
    journalEntryId: string | null;
    createdAt: Date;
    gatePass: { id: string; gatePassNumber: string };
    client: { id: string; name: string };
    lineItems: Array<{
      id: string;
      salesReturnId: string;
      gatePassLineItemId: string;
      variantId: string;
      metersReturned: number;
      ratePerMeterPaisa: bigint;
      lineAmountPaisa: bigint;
      variant: { id: string; code: string; name: string };
      gatePassLineItem: { id: string; meters: number };
    }>;
  }) {
    return {
      id: r.id,
      returnNumber: r.returnNumber,
      gatePassId: r.gatePassId,
      clientId: r.clientId,
      date: r.date.toISOString().slice(0, 10),
      reason: r.reason,
      totalAmountPaisa: r.totalAmountPaisa.toString(),
      totalAmountDisplay: formatPaisaToRupees(r.totalAmountPaisa),
      journalEntryId: r.journalEntryId,
      createdAt: r.createdAt.toISOString(),
      gatePass: r.gatePass,
      client: r.client,
      lineItems: r.lineItems.map((li) => ({
        id: li.id,
        gatePassLineItemId: li.gatePassLineItemId,
        variantId: li.variantId,
        metersReturned: li.metersReturned,
        originalMeters: li.gatePassLineItem.meters,
        ratePerMeterPaisa: li.ratePerMeterPaisa.toString(),
        ratePerMeterDisplay: formatPaisaToRupees(li.ratePerMeterPaisa),
        lineAmountPaisa: li.lineAmountPaisa.toString(),
        lineAmountDisplay: formatPaisaToRupees(li.lineAmountPaisa),
        variant: li.variant,
      })),
    };
  }
}

export const salesReturnService = new SalesReturnService();
