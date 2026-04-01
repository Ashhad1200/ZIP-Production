import prisma from '../config/database';
import { AuditAction, NotificationType, Prisma, Role, Shift } from '@prisma/client';
import { calculateRawMaterialConsumption, detectElectricityDiscrepancy } from '../utils/formulas';
import { formatPaisaToRupees } from '../utils/currency';
import { generateSequenceNumber } from '../utils/sequence';
import { accountingService } from './accounting.service';
import { auditService } from './audit.service';
import { notificationService } from './notification.service';
import { inventoryService } from './inventory.service';
import { toISODate } from '../utils/date';

const SHIFT_HOURS = 12;
const ELECTRICITY_DISCREPANCY_THRESHOLD_PERCENT = 15;

interface CreateProductionEntryInput {
  plantId: string;
  shift: Shift;
  date: string; // YYYY-MM-DD
  variantId: string;
  metersProduced: number;
  gramsPerMeter: number;
  electricityUnitsConsumed: number;
  electricityStartReading?: number;
  electricityEndReading?: number;
  scrapWeightGrams?: number;
  workerIds?: string[];
}

interface UpdateProductionEntryInput {
  metersProduced?: number;
  gramsPerMeter?: number;
  electricityUnitsConsumed?: number;
  electricityStartReading?: number;
  electricityEndReading?: number;
  scrapWeightGrams?: number;
  workerIds?: string[];
}

interface CreateScrapSaleInput {
  date: string;
  totalWeightKg: number;
  ratePerKgPaisa: number;
  buyerName?: string;
  plantId?: string;
}

