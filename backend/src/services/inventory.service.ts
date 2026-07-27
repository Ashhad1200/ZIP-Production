import prisma, { TenantTransactionClient } from '../config/database';
import { AuditAction, NotificationType, Prisma, PurchaseSource, Role } from '@prisma/client';
import { formatPaisaToRupees } from '../utils/currency';
import { accountingService } from './accounting.service';
import { auditService } from './audit.service';
import { notificationService } from './notification.service';
import { toISODate } from '../utils/date';

// ─── FIFO batch deduction result ─────────────────────────────────────────────
export interface FifoDeductionResult {
  totalBagsConsumed: number;
  totalCostPaisa: bigint;
  breakdown: Array<{
    batchId: string;
    bagsConsumed: number;
    pricePerBagPaisa: bigint;
    costPaisa: bigint;
  }>;
}

export class InventoryService {
  // ═══════════════════════════════════════════════════════════════════════════
  //  FIFO BATCH COSTING
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Deduct bags from FIFO batches within a transaction.
   * Returns breakdown of which batches were consumed and at what cost.
   */
  async deductFifoBatches(
    rawMaterialTypeId: string,
    bagsNeeded: number,
    userId: string,
    tx: TenantTransactionClient
  ): Promise<FifoDeductionResult> {
    // Fetch non-exhausted batches ordered by purchase date (oldest first = FIFO)
    const batches = await tx.rawMaterialBatch.findMany({
      where: { rawMaterialTypeId, isExhausted: false },
      orderBy: [{ purchaseDate: 'asc' }, { createdAt: 'asc' }],
    });

    let remaining = bagsNeeded;
    const breakdown: FifoDeductionResult['breakdown'] = [];

    for (const batch of batches) {
      if (remaining <= 0) break;

      const batchAvailable = Number(batch.bagsRemaining);
      const consume = Math.min(batchAvailable, remaining);
      const costPaisa = BigInt(Math.round(consume * Number(batch.pricePerBagPaisa)));

      const newBagsRemaining = batchAvailable - consume;
      await tx.rawMaterialBatch.update({
        where: { id: batch.id },
        data: {
          bagsRemaining: new Prisma.Decimal(newBagsRemaining),
          isExhausted: newBagsRemaining <= 0,
          updatedBy: userId,
        },
      });

      breakdown.push({
        batchId: batch.id,
        bagsConsumed: consume,
        pricePerBagPaisa: batch.pricePerBagPaisa,
        costPaisa,
      });

      remaining -= consume;
    }

    if (remaining > 0.0001) {
      // Not enough batch stock — consume what's available (stock deduction handles the total)
      // This handles edge case where stock count and batch count diverge
    }

    const totalBagsConsumed = bagsNeeded - Math.max(0, remaining);
    const totalCostPaisa = breakdown.reduce((sum, b) => sum + b.costPaisa, 0n);

    return { totalBagsConsumed, totalCostPaisa, breakdown };
  }

