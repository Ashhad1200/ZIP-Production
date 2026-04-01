import prisma from '../config/database';
import { AuditAction, NotificationType, Prisma, PurchaseSource, Role } from '@prisma/client';
import { formatPaisaToRupees } from '../utils/currency';
import { accountingService } from './accounting.service';
import { auditService } from './audit.service';
import { notificationService } from './notification.service';
import { toISODate } from '../utils/date';

export class InventoryService {
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
        variant: { select: { id: true, code: true, name: true } },
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
   * List raw material stock for all grain types.
   */
  async getRawMaterials() {
    const items = await prisma.rawMaterialStock.findMany({
      include: {
        grainType: { select: { id: true, code: true, name: true, lowStockThresholdBags: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return items.map((item) => {
      const currentBags = Number(item.currentBags);
      const thresholdBags = item.grainType.lowStockThresholdBags
        ? Number(item.grainType.lowStockThresholdBags)
        : null;
      const isBelowThreshold = thresholdBags != null && currentBags < thresholdBags;

      return {
        id: item.id,
        grainType: { id: item.grainType.id, code: item.grainType.code, name: item.grainType.name },
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
    grainTypeId?: string;
    source?: PurchaseSource;
    dateFrom?: string;
    dateTo?: string;
  }) {
    const { page, limit, grainTypeId, source, dateFrom, dateTo } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.RawMaterialPurchaseWhereInput = {
      isDeleted: false,
      ...(grainTypeId ? { grainTypeId } : {}),
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
          grainType: { select: { id: true, code: true, name: true } },
        },
      }),
      prisma.rawMaterialPurchase.count({ where }),
    ]);

    const data = purchases.map((p) => ({
      id: p.id,
      grainType: p.grainType,
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
      grainTypeId: string;
      numberOfBags: number;
      ratePerBagPaisa: number;
      purchaseDate: string;
      source: PurchaseSource;
    },
    userId: string
  ) {
    return prisma.$transaction(async (tx) => {
      // Validate grain type
      const grainType = await tx.grainType.findUnique({
        where: { id: input.grainTypeId },
      });

      if (!grainType) {
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
          description: `Raw material purchase - ${grainType.name}: ${input.numberOfBags} bags @ ${formatPaisaToRupees(BigInt(input.ratePerBagPaisa))}/bag`,
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
          grainTypeId: input.grainTypeId,
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

      // Upsert raw material stock
      const stock = await tx.rawMaterialStock.upsert({
        where: { grainTypeId: input.grainTypeId },
        create: {
          grainTypeId: input.grainTypeId,
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
          grainTypeId: input.grainTypeId,
          numberOfBags: input.numberOfBags,
          ratePerBagPaisa: input.ratePerBagPaisa,
          totalAmountPaisa: totalAmountPaisa.toString(),
          source: input.source,
        },
        changedFields: ['grainTypeId', 'numberOfBags', 'ratePerBagPaisa', 'totalAmountPaisa', 'source'],
        userId,
      });

      // Check low stock after purchase
      await this.checkAndNotifyLowStock('raw_material', input.grainTypeId);

      return {
        id: purchase.id,
        totalAmountPaisa: Number(totalAmountPaisa),
        stockUpdate: {
          grainTypeId: input.grainTypeId,
          newStockBags: Number(stock.currentBags),
        },
      };
    });
  }

  /**
   * Consumption report: purchased vs consumed raw materials over a period.
   */
  async getConsumptionReport(params: {
    grainTypeId?: string;
    period?: string;
    dateFrom?: string;
    dateTo?: string;
  }) {
    const { grainTypeId, period = 'current_month', dateFrom, dateTo } = params;

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

    // Fetch grain types
    const grainTypes = await prisma.grainType.findMany({
      where: {
        isDeleted: false,
        isActive: true,
        ...(grainTypeId ? { id: grainTypeId } : {}),
      },
      include: {
        rawMaterialStock: true,
      },
    });

    const grainTypeResults = await Promise.all(
      grainTypes.map(async (gt) => {
        // Purchased bags in period
        const purchaseAgg = await prisma.rawMaterialPurchase.aggregate({
          where: {
            grainTypeId: gt.id,
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

        // Consumed bags: sum from production entries for variants of this grain type
        const productionEntries = await prisma.productionEntry.findMany({
          where: {
            isDeleted: false,
            date: { gte: startDate, lte: endDate },
            variant: { grainTypeId: gt.id },
          },
          select: {
            metersProduced: true,
            gramsPerMeter: true,
          },
        });

        let consumedBags = 0;
        for (const entry of productionEntries) {
          const gramsConsumed = Number(entry.gramsPerMeter) * entry.metersProduced;
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
          grainType: gt.name,
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
      grainTypes: grainTypeResults,
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
   * Update the low-stock threshold for a raw material (grain type).
   */
  async updateRawMaterialThreshold(id: string, thresholdBags: number, userId: string) {
    const existing = await prisma.grainType.findUnique({ where: { id } });

    if (!existing) {
      throw Object.assign(new Error('Grain type not found'), {
        statusCode: 404,
        code: 'NOT_FOUND',
      });
    }

    const updated = await prisma.grainType.update({
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
  async checkAndNotifyLowStock(type: 'raw_material' | 'finished_goods', entityId: string) {
    if (type === 'raw_material') {
      const stock = await prisma.rawMaterialStock.findUnique({
        where: { grainTypeId: entityId },
        include: { grainType: true },
      });

      if (!stock || !stock.grainType.lowStockThresholdBags) return;

      const currentBags = Number(stock.currentBags);
      const threshold = Number(stock.grainType.lowStockThresholdBags);

      if (currentBags < threshold) {
        await notificationService.notifyRole({
          recipientRole: Role.SUPER_ADMIN,
          type: NotificationType.LOW_STOCK,
          title: 'Low Raw Material Stock',
          message: `${stock.grainType.name} stock is low: ${currentBags.toFixed(2)} bags remaining (threshold: ${threshold} bags).`,
          referenceType: 'RawMaterialStock',
          referenceId: stock.id,
        });
      }
    } else {
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
    }
  }
}

export const inventoryService = new InventoryService();