export class ProductionService {
  /**
   * Create a production entry with atomic side effects:
   * - Raw material stock deduction
   * - Finished goods stock increase
   * - Electricity discrepancy detection
   * - Audit log creation
   */
  async createEntry(input: CreateProductionEntryInput, userId: string) {
    // Validate electricity readings
    if (
      input.electricityStartReading !== undefined &&
      input.electricityEndReading !== undefined &&
      input.electricityEndReading < input.electricityStartReading
    ) {
      throw Object.assign(
        new Error('Electricity end reading cannot be less than start reading'),
        { statusCode: 422, code: 'INVALID_ELECTRICITY' }
      );
    }

    return prisma.$transaction(async (tx) => {
      // 1. Check duplicate (plantId, shift, date)
      const entryDate = new Date(input.date + 'T00:00:00.000Z');
      const existing = await tx.productionEntry.findUnique({
        where: {
          plantId_shift_date: {
            plantId: input.plantId,
            shift: input.shift,
            date: entryDate,
          },
        },
      });

      if (existing) {
        throw Object.assign(
          new Error('Production entry for this plant, shift, and date already exists'),
          { statusCode: 409, code: 'DUPLICATE_ENTRY' }
        );
      }

      // 2. Fetch variant with grain type
      const variant = await tx.zipperVariant.findUnique({
        where: { id: input.variantId },
        include: { grainType: true },
      });

      if (!variant) {
        throw Object.assign(
          new Error('Variant not found'),
          { statusCode: 404, code: 'VARIANT_NOT_FOUND' }
        );
      }

      // 3. Calculate raw material consumption
      const { gramsConsumed, bagsConsumed } = calculateRawMaterialConsumption(
        input.gramsPerMeter,
        input.metersProduced,
        variant.grainType.bagWeightGrams
      );

      // 4. Deduct raw material stock
      const rawMaterialStock = await tx.rawMaterialStock.findUnique({
        where: { grainTypeId: variant.grainTypeId },
      });

      if (!rawMaterialStock) {
        throw Object.assign(
          new Error(`No raw material stock record found for grain type ${variant.grainType.name}`),
          { statusCode: 422, code: 'INSUFFICIENT_RAW_MATERIAL' }
        );
      }

      const currentBags = Number(rawMaterialStock.currentBags);
      if (currentBags < bagsConsumed) {
        throw Object.assign(
          new Error(`Insufficient raw material stock. Available: ${currentBags.toFixed(4)} bags, Required: ${bagsConsumed.toFixed(4)} bags`),
          { statusCode: 422, code: 'INSUFFICIENT_RAW_MATERIAL' }
        );
      }

      await tx.rawMaterialStock.update({
        where: { id: rawMaterialStock.id },
        data: {
          currentBags: new Prisma.Decimal(currentBags - bagsConsumed),
          updatedBy: userId,
        },
      });

      // 5. Increase finished goods stock
      const fgStock = await tx.finishedGoodsStock.upsert({
        where: { variantId: input.variantId },
        create: {
          variantId: input.variantId,
          currentMeters: input.metersProduced,
          createdBy: userId,
          updatedBy: userId,
        },
        update: {
          currentMeters: { increment: input.metersProduced },
          updatedBy: userId,
        },
      });

      // 6. Electricity discrepancy check
      const machines = await tx.machine.findMany({
        where: { plantId: input.plantId, isActive: true },
      });

      let hasDiscrepancy = false;
      let discrepancyNotes: string | undefined;

      if (machines.length > 0) {
        // Aggregate machine ratings for the plant
        const totalKwhRating = machines.reduce((sum, m) => sum + Number(m.kwhRating), 0);
        const totalExpectedOutput = machines.reduce((sum, m) => sum + m.expectedOutputPerShift, 0);

        const discrepancyResult = detectElectricityDiscrepancy(
          input.electricityUnitsConsumed,
          totalKwhRating,
          SHIFT_HOURS,
          input.metersProduced,
          totalExpectedOutput,
          ELECTRICITY_DISCREPANCY_THRESHOLD_PERCENT
        );

        hasDiscrepancy = discrepancyResult.isDiscrepancy;
        discrepancyNotes = discrepancyResult.notes || undefined;
      }

      // 7. Create production entry
      const entry = await tx.productionEntry.create({
        data: {
          plantId: input.plantId,
          shift: input.shift,
          date: entryDate,
          variantId: input.variantId,
          metersProduced: input.metersProduced,
          gramsPerMeter: new Prisma.Decimal(input.gramsPerMeter),
          electricityUnitsConsumed: new Prisma.Decimal(input.electricityUnitsConsumed),
          electricityStartReading: input.electricityStartReading != null
            ? new Prisma.Decimal(input.electricityStartReading)
            : undefined,
          electricityEndReading: input.electricityEndReading != null
            ? new Prisma.Decimal(input.electricityEndReading)
            : undefined,
          hasElectricityDiscrepancy: hasDiscrepancy,
          electricityDiscrepancyNotes: discrepancyNotes,
          scrapWeightGrams: input.scrapWeightGrams ?? 0,
          createdBy: userId,
          updatedBy: userId,
          ...(input.workerIds && input.workerIds.length > 0
            ? {
                workers: {
                  create: input.workerIds.map((workerId) => ({ workerId })),
                },
              }
            : {}),
        },
        include: {
          plant: { select: { id: true, name: true } },
          variant: { select: { id: true, code: true, name: true } },
          workers: { include: { worker: { select: { id: true, name: true } } } },
        },
      });

      // 8. Audit log
      await auditService.log({
        entityType: 'ProductionEntry',
        entityId: entry.id,
        action: AuditAction.CREATE,
        newValue: {
          plantId: entry.plantId,
          shift: entry.shift,
          date: toISODate(entry.date),
          variantId: entry.variantId,
          metersProduced: entry.metersProduced,
          gramsConsumed,
          bagsConsumed,
        },
        changedFields: ['plantId', 'shift', 'date', 'variantId', 'metersProduced'],
        userId,
      });

      // 9. Notify on discrepancy
      if (hasDiscrepancy) {
        await notificationService.notifyRole({
          recipientRole: Role.SUPER_ADMIN,
          type: NotificationType.ELECTRICITY_DISCREPANCY,
          title: 'Electricity Discrepancy Detected',
          message: discrepancyNotes || 'Electricity consumption deviation exceeds threshold.',
          referenceType: 'ProductionEntry',
          referenceId: entry.id,
        });
      }

      // 10. Check low stock after consumption/production
      await inventoryService.checkAndNotifyLowStock('raw_material', variant.grainTypeId);
      await inventoryService.checkAndNotifyLowStock('finished_goods', input.variantId);

      return {
        id: entry.id,
        plant: entry.plant,
        shift: entry.shift,
        date: toISODate(entry.date),
        variant: entry.variant,
        metersProduced: entry.metersProduced,
        hasElectricityDiscrepancy: hasDiscrepancy,
        rawMaterialConsumed: { gramsConsumed, bagsConsumed },
        stockUpdate: { variantId: input.variantId, newStockMeters: fgStock.currentMeters },
        version: entry.version,
      };
    });
  }