  /**
   * List all FIFO batches for a raw material type (for UI display).
   */
  async listBatches(params: { rawMaterialTypeId?: string; includeExhausted?: boolean } = {}) {
    const { rawMaterialTypeId, includeExhausted = false } = params;
    const batches = await prisma.rawMaterialBatch.findMany({
      where: {
        ...(rawMaterialTypeId ? { rawMaterialTypeId } : {}),
        ...(!includeExhausted ? { isExhausted: false } : {}),
      },
      include: {
        rawMaterialType: { select: { id: true, code: true, name: true } },
        purchase: { select: { id: true, purchaseDate: true, source: true } },
      },
      orderBy: [{ rawMaterialTypeId: 'asc' }, { purchaseDate: 'asc' }],
    });

    return batches.map((b) => ({
      id: b.id,
      rawMaterialType: b.rawMaterialType,
      purchaseDate: toISODate(b.purchaseDate),
      source: b.source,
      bagsTotal: Number(b.bagsTotal),
      bagsRemaining: Number(b.bagsRemaining),
      bagsConsumed: Number(b.bagsTotal) - Number(b.bagsRemaining),
      pricePerBagPaisa: Number(b.pricePerBagPaisa),
      pricePerBagDisplay: formatPaisaToRupees(b.pricePerBagPaisa),
      isExhausted: b.isExhausted,
      purchaseId: b.purchaseId,
    }));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  ELECTRICITY RATES
  // ═══════════════════════════════════════════════════════════════════════════

  /** Get the current active electricity rate. */
  async getCurrentElectricityRate(): Promise<{ id: string; ratePaisaPerUnit: bigint; effectiveFrom: string } | null> {
    const today = new Date();
    const rate = await prisma.electricityRate.findFirst({
      where: {
        effectiveFrom: { lte: today },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: today } }],
      },
      orderBy: { effectiveFrom: 'desc' },
    });
    if (!rate) return null;
    return {
      id: rate.id,
      ratePaisaPerUnit: rate.ratePaisaPerUnit,
      effectiveFrom: toISODate(rate.effectiveFrom),
    };
  }

  /** Get electricity rate active on a specific date. */
  async getElectricityRateOnDate(date: Date): Promise<bigint | null> {
    const rate = await prisma.electricityRate.findFirst({
      where: {
        effectiveFrom: { lte: date },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: date } }],
      },
      orderBy: { effectiveFrom: 'desc' },
    });
    return rate?.ratePaisaPerUnit ?? null;
  }

  /** List all electricity rate history. */
  async listElectricityRates() {
    const rates = await prisma.electricityRate.findMany({
      orderBy: { effectiveFrom: 'desc' },
    });
    return rates.map((r) => ({
      id: r.id,
      ratePaisaPerUnit: Number(r.ratePaisaPerUnit),
      rateDisplay: formatPaisaToRupees(r.ratePaisaPerUnit),
      effectiveFrom: toISODate(r.effectiveFrom),
      effectiveTo: r.effectiveTo ? toISODate(r.effectiveTo) : null,
      notes: r.notes,
    }));
  }

  /** Create a new electricity rate. Closes the previous rate's effectiveTo. */
  async createElectricityRate(
    input: { ratePaisaPerUnit: bigint | number; effectiveFrom: string; notes?: string },
    userId: string
  ) {
    const effectiveFrom = new Date(input.effectiveFrom + 'T00:00:00.000Z');

    return prisma.$transaction(async (tx) => {
      // Close any rate that overlaps
      await tx.electricityRate.updateMany({
        where: { effectiveTo: null, effectiveFrom: { lt: effectiveFrom } },
        data: { effectiveTo: effectiveFrom, updatedBy: userId },
      });

      const rate = await tx.electricityRate.create({
        data: {
          ratePaisaPerUnit: BigInt(input.ratePaisaPerUnit),
          effectiveFrom,
          notes: input.notes,
          createdBy: userId,
          updatedBy: userId,
        },
      });

      return {
        id: rate.id,
        ratePaisaPerUnit: Number(rate.ratePaisaPerUnit),
        rateDisplay: formatPaisaToRupees(rate.ratePaisaPerUnit),
        effectiveFrom: toISODate(rate.effectiveFrom),
      };
    });
  }

  /**
   * List finished goods stock, optionally filtered by variant or low-stock flag.
   */
  async getFinishedGoods(params: { variantId?: string; belowThreshold?: boolean }) {
    const { variantId, belowThreshold } = params;

    const items = await prisma.finishedGoodsStock.findMany({
      where: {
        ...(variantId ? { variantId } : {}),
      },
      include: {
        variant: { select: { id: true, code: true, name: true, metersPerCarton: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    const result = items.map((item) => {
      const isBelowThreshold =
        item.lowStockThreshold != null && item.currentMeters < item.lowStockThreshold;
      return {
        id: item.id,
        variant: item.variant,
        currentMeters: item.currentMeters,
        lowStockThreshold: item.lowStockThreshold,
        isBelowThreshold,
        lastUpdated: item.updatedAt.toISOString(),
        version: item.version,
      };
    });

    if (belowThreshold) {
      return result.filter((r) => r.isBelowThreshold);
    }

    return result;
  }

  /**
   * List raw material stock for all raw material types.
   */
  async getRawMaterials() {
    const items = await prisma.rawMaterialStock.findMany({
      include: {
        rawMaterialType: { select: { id: true, code: true, name: true, lowStockThresholdBags: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return items.map((item) => {
      const currentBags = Number(item.currentBags);
      const thresholdBags = item.rawMaterialType.lowStockThresholdBags
        ? Number(item.rawMaterialType.lowStockThresholdBags)
        : null;
      const isBelowThreshold = thresholdBags != null && currentBags < thresholdBags;

      return {
        id: item.id,
        rawMaterialType: { id: item.rawMaterialType.id, code: item.rawMaterialType.code, name: item.rawMaterialType.name },
        currentBags,
        lowStockThresholdBags: thresholdBags,
        isBelowThreshold,
        lastUpdated: item.updatedAt.toISOString(),
        version: item.version,
      };
    });
  }

  /**
   * List raw material purchases with pagination and filters.
   */
  async listPurchases(params: {
    page: number;
    limit: number;
    rawMaterialTypeId?: string;
    source?: PurchaseSource;
    dateFrom?: string;
    dateTo?: string;
  }) {
    const { page, limit, rawMaterialTypeId, source, dateFrom, dateTo } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.RawMaterialPurchaseWhereInput = {
      isDeleted: false,
      ...(rawMaterialTypeId ? { rawMaterialTypeId } : {}),
      ...(source ? { source } : {}),
      ...(dateFrom || dateTo
        ? {
            purchaseDate: {
              ...(dateFrom ? { gte: new Date(dateFrom + 'T00:00:00.000Z') } : {}),
              ...(dateTo ? { lte: new Date(dateTo + 'T00:00:00.000Z') } : {}),
            },
          }
        : {}),
    };

    const [purchases, total] = await Promise.all([
      prisma.rawMaterialPurchase.findMany({
        where,
        skip,
        take: limit,
        orderBy: { purchaseDate: 'desc' },
        include: {
          rawMaterialType: { select: { id: true, code: true, name: true } },
          vendor: { select: { id: true, name: true } },
        },
      }),
      prisma.rawMaterialPurchase.count({ where }),
    ]);

    const data = purchases.map((p) => ({
      id: p.id,
      rawMaterialType: p.rawMaterialType,
      vendor: p.vendor,
      numberOfBags: Number(p.numberOfBags),
      ratePerBagPaisa: Number(p.ratePerBagPaisa),
      ratePerBagDisplay: formatPaisaToRupees(p.ratePerBagPaisa),
      totalAmountPaisa: Number(p.totalAmountPaisa),
      totalAmountDisplay: formatPaisaToRupees(p.totalAmountPaisa),
      purchaseDate: toISODate(p.purchaseDate),
      source: p.source,
      createdAt: p.createdAt.toISOString(),
    }));

    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  /**
   * Record a raw material purchase with stock update, journal entry, and audit log.
   */
  async recordPurchase(
    input: {
      rawMaterialTypeId: string;
      vendorId?: string;
      numberOfBags: number;
      ratePerBagPaisa: number;
      purchaseDate: string;
      source: PurchaseSource;
    },
    userId: string
  ) {
    return prisma.$transaction(async (tx) => {
      // Validate raw material type
      const rawMaterialType = await tx.rawMaterialType.findUnique({
        where: { id: input.rawMaterialTypeId },
      });

      if (!rawMaterialType) {
        throw Object.assign(new Error('Grain type not found'), {
          statusCode: 404,
          code: 'NOT_FOUND',
        });
      }

      const totalAmountPaisa = BigInt(input.numberOfBags) * BigInt(input.ratePerBagPaisa);
      const purchaseDate = new Date(input.purchaseDate + 'T00:00:00.000Z');

      // Create journal entry: Debit Raw Material Inventory, Credit Cash
      const rawMaterialAccount = await accountingService.getAccountByCode('1200', tx);
      const cashAccount = await accountingService.getAccountByCode('1000', tx);

      const year = new Date().getFullYear();
      const seq = Date.now();
      const entryNumber = `JE-PUR-${year}-${seq}`;

      const journalEntry = await accountingService.createJournalEntry(
        {
          entryNumber,
          entryDate: purchaseDate,
          description: `Raw material purchase - ${rawMaterialType.name}: ${input.numberOfBags} bags @ ${formatPaisaToRupees(BigInt(input.ratePerBagPaisa))}/bag`,
          referenceType: 'RawMaterialPurchase',
          lines: [
            {
              accountId: rawMaterialAccount.id,
              description: 'Raw material inventory increase',
              debitAmountPaisa: totalAmountPaisa,
              creditAmountPaisa: 0n,
              lineOrder: 0,
            },
            {
              accountId: cashAccount.id,
              description: 'Cash payment for raw material purchase',
              debitAmountPaisa: 0n,
              creditAmountPaisa: totalAmountPaisa,
              lineOrder: 1,
            },
          ],
          userId,
          autoPost: true,
        },
        tx
      );

      // Create purchase record
      const purchase = await tx.rawMaterialPurchase.create({
        data: {
          rawMaterialTypeId: input.rawMaterialTypeId,
          vendorId: input.vendorId || null,
          numberOfBags: new Prisma.Decimal(input.numberOfBags),
          ratePerBagPaisa: BigInt(input.ratePerBagPaisa),
          totalAmountPaisa,
          purchaseDate,
          source: input.source,
          journalEntryId: journalEntry.id,
          createdBy: userId,
          updatedBy: userId,
        },
      });

      // Link journal entry to purchase
      await tx.journalEntry.update({
        where: { id: journalEntry.id },
        data: { referenceId: purchase.id },
      });

      // Create FIFO batch for this purchase
      await tx.rawMaterialBatch.create({
        data: {
          rawMaterialTypeId: input.rawMaterialTypeId,
          purchaseId: purchase.id,
          bagsTotal: new Prisma.Decimal(input.numberOfBags),
          bagsRemaining: new Prisma.Decimal(input.numberOfBags),
          pricePerBagPaisa: BigInt(input.ratePerBagPaisa),
          purchaseDate,
          source: input.source,
          createdBy: userId,
          updatedBy: userId,
        },
      });

      // Upsert raw material stock
      const stock = await tx.rawMaterialStock.upsert({
        where: { rawMaterialTypeId: input.rawMaterialTypeId },
        create: {
          rawMaterialTypeId: input.rawMaterialTypeId,
          currentBags: new Prisma.Decimal(input.numberOfBags),
          createdBy: userId,
          updatedBy: userId,
        },
        update: {
          currentBags: { increment: input.numberOfBags },
          updatedBy: userId,
        },
      });

      // Audit log
      await auditService.log({
        entityType: 'RawMaterialPurchase',
        entityId: purchase.id,
        action: AuditAction.CREATE,
        newValue: {
          rawMaterialTypeId: input.rawMaterialTypeId,
          numberOfBags: input.numberOfBags,
          ratePerBagPaisa: input.ratePerBagPaisa,
          totalAmountPaisa: totalAmountPaisa.toString(),
          source: input.source,
        },
        changedFields: ['rawMaterialTypeId', 'numberOfBags', 'ratePerBagPaisa', 'totalAmountPaisa', 'source'],
        userId,
      });

      // Check low stock after purchase
      await this.checkAndNotifyLowStock('raw_material', input.rawMaterialTypeId);

      return {
        id: purchase.id,
        totalAmountPaisa: Number(totalAmountPaisa),
        stockUpdate: {
          rawMaterialTypeId: input.rawMaterialTypeId,
          newStockBags: Number(stock.currentBags),
        },
      };
    });
  }

  /**
   * Consumption report: purchased vs consumed raw materials over a period.
   */
  async getConsumptionReport(params: {
    rawMaterialTypeId?: string;
    period?: string;
    dateFrom?: string;
    dateTo?: string;
  }) {
    const { rawMaterialTypeId, period = 'current_month', dateFrom, dateTo } = params;

    // Calculate date range
    const now = new Date();
    let startDate: Date;
    let endDate: Date;
    let periodLabel: string;

    switch (period) {
      case 'last_month': {
        const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        startDate = lastMonth;
        endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
        periodLabel = `${lastMonth.toLocaleString('default', { month: 'long' })} ${lastMonth.getFullYear()}`;
        break;
      }
      case 'last_3_months': {
        startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1);
        endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
        periodLabel = `Last 3 months (${toISODate(startDate)} to ${toISODate(endDate)})`;
        break;
      }
      case 'custom': {
        if (!dateFrom || !dateTo) {
          throw Object.assign(
            new Error('dateFrom and dateTo are required for custom period'),
            { statusCode: 422, code: 'VALIDATION_ERROR' }
          );
        }
        startDate = new Date(dateFrom + 'T00:00:00.000Z');
        endDate = new Date(dateTo + 'T23:59:59.999Z');
        periodLabel = `${dateFrom} to ${dateTo}`;
        break;
      }
      case 'current_month':
      default: {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = now;
        periodLabel = `${now.toLocaleString('default', { month: 'long' })} ${now.getFullYear()}`;
        break;
      }
    }

    // Fetch raw material types
    const rawMaterialTypes = await prisma.rawMaterialType.findMany({
      where: {
        isDeleted: false,
        isActive: true,
        ...(rawMaterialTypeId ? { id: rawMaterialTypeId } : {}),
      },
      include: {
        rawMaterialStock: true,
      },
    });

    const rawMaterialTypeResults = await Promise.all(
      rawMaterialTypes.map(async (gt) => {
        // Purchased bags in period
        const purchaseAgg = await prisma.rawMaterialPurchase.aggregate({
          where: {
            rawMaterialTypeId: gt.id,
            isDeleted: false,
            purchaseDate: { gte: startDate, lte: endDate },
          },
          _sum: { numberOfBags: true, totalAmountPaisa: true },
        });

        const purchasedBags = purchaseAgg._sum.numberOfBags
          ? Number(purchaseAgg._sum.numberOfBags)
          : 0;
        const totalPurchaseAmountPaisa = purchaseAgg._sum.totalAmountPaisa
          ? Number(purchaseAgg._sum.totalAmountPaisa)
          : 0;

        // Consumed bags: sum from production entries for variants of this raw material type
        const productionEntries = await prisma.productionEntry.findMany({
          where: {
            isDeleted: false,
            date: { gte: startDate, lte: endDate },
            variant: { rawMaterialTypeId: gt.id },
          },
          select: {
            metersProduced: true,
            gramsPerMeter: true,
          },
        });

        let consumedBags = 0;
        for (const entry of productionEntries) {
          const gramsConsumed = Number(entry.gramsPerMeter ?? 0) * (entry.metersProduced ?? 0);
          consumedBags += gramsConsumed / gt.bagWeightGrams;
        }

        const netChange = purchasedBags - consumedBags;
        const currentStock = gt.rawMaterialStock
          ? Number(gt.rawMaterialStock.currentBags)
          : 0;

        // Weighted average cost
        const weightedAvgCostPaisa =
          purchasedBags > 0
            ? Math.round(totalPurchaseAmountPaisa / purchasedBags)
            : 0;

        return {
          rawMaterialType: gt.name,
          purchasedBags: Math.round(purchasedBags * 10000) / 10000,
          consumedBags: Math.round(consumedBags * 10000) / 10000,
          netChange: Math.round(netChange * 10000) / 10000,
          currentStock,
          weightedAvgCostPaisa,
          weightedAvgCostDisplay: weightedAvgCostPaisa > 0
            ? formatPaisaToRupees(BigInt(weightedAvgCostPaisa))
            : 'N/A',
        };
      })
    );

    return {
      period: periodLabel,
      rawMaterialTypes: rawMaterialTypeResults,
    };
  }

  /**
   * Update the low-stock threshold for a finished goods stock item.
   */
  async updateFinishedGoodsThreshold(id: string, threshold: number, userId: string) {
    const existing = await prisma.finishedGoodsStock.findUnique({ where: { id } });

    if (!existing) {
      throw Object.assign(new Error('Finished goods stock not found'), {
        statusCode: 404,
        code: 'NOT_FOUND',
      });
    }

    const updated = await prisma.finishedGoodsStock.update({
      where: { id },
      data: {
        lowStockThreshold: threshold,
        version: { increment: 1 },
        updatedBy: userId,
      },
      include: {
        variant: { select: { id: true, code: true, name: true } },
      },
    });

    return {
      id: updated.id,
      variant: updated.variant,
      currentMeters: updated.currentMeters,
      lowStockThreshold: updated.lowStockThreshold,
      version: updated.version,
    };
  }

  /**
   * Update the low-stock threshold for a raw material (raw material type).
   */
  async updateRawMaterialThreshold(id: string, thresholdBags: number, userId: string) {
    const existing = await prisma.rawMaterialType.findUnique({ where: { id } });

    if (!existing) {
      throw Object.assign(new Error('Grain type not found'), {
        statusCode: 404,
        code: 'NOT_FOUND',
      });
    }

    const updated = await prisma.rawMaterialType.update({
      where: { id },
      data: {
        lowStockThresholdBags: new Prisma.Decimal(thresholdBags),
        updatedBy: userId,
      },
      select: {
        id: true,
        code: true,
        name: true,
        lowStockThresholdBags: true,
        version: true,
      },
    });

    return {
      id: updated.id,
      code: updated.code,
      name: updated.name,
      lowStockThresholdBags: updated.lowStockThresholdBags ? Number(updated.lowStockThresholdBags) : null,
      version: updated.version,
    };
  }

  /**
   * Check stock level and send low-stock notification if below threshold.
   */
  async checkAndNotifyLowStock(type: 'raw_material' | 'finished_goods' | 'packaging', entityId: string) {
    if (type === 'raw_material') {
      const stock = await prisma.rawMaterialStock.findUnique({
        where: { rawMaterialTypeId: entityId },
        include: { rawMaterialType: true },
      });

      if (!stock || !stock.rawMaterialType.lowStockThresholdBags) return;

      const currentBags = Number(stock.currentBags);
      const threshold = Number(stock.rawMaterialType.lowStockThresholdBags);

      if (currentBags < threshold) {
        await notificationService.notifyRole({
          recipientRole: Role.SUPER_ADMIN,
          type: NotificationType.LOW_STOCK,
          title: 'Low Raw Material Stock',
          message: `${stock.rawMaterialType.name} stock is low: ${currentBags.toFixed(2)} bags remaining (threshold: ${threshold} bags).`,
          referenceType: 'RawMaterialStock',
          referenceId: stock.id,
        });
      }
    } else if (type === 'finished_goods') {
      const stock = await prisma.finishedGoodsStock.findUnique({
        where: { variantId: entityId },
        include: { variant: true },
      });

      if (!stock || stock.lowStockThreshold == null) return;

      if (stock.currentMeters < stock.lowStockThreshold) {
        await notificationService.notifyRole({
          recipientRole: Role.SUPER_ADMIN,
          type: NotificationType.LOW_STOCK,
          title: 'Low Finished Goods Stock',
          message: `${stock.variant.name} (${stock.variant.code}) stock is low: ${stock.currentMeters} meters remaining (threshold: ${stock.lowStockThreshold} meters).`,
          referenceType: 'FinishedGoodsStock',
          referenceId: stock.id,
        });
      }
    } else {
      const material = await prisma.packagingMaterial.findUnique({
        where: { id: entityId },
      });

      if (!material || material.lowStockThreshold == null) return;

      if (material.currentStock < material.lowStockThreshold) {
        await notificationService.notifyRole({
          recipientRole: Role.SUPER_ADMIN,
          type: NotificationType.LOW_STOCK,
          title: 'Low Packaging Stock',
          message: `${material.name} stock is low: ${material.currentStock} ${material.unit} remaining (threshold: ${material.lowStockThreshold} ${material.unit}).`,
          referenceType: 'PackagingMaterial',
          referenceId: material.id,
        });
      }
    }
  }
}

export const inventoryService = new InventoryService();