  /**
   * Get a single production entry by ID.
   */
  async getEntryById(id: string) {
    const entry = await prisma.productionEntry.findFirst({
      where: { id, isDeleted: false },
      include: {
        plant: { select: { id: true, name: true } },
        variant: {
          select: {
            id: true,
            code: true,
            name: true,
            grainType: { select: { id: true, name: true, bagWeightGrams: true } },
          },
        },
        workers: { include: { worker: { select: { id: true, name: true } } } },
      },
    });

    if (!entry) {
      throw Object.assign(new Error('Production entry not found'), { statusCode: 404, code: 'NOT_FOUND' });
    }

    const { gramsConsumed, bagsConsumed } = calculateRawMaterialConsumption(
      Number(entry.gramsPerMeter),
      entry.metersProduced,
      entry.variant.grainType.bagWeightGrams
    );

    return {
      id: entry.id,
      plant: entry.plant,
      shift: entry.shift,
      date: toISODate(entry.date),
      variant: { id: entry.variant.id, code: entry.variant.code, name: entry.variant.name },
      metersProduced: entry.metersProduced,
      gramsPerMeter: Number(entry.gramsPerMeter),
      electricityUnitsConsumed: Number(entry.electricityUnitsConsumed),
      electricityStartReading: entry.electricityStartReading ? Number(entry.electricityStartReading) : null,
      electricityEndReading: entry.electricityEndReading ? Number(entry.electricityEndReading) : null,
      hasElectricityDiscrepancy: entry.hasElectricityDiscrepancy,
      electricityDiscrepancyNotes: entry.electricityDiscrepancyNotes,
      scrapWeightGrams: entry.scrapWeightGrams,
      workers: entry.workers.map((w) => w.worker),
      rawMaterialConsumed: {
        grainType: entry.variant.grainType.name,
        gramsConsumed,
        bagsConsumed,
      },
      createdBy: entry.createdBy,
      createdAt: entry.createdAt.toISOString(),
      updatedAt: entry.updatedAt.toISOString(),
      version: entry.version,
    };
  }

  /**
   * List production entries with filters and pagination.
   */
  async listEntries(params: {
    page: number;
    limit: number;
    plantId?: string;
    shift?: Shift;
    dateFrom?: string;
    dateTo?: string;
    variantId?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }) {
    const { page, limit, plantId, shift, dateFrom, dateTo, variantId, sortBy = 'date', sortOrder = 'desc' } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.ProductionEntryWhereInput = {
      isDeleted: false,
      ...(plantId ? { plantId } : {}),
      ...(shift ? { shift } : {}),
      ...(variantId ? { variantId } : {}),
      ...(dateFrom || dateTo
        ? {
            date: {
              ...(dateFrom ? { gte: new Date(dateFrom + 'T00:00:00.000Z') } : {}),
              ...(dateTo ? { lte: new Date(dateTo + 'T00:00:00.000Z') } : {}),
            },
          }
        : {}),
    };

    const [entries, total] = await Promise.all([
      prisma.productionEntry.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          plant: { select: { id: true, name: true } },
          variant: {
            select: {
              id: true,
              code: true,
              name: true,
              grainType: { select: { name: true, bagWeightGrams: true } },
            },
          },
          workers: { include: { worker: { select: { id: true, name: true } } } },
        },
      }),
      prisma.productionEntry.count({ where }),
    ]);

    const data = entries.map((entry) => {
      const { gramsConsumed, bagsConsumed } = calculateRawMaterialConsumption(
        Number(entry.gramsPerMeter),
        entry.metersProduced,
        entry.variant.grainType.bagWeightGrams
      );

      return {
        id: entry.id,
        plant: entry.plant,
        shift: entry.shift,
        date: toISODate(entry.date),
        variant: { id: entry.variant.id, code: entry.variant.code, name: entry.variant.name },
        metersProduced: entry.metersProduced,
        gramsPerMeter: Number(entry.gramsPerMeter),
        electricityUnitsConsumed: Number(entry.electricityUnitsConsumed),
        hasElectricityDiscrepancy: entry.hasElectricityDiscrepancy,
        scrapWeightGrams: entry.scrapWeightGrams,
        workers: entry.workers.map((w) => w.worker),
        rawMaterialConsumed: {
          grainType: entry.variant.grainType.name,
          gramsConsumed,
          bagsConsumed,
        },
        createdBy: entry.createdBy,
        createdAt: entry.createdAt.toISOString(),
        version: entry.version,
      };
    });

    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * Edit a production entry (Super Admin only).
   * Uses version/ETag for optimistic concurrency.
   */
  async updateEntry(id: string, input: UpdateProductionEntryInput, expectedVersion: number, userId: string) {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.productionEntry.findFirst({
        where: { id, isDeleted: false },
        include: {
          variant: { include: { grainType: true } },
          workers: true,
        },
      });

      if (!existing) {
        throw Object.assign(new Error('Production entry not found'), { statusCode: 404, code: 'NOT_FOUND' });
      }

      if (existing.version !== expectedVersion) {
        throw Object.assign(
          new Error('Production entry has been modified by another user. Please refresh and try again.'),
          { statusCode: 409, code: 'VERSION_CONFLICT' }
        );
      }

      const previousValue = {
        metersProduced: existing.metersProduced,
        gramsPerMeter: Number(existing.gramsPerMeter),
        electricityUnitsConsumed: Number(existing.electricityUnitsConsumed),
        scrapWeightGrams: existing.scrapWeightGrams,
      };

      // Recalculate stock adjustments if meters or gramsPerMeter changed
      const newMeters = input.metersProduced ?? existing.metersProduced;
      const newGramsPerMeter = input.gramsPerMeter ?? Number(existing.gramsPerMeter);
      const oldGramsPerMeter = Number(existing.gramsPerMeter);

      const oldConsumption = calculateRawMaterialConsumption(
        oldGramsPerMeter,
        existing.metersProduced,
        existing.variant.grainType.bagWeightGrams
      );
      const newConsumption = calculateRawMaterialConsumption(
        newGramsPerMeter,
        newMeters,
        existing.variant.grainType.bagWeightGrams
      );

      const bagsDiff = newConsumption.bagsConsumed - oldConsumption.bagsConsumed;
      const metersDiff = newMeters - existing.metersProduced;

      // Adjust raw material stock
      if (Math.abs(bagsDiff) > 0.0001) {
        const rawMaterialStock = await tx.rawMaterialStock.findUnique({
          where: { grainTypeId: existing.variant.grainTypeId },
        });

        if (rawMaterialStock) {
          const newBags = Number(rawMaterialStock.currentBags) - bagsDiff;
          if (newBags < 0) {
            throw Object.assign(
              new Error('Insufficient raw material stock for this update'),
              { statusCode: 422, code: 'INSUFFICIENT_RAW_MATERIAL' }
            );
          }
          await tx.rawMaterialStock.update({
            where: { id: rawMaterialStock.id },
            data: { currentBags: new Prisma.Decimal(newBags), updatedBy: userId },
          });
        }
      }

      // Adjust finished goods stock
      if (metersDiff !== 0) {
        await tx.finishedGoodsStock.update({
          where: { variantId: existing.variantId },
          data: { currentMeters: { increment: metersDiff }, updatedBy: userId },
        });
      }

      // Re-check electricity discrepancy
      let hasDiscrepancy = existing.hasElectricityDiscrepancy;
      let discrepancyNotes = existing.electricityDiscrepancyNotes;
      const newElectricity = input.electricityUnitsConsumed ?? Number(existing.electricityUnitsConsumed);

      const machines = await tx.machine.findMany({
        where: { plantId: existing.plantId, isActive: true },
      });

      if (machines.length > 0) {
        const totalKwhRating = machines.reduce((sum, m) => sum + Number(m.kwhRating), 0);
        const totalExpectedOutput = machines.reduce((sum, m) => sum + m.expectedOutputPerShift, 0);

        const result = detectElectricityDiscrepancy(
          newElectricity,
          totalKwhRating,
          SHIFT_HOURS,
          newMeters,
          totalExpectedOutput,
          ELECTRICITY_DISCREPANCY_THRESHOLD_PERCENT
        );

        hasDiscrepancy = result.isDiscrepancy;
        discrepancyNotes = result.notes || null;
      }

      // Update workers if provided
      if (input.workerIds) {
        await tx.productionEntryWorker.deleteMany({ where: { productionEntryId: id } });
        if (input.workerIds.length > 0) {
          await tx.productionEntryWorker.createMany({
            data: input.workerIds.map((workerId) => ({ productionEntryId: id, workerId })),
          });
        }
      }

      // Update entry
      const updated = await tx.productionEntry.update({
        where: { id },
        data: {
          ...(input.metersProduced != null ? { metersProduced: input.metersProduced } : {}),
          ...(input.gramsPerMeter != null ? { gramsPerMeter: new Prisma.Decimal(input.gramsPerMeter) } : {}),
          ...(input.electricityUnitsConsumed != null
            ? { electricityUnitsConsumed: new Prisma.Decimal(input.electricityUnitsConsumed) }
            : {}),
          ...(input.electricityStartReading !== undefined
            ? { electricityStartReading: input.electricityStartReading != null ? new Prisma.Decimal(input.electricityStartReading) : null }
            : {}),
          ...(input.electricityEndReading !== undefined
            ? { electricityEndReading: input.electricityEndReading != null ? new Prisma.Decimal(input.electricityEndReading) : null }
            : {}),
          ...(input.scrapWeightGrams != null ? { scrapWeightGrams: input.scrapWeightGrams } : {}),
          hasElectricityDiscrepancy: hasDiscrepancy,
          electricityDiscrepancyNotes: discrepancyNotes,
          updatedBy: userId,
          version: { increment: 1 },
        },
        include: {
          plant: { select: { id: true, name: true } },
          variant: { select: { id: true, code: true, name: true } },
          workers: { include: { worker: { select: { id: true, name: true } } } },
        },
      });

      // Audit
      const changedFields = Object.keys(input).filter((k) => input[k as keyof UpdateProductionEntryInput] !== undefined);
      await auditService.log({
        entityType: 'ProductionEntry',
        entityId: id,
        action: AuditAction.UPDATE,
        previousValue,
        newValue: {
          metersProduced: updated.metersProduced,
          gramsPerMeter: Number(updated.gramsPerMeter),
          electricityUnitsConsumed: Number(updated.electricityUnitsConsumed),
          scrapWeightGrams: updated.scrapWeightGrams,
        },
        changedFields,
        userId,
      });

      return {
        id: updated.id,
        plant: updated.plant,
        shift: updated.shift,
        date: toISODate(updated.date),
        variant: updated.variant,
        metersProduced: updated.metersProduced,
        hasElectricityDiscrepancy: updated.hasElectricityDiscrepancy,
        workers: updated.workers.map((w) => w.worker),
        version: updated.version,
      };
    });
  }

  /**
   * Daily Progress Report: group by plant, then by shift.
   */
  async getDPR(params: { date?: string; plantId?: string }) {
    const reportDate = params.date || toISODate(new Date());
    const dateFilter = new Date(reportDate + 'T00:00:00.000Z');

    const where: Prisma.ProductionEntryWhereInput = {
      isDeleted: false,
      date: dateFilter,
      ...(params.plantId ? { plantId: params.plantId } : {}),
    };

    const entries = await prisma.productionEntry.findMany({
      where,
      include: {
        plant: { select: { id: true, name: true } },
        variant: { select: { id: true, code: true, name: true } },
        workers: { include: { worker: { select: { id: true, name: true } } } },
      },
      orderBy: [{ plantId: 'asc' }, { shift: 'asc' }],
    });

    // Group by plant
    const plantMap = new Map<string, {
      plant: { id: string; name: string };
      entries: typeof entries;
    }>();

    for (const entry of entries) {
      const key = entry.plantId;
      if (!plantMap.has(key)) {
        plantMap.set(key, { plant: entry.plant, entries: [] });
      }
      plantMap.get(key)!.entries.push(entry);
    }

    let grandTotalMeters = 0;

    const plants = Array.from(plantMap.values()).map(({ plant, entries: plantEntries }) => {
      const buildShiftData = (shift: Shift) => {
        const shiftEntries = plantEntries.filter((e) => e.shift === shift);
        if (shiftEntries.length === 0) return null;

        const metersProduced = shiftEntries.reduce((sum, e) => sum + e.metersProduced, 0);
        const variants = shiftEntries.map((e) => ({
          code: e.variant.code,
          name: e.variant.name,
          meters: e.metersProduced,
        }));
        const electricityUnits = shiftEntries.reduce((sum, e) => sum + Number(e.electricityUnitsConsumed), 0);
        const scrapGrams = shiftEntries.reduce((sum, e) => sum + e.scrapWeightGrams, 0);
        const workersSet = new Set<string>();
        for (const e of shiftEntries) {
          for (const w of e.workers) {
            workersSet.add(w.worker.name);
          }
        }
        const hasDiscrepancy = shiftEntries.some((e) => e.hasElectricityDiscrepancy);

        return {
          metersProduced,
          variants,
          electricityUnits: Math.round(electricityUnits * 100) / 100,
          scrapGrams,
          workers: Array.from(workersSet),
          hasDiscrepancy,
        };
      };

      const dayShift = buildShiftData(Shift.DAY);
      const nightShift = buildShiftData(Shift.NIGHT);
      const totalMeters = (dayShift?.metersProduced ?? 0) + (nightShift?.metersProduced ?? 0);
      grandTotalMeters += totalMeters;

      return { plant, dayShift, nightShift, totalMeters };
    });

    return {
      date: reportDate,
      plants,
      grandTotalMeters,
    };
  }

  /**
   * Record a scrap sale with journal entry (Debit Cash → Credit Scrap Revenue).
   */
  async createScrapSale(input: CreateScrapSaleInput, userId: string) {
    return prisma.$transaction(async (tx) => {
      const totalAmountPaisa = BigInt(Math.round(input.totalWeightKg * input.ratePerKgPaisa));
      const saleDate = new Date(input.date + 'T00:00:00.000Z');

      // Generate journal entry number
      const entryNumber = await generateSequenceNumber('JE', 'voucher');

      // Get accounts for journal entry
      const cashAccount = await accountingService.getAccountByCode('CASH', tx);
      const scrapRevenueAccount = await accountingService.getAccountByCode('SCRAP-REVENUE', tx);

      // Create journal entry
      const journalEntry = await accountingService.createJournalEntry(
        {
          entryNumber,
          entryDate: saleDate,
          description: `Scrap sale - ${input.totalWeightKg}kg @ ${formatPaisaToRupees(BigInt(input.ratePerKgPaisa))}/kg`,
          referenceType: 'ScrapSale',
          lines: [
            {
              accountId: cashAccount.id,
              description: 'Cash received from scrap sale',
              debitAmountPaisa: totalAmountPaisa,
              creditAmountPaisa: 0n,
              lineOrder: 0,
            },
            {
              accountId: scrapRevenueAccount.id,
              description: 'Scrap sale revenue',
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

      // Create scrap sale record
      const scrapSale = await tx.scrapSale.create({
        data: {
          date: saleDate,
          totalWeightKg: new Prisma.Decimal(input.totalWeightKg),
          ratePerKgPaisa: BigInt(input.ratePerKgPaisa),
          totalAmountPaisa,
          buyerName: input.buyerName,
          plantId: input.plantId,
          journalEntryId: journalEntry.id,
          createdBy: userId,
          updatedBy: userId,
        },
        include: {
          plant: { select: { id: true, name: true } },
        },
      });

      // Update journal entry referenceId
      await tx.journalEntry.update({
        where: { id: journalEntry.id },
        data: { referenceId: scrapSale.id },
      });

      // Audit log
      await auditService.log({
        entityType: 'ScrapSale',
        entityId: scrapSale.id,
        action: AuditAction.CREATE,
        newValue: {
          totalWeightKg: input.totalWeightKg,
          ratePerKgPaisa: input.ratePerKgPaisa,
          totalAmountPaisa: totalAmountPaisa.toString(),
        },
        changedFields: ['totalWeightKg', 'ratePerKgPaisa', 'totalAmountPaisa'],
        userId,
      });

      return {
        id: scrapSale.id,
        date: toISODate(scrapSale.date),
        totalWeightKg: Number(scrapSale.totalWeightKg),
        ratePerKgPaisa: Number(scrapSale.ratePerKgPaisa),
        totalAmountPaisa: Number(scrapSale.totalAmountPaisa),
        totalAmountDisplay: formatPaisaToRupees(totalAmountPaisa),
        buyerName: scrapSale.buyerName,
        plant: scrapSale.plant,
        journalEntryId: journalEntry.id,
        version: scrapSale.version,
      };
    });
  }

  /**
   * List scrap sales with pagination.
   */
  async listScrapSales(params: { page: number; limit: number; plantId?: string; dateFrom?: string; dateTo?: string }) {
    const { page, limit, plantId, dateFrom, dateTo } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.ScrapSaleWhereInput = {
      isDeleted: false,
      ...(plantId ? { plantId } : {}),
      ...(dateFrom || dateTo
        ? {
            date: {
              ...(dateFrom ? { gte: new Date(dateFrom + 'T00:00:00.000Z') } : {}),
              ...(dateTo ? { lte: new Date(dateTo + 'T00:00:00.000Z') } : {}),
            },
          }
        : {}),
    };

    const [sales, total] = await Promise.all([
      prisma.scrapSale.findMany({
        where,
        skip,
        take: limit,
        orderBy: { date: 'desc' },
        include: {
          plant: { select: { id: true, name: true } },
        },
      }),
      prisma.scrapSale.count({ where }),
    ]);

    const data = sales.map((sale) => ({
      id: sale.id,
      date: toISODate(sale.date),
      totalWeightKg: Number(sale.totalWeightKg),
      ratePerKgPaisa: Number(sale.ratePerKgPaisa),
      totalAmountPaisa: Number(sale.totalAmountPaisa),
      totalAmountDisplay: formatPaisaToRupees(sale.totalAmountPaisa),
      buyerName: sale.buyerName,
      plant: sale.plant,
      version: sale.version,
    }));

    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  /**
   * List electricity discrepancy alerts (Super Admin only).
   */
  async listDiscrepancies(params: { page: number; limit: number; plantId?: string; dateFrom?: string; dateTo?: string }) {
    const { page, limit, plantId, dateFrom, dateTo } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.ProductionEntryWhereInput = {
      isDeleted: false,
      hasElectricityDiscrepancy: true,
      ...(plantId ? { plantId } : {}),
      ...(dateFrom || dateTo
        ? {
            date: {
              ...(dateFrom ? { gte: new Date(dateFrom + 'T00:00:00.000Z') } : {}),
              ...(dateTo ? { lte: new Date(dateTo + 'T00:00:00.000Z') } : {}),
            },
          }
        : {}),
    };

    const [entries, total] = await Promise.all([
      prisma.productionEntry.findMany({
        where,
        skip,
        take: limit,
        orderBy: { date: 'desc' },
        include: {
          plant: { select: { id: true, name: true } },
          variant: { select: { id: true, code: true, name: true } },
        },
      }),
      prisma.productionEntry.count({ where }),
    ]);

    const data = entries.map((entry) => ({
      id: entry.id,
      plant: entry.plant,
      shift: entry.shift,
      date: toISODate(entry.date),
      variant: entry.variant,
      metersProduced: entry.metersProduced,
      electricityUnitsConsumed: Number(entry.electricityUnitsConsumed),
      hasElectricityDiscrepancy: entry.hasElectricityDiscrepancy,
      electricityDiscrepancyNotes: entry.electricityDiscrepancyNotes,
    }));

    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  /**
   * Lookup: list active plants.
   */
  async getPlants() {
    return prisma.plant.findMany({
      where: { isDeleted: false },
      select: { id: true, name: true, location: true },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Lookup: list active workers, optionally filtered by plant.
   */
  async getWorkers(plantId?: string) {
    return prisma.worker.findMany({
      where: {
        isActive: true,
        isDeleted: false,
        ...(plantId ? { plantId } : {}),
      },
      select: { id: true, name: true, designation: true, plantId: true },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Lookup: list active zipper variants.
   */
  async getVariants() {
    return prisma.zipperVariant.findMany({
      where: { isActive: true, isDeleted: false },
      select: { id: true, code: true, name: true, standardGramsPerMeter: true },
      orderBy: { code: 'asc' },
    });
  }
}

export const productionService = new ProductionService();
