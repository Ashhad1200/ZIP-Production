import prisma from '../config/database';
import { AuditAction, NotificationType, Prisma, ProductionStatus, Role, Shift, WorkerRole } from '@prisma/client';
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

interface WorkerAssignment {
  workerId: string;
  role?: WorkerRole;
}

interface CreateProductionEntryInput {
  plantId: string;
  machineId?: string;
  shift: Shift;
  date: string; // YYYY-MM-DD
  /** Single variant (legacy / convenience for single-variant shifts) */
  variantId?: string;
  /** Multi-variant: provide one or more variants to produce in this shift */
  variants?: { variantId: string }[];
  electricityStartReading?: number;
  workers?: WorkerAssignment[];
  /** @deprecated use workers instead */
  workerIds?: string[];
}

interface CompleteVariantInput {
  variantId: string;
  metersProduced: number;
  gramsPerMeter: number;
  scrapWeightGrams?: number;
}

interface CompleteProductionEntryInput {
  /** Multi-variant completion: one entry per variant */
  variants?: CompleteVariantInput[];
  /** Legacy flat fields — used when entry has exactly one shift variant */
  metersProduced?: number;
  gramsPerMeter?: number;
  scrapWeightGrams?: number;
  electricityEndReading?: number;
}

interface UpdateProductionEntryInput {
  metersProduced?: number;
  gramsPerMeter?: number;
  electricityUnitsConsumed?: number;
  electricityStartReading?: number;
  electricityEndReading?: number;
  scrapWeightGrams?: number;
  workers?: WorkerAssignment[];
  /** @deprecated use workers instead */
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
   * Step 1 of production flow: Start a production entry (IN_PRODUCTION status).
   * Records: plant, shift, date, variant, workers, electricity start reading.
   * Does NOT update stock — that happens on completion.
   */
  async createEntry(input: CreateProductionEntryInput, userId: string) {
    return prisma.$transaction(async (tx) => {
      const entryDate = new Date(input.date + 'T00:00:00.000Z');

      // Normalize variants array — supports both single variantId and variants[]
      const variantInputs: { variantId: string }[] = input.variants?.length
        ? input.variants
        : input.variantId
        ? [{ variantId: input.variantId }]
        : [];

      if (variantInputs.length === 0) {
        throw Object.assign(new Error('At least one variant must be specified'), { statusCode: 400, code: 'VARIANT_REQUIRED' });
      }

      // Verify all variants exist
      for (const v of variantInputs) {
        const variant = await tx.zipperVariant.findUnique({ where: { id: v.variantId } });
        if (!variant) {
          throw Object.assign(new Error(`Variant not found: ${v.variantId}`), { statusCode: 404, code: 'VARIANT_NOT_FOUND' });
        }
      }

      // Create entry in IN_PRODUCTION status — no stock changes yet
      const rawAssignments: WorkerAssignment[] = input.workers ?? (input.workerIds ?? []).map((id) => ({ workerId: id }));
      // Deduplicate by workerId to prevent unique constraint violation
      const seen = new Set<string>();
      const workerAssignments = rawAssignments.filter((a) => {
        if (seen.has(a.workerId)) return false;
        seen.add(a.workerId);
        return true;
      });
      const entry = await tx.productionEntry.create({
        data: {
          plantId: input.plantId,
          machineId: input.machineId,
          shift: input.shift,
          date: entryDate,
          // variantId left null — all variant info stored in shiftVariants
          status: ProductionStatus.IN_PRODUCTION,
          electricityStartReading: input.electricityStartReading != null
            ? new Prisma.Decimal(input.electricityStartReading)
            : undefined,
          createdBy: userId,
          updatedBy: userId,
          ...(workerAssignments.length > 0
            ? { workers: { create: workerAssignments.map(({ workerId, role }) => ({ workerId, role: role ?? null })) } }
            : {}),
        },
        include: {
          plant: { select: { id: true, name: true } },
          machine: { select: { id: true, identifier: true } },
          workers: { include: { worker: { select: { id: true, name: true } } } },
        },
      });

      // Create a ProductionShiftVariant record for each variant (metrics filled at completion)
      for (const v of variantInputs) {
        await tx.productionShiftVariant.create({
          data: {
            entryId: entry.id,
            variantId: v.variantId,
            metersProduced: 0,
            scrapWeightGrams: 0,
          },
        });
      }

      const shiftVariants = await tx.productionShiftVariant.findMany({
        where: { entryId: entry.id },
        include: { variant: { select: { id: true, code: true, name: true, standardGramsPerMeter: true } } },
      });

      await auditService.log({
        entityType: 'ProductionEntry',
        entityId: entry.id,
        action: AuditAction.CREATE,
        newValue: { plantId: entry.plantId, shift: entry.shift, date: toISODate(entry.date), variantIds: variantInputs.map(v => v.variantId), status: 'IN_PRODUCTION' },
        changedFields: ['plantId', 'shift', 'date', 'variantIds', 'status'],
        userId,
      });

      return {
        id: entry.id,
        plant: entry.plant,
        machine: entry.machine,
        shift: entry.shift,
        date: toISODate(entry.date),
        shiftVariants: shiftVariants.map((sv) => ({
          id: sv.id,
          variantId: sv.variantId,
          variant: { ...sv.variant, standardGramsPerMeter: Number(sv.variant.standardGramsPerMeter) },
          metersProduced: sv.metersProduced,
          gramsPerMeter: sv.gramsPerMeter != null ? Number(sv.gramsPerMeter) : null,
          scrapWeightGrams: sv.scrapWeightGrams,
        })),
        status: entry.status,
        workers: entry.workers.map((w) => ({ ...w.worker, role: w.role })),
        electricityStartReading: entry.electricityStartReading ? Number(entry.electricityStartReading) : null,
        version: entry.version,
      };
    });
  }

  /**
   * Step 2 of production flow: Complete a production entry.
   * Records: meters produced, grams/meter, electricity end reading, scrap.
   * Sets status = COMPLETED and runs full stock update atomically.
   */
  async completeEntry(id: string, input: CompleteProductionEntryInput, userId: string) {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.productionEntry.findFirst({
        where: { id, isDeleted: false },
        include: {
          plant: { select: { id: true, name: true } },
          shiftVariants: {
            include: {
              variant: {
                include: {
                  grainType: true,
                  packagingMaterial: true,
                  ingredients: { include: { grainType: true } },
                },
              },
            },
          },
        },
      });

      if (!existing) {
        throw Object.assign(new Error('Production entry not found'), { statusCode: 404, code: 'NOT_FOUND' });
      }

      if (existing.status !== ProductionStatus.IN_PRODUCTION) {
        throw Object.assign(
          new Error('Only IN_PRODUCTION entries can be completed'),
          { statusCode: 409, code: 'ALREADY_COMPLETED' }
        );
      }

      // Normalize variant inputs — support both multi-variant and legacy flat fields
      let variantCompletions: CompleteVariantInput[];
      if (input.variants && input.variants.length > 0) {
        variantCompletions = input.variants;
      } else if (input.metersProduced != null && input.gramsPerMeter != null && existing.shiftVariants.length === 1) {
        // Legacy single-variant flat input
        variantCompletions = [{
          variantId: existing.shiftVariants[0].variantId,
          metersProduced: input.metersProduced,
          gramsPerMeter: input.gramsPerMeter,
          scrapWeightGrams: input.scrapWeightGrams,
        }];
      } else {
        throw Object.assign(
          new Error('Variant completion data required. Provide variants[] or flat metersProduced/gramsPerMeter for single-variant entries.'),
          { statusCode: 400, code: 'COMPLETION_DATA_REQUIRED' }
        );
      }

      // Calculate electricity units consumed
      const startReading = existing.electricityStartReading ? Number(existing.electricityStartReading) : undefined;
      let electricityUnitsConsumed = 0;
      if (startReading != null && input.electricityEndReading != null) {
        if (input.electricityEndReading < startReading) {
          throw Object.assign(
            new Error('Electricity end reading cannot be less than start reading'),
            { statusCode: 422, code: 'INVALID_ELECTRICITY' }
          );
        }
        electricityUnitsConsumed = input.electricityEndReading - startReading;
      }

      let totalMetersProduced = 0;
      const stockUpdates: { variantId: string; newStockMeters: number }[] = [];
      const rawMaterialConsumed: { grainType: string; gramsConsumed: number; bagsConsumed: number }[] = [];

      // Process each variant: raw material deduction + FG stock + FIFO
      for (const vc of variantCompletions) {
        const shiftVariant = existing.shiftVariants.find((sv) => sv.variantId === vc.variantId);
        if (!shiftVariant) {
          throw Object.assign(
            new Error(`Variant ${vc.variantId} is not registered for this shift. Add it at shift start.`),
            { statusCode: 422, code: 'VARIANT_NOT_IN_SHIFT' }
          );
        }

        const variant = shiftVariant.variant;

        // Calculate raw material consumption for this variant
        const { gramsConsumed, bagsConsumed: totalBagsConsumed } = calculateRawMaterialConsumption(
          vc.gramsPerMeter,
          vc.metersProduced,
          // Use primary grain's bagWeightGrams for total calc (or first ingredient's if no primary)
          (variant.grainType ?? variant.ingredients[0]?.grainType)?.bagWeightGrams ?? 25000
        );

        // Resolve the list of ingredients (handles both legacy single-grain and new multi-seed)
        type IngredientEntry = { grainTypeId: string; grainType: { name: string; bagWeightGrams: number }; ratioPercent: number };
        let ingredientList: IngredientEntry[];
        if (variant.ingredients && variant.ingredients.length > 0) {
          ingredientList = variant.ingredients.map((ing) => ({
            grainTypeId: ing.grainTypeId,
            grainType: ing.grainType,
            ratioPercent: Number(ing.ratioPercent),
          }));
        } else if (variant.grainTypeId && variant.grainType) {
          // Legacy: single grain at 100%
          ingredientList = [{ grainTypeId: variant.grainTypeId, grainType: variant.grainType, ratioPercent: 100 }];
        } else {
          throw Object.assign(
            new Error(`Variant ${variant.code} has no grain ingredients configured`),
            { statusCode: 422, code: 'NO_INGREDIENTS' }
          );
        }

        // Deduct raw material stock per ingredient proportionally
        for (const ing of ingredientList) {
          const ratio = ing.ratioPercent / 100;
          const ingGramsConsumed = gramsConsumed * ratio;
          const ingBagsConsumed = ingGramsConsumed / ing.grainType.bagWeightGrams;

          // Deduct raw material stock
          const rawMaterialStock = await tx.rawMaterialStock.findUnique({
            where: { grainTypeId: ing.grainTypeId },
          });

          if (!rawMaterialStock) {
            throw Object.assign(
              new Error(`No raw material stock for grain type ${ing.grainType.name}`),
              { statusCode: 422, code: 'INSUFFICIENT_RAW_MATERIAL' }
            );
          }

          const currentBags = Number(rawMaterialStock.currentBags);
          if (currentBags < ingBagsConsumed) {
            throw Object.assign(
              new Error(`Insufficient stock for ${ing.grainType.name}. Available: ${currentBags.toFixed(4)} bags, Required: ${ingBagsConsumed.toFixed(4)} bags`),
              { statusCode: 422, code: 'INSUFFICIENT_RAW_MATERIAL' }
            );
          }

          await tx.rawMaterialStock.update({
            where: { id: rawMaterialStock.id },
            data: { currentBags: new Prisma.Decimal(currentBags - ingBagsConsumed), updatedBy: userId },
          });

          // FIFO batch deduction for this ingredient's grain type
          try {
            const fifoResult = await inventoryService.deductFifoBatches(
              ing.grainTypeId,
              ingBagsConsumed,
              userId,
              tx
            );
            if (fifoResult && fifoResult.breakdown.length > 0) {
              for (const b of fifoResult.breakdown) {
                await tx.productionBatchConsumption.create({
                  data: {
                    productionEntryId: id,
                    batchId: b.batchId,
                    bagsConsumed: new Prisma.Decimal(b.bagsConsumed),
                    totalCostPaisa: b.costPaisa,
                  },
                });
              }
            }
          } catch {
            // FIFO deduction is best-effort; skip if no batches exist
          }

          rawMaterialConsumed.push({ grainType: ing.grainType.name, gramsConsumed: ingGramsConsumed, bagsConsumed: ingBagsConsumed });
          await inventoryService.checkAndNotifyLowStock('raw_material', ing.grainTypeId);
        }

        // Update finished goods stock for this variant
        const fgStock = await tx.finishedGoodsStock.upsert({
          where: { variantId: vc.variantId },
          create: { variantId: vc.variantId, currentMeters: vc.metersProduced, createdBy: userId, updatedBy: userId },
          update: { currentMeters: { increment: vc.metersProduced }, updatedBy: userId },
        });

        if (variant.packagingMaterialId && variant.metersPerCarton && variant.metersPerCarton > 0 && vc.metersProduced > 0) {
          const packagingUnitsUsed = Math.ceil(vc.metersProduced / variant.metersPerCarton);
          const packagingMaterial = await tx.packagingMaterial.findUnique({
            where: { id: variant.packagingMaterialId },
          });

          if (!packagingMaterial) {
            throw Object.assign(
              new Error(`Packaging material is not configured correctly for variant ${variant.code}`),
              { statusCode: 422, code: 'PACKAGING_NOT_CONFIGURED' }
            );
          }

          if (packagingMaterial.currentStock < packagingUnitsUsed) {
            throw Object.assign(
              new Error(`Insufficient packaging stock for ${packagingMaterial.name}. Available: ${packagingMaterial.currentStock} ${packagingMaterial.unit}, Required: ${packagingUnitsUsed} ${packagingMaterial.unit}`),
              { statusCode: 422, code: 'INSUFFICIENT_PACKAGING' }
            );
          }

          const unitRatePaisa = packagingMaterial.ratePerUnitPaisa;
          await tx.packagingStockAdjustment.create({
            data: {
              materialId: packagingMaterial.id,
              quantity: -packagingUnitsUsed,
              type: 'PRODUCTION_CONSUMPTION',
              unitRatePaisa,
              totalCostPaisa: unitRatePaisa * BigInt(packagingUnitsUsed),
              referenceType: 'ProductionEntry',
              referenceId: id,
              notes: `Auto deduction for ${variant.code} production (${vc.metersProduced} meters)`,
              createdBy: userId,
            },
          });

          await tx.packagingMaterial.update({
            where: { id: packagingMaterial.id },
            data: { currentStock: { decrement: packagingUnitsUsed } },
          });

          await inventoryService.checkAndNotifyLowStock('packaging', packagingMaterial.id);
        }

        // Update the ProductionShiftVariant record with actuals
        await tx.productionShiftVariant.update({
          where: { entryId_variantId: { entryId: id, variantId: vc.variantId } },
          data: {
            metersProduced: vc.metersProduced,
            gramsPerMeter: new Prisma.Decimal(vc.gramsPerMeter),
            scrapWeightGrams: vc.scrapWeightGrams ?? 0,
          },
        });

        totalMetersProduced += vc.metersProduced;
        stockUpdates.push({ variantId: vc.variantId, newStockMeters: fgStock.currentMeters });
        await inventoryService.checkAndNotifyLowStock('finished_goods', vc.variantId);
      }

      // Electricity discrepancy check (aggregate meters)
      const machines = await tx.machine.findMany({
        where: { plantId: existing.plantId, isActive: true },
      });

      let hasDiscrepancy = false;
      let discrepancyNotes: string | undefined;

      if (machines.length > 0 && electricityUnitsConsumed > 0) {
        const totalKwhRating = machines.reduce((sum, m) => sum + Number(m.kwhRating), 0);
        const totalExpectedOutput = machines.reduce((sum, m) => sum + m.expectedOutputPerShift, 0);

        const discrepancyResult = detectElectricityDiscrepancy(
          electricityUnitsConsumed,
          totalKwhRating,
          SHIFT_HOURS,
          totalMetersProduced,
          totalExpectedOutput,
          ELECTRICITY_DISCREPANCY_THRESHOLD_PERCENT
        );

        hasDiscrepancy = discrepancyResult.isDiscrepancy;
        discrepancyNotes = discrepancyResult.notes || undefined;
      }

      // Update entry to COMPLETED with aggregate totals
      const entry = await tx.productionEntry.update({
        where: { id },
        data: {
          status: ProductionStatus.COMPLETED,
          metersProduced: totalMetersProduced,
          electricityUnitsConsumed: new Prisma.Decimal(electricityUnitsConsumed),
          electricityEndReading: input.electricityEndReading != null
            ? new Prisma.Decimal(input.electricityEndReading)
            : undefined,
          hasElectricityDiscrepancy: hasDiscrepancy,
          electricityDiscrepancyNotes: discrepancyNotes,
          updatedBy: userId,
          version: { increment: 1 },
        },
        include: {
          plant: { select: { id: true, name: true } },
          shiftVariants: {
            include: { variant: { select: { id: true, code: true, name: true } } },
          },
        },
      });

      // Audit log
      await auditService.log({
        entityType: 'ProductionEntry',
        entityId: entry.id,
        action: AuditAction.UPDATE,
        newValue: { totalMetersProduced, variantCount: variantCompletions.length, status: 'COMPLETED' },
        changedFields: ['metersProduced', 'electricityUnitsConsumed', 'status'],
        userId,
      });

      // Notify on discrepancy
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

      return {
        id: entry.id,
        plant: entry.plant,
        shift: entry.shift,
        date: toISODate(entry.date),
        shiftVariants: entry.shiftVariants.map((sv) => ({
          id: sv.id,
          variantId: sv.variantId,
          variant: sv.variant,
          metersProduced: sv.metersProduced,
          gramsPerMeter: sv.gramsPerMeter != null ? Number(sv.gramsPerMeter) : null,
          scrapWeightGrams: sv.scrapWeightGrams,
        })),
        status: entry.status,
        metersProduced: entry.metersProduced,
        hasElectricityDiscrepancy: hasDiscrepancy,
        rawMaterialConsumed,
        stockUpdates,
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
        machine: { select: { id: true, identifier: true } },
        shiftVariants: {
          include: {
            variant: {
              select: {
                id: true,
                code: true,
                name: true,
                standardGramsPerMeter: true,
                grainType: { select: { id: true, name: true, bagWeightGrams: true } },
                ingredients: {
                  select: {
                    ratioPercent: true,
                    grainType: { select: { id: true, name: true, bagWeightGrams: true } },
                  },
                  orderBy: { ratioPercent: 'desc' },
                },
              },
            },
          },
        },
        workers: { include: { worker: { select: { id: true, name: true } } } },
      },
    });

    if (!entry) {
      throw Object.assign(new Error('Production entry not found'), { statusCode: 404, code: 'NOT_FOUND' });
    }

    return {
      id: entry.id,
      plant: entry.plant,
      machine: entry.machine,
      shift: entry.shift,
      date: toISODate(entry.date),
      status: entry.status,
      shiftVariants: entry.shiftVariants.map((sv) => ({
        id: sv.id,
        variantId: sv.variantId,
        variant: {
          id: sv.variant.id,
          code: sv.variant.code,
          name: sv.variant.name,
          standardGramsPerMeter: Number(sv.variant.standardGramsPerMeter),
          grainType: sv.variant.grainType,
          ingredients: sv.variant.ingredients.map((i) => ({
            grainTypeName: i.grainType.name,
            ratioPercent: Number(i.ratioPercent),
          })),
        },
        metersProduced: sv.metersProduced,
        gramsPerMeter: sv.gramsPerMeter != null ? Number(sv.gramsPerMeter) : null,
        scrapWeightGrams: sv.scrapWeightGrams,
      })),
      metersProduced: entry.metersProduced,
      electricityUnitsConsumed: entry.electricityUnitsConsumed != null ? Number(entry.electricityUnitsConsumed) : null,
      electricityStartReading: entry.electricityStartReading ? Number(entry.electricityStartReading) : null,
      electricityEndReading: entry.electricityEndReading ? Number(entry.electricityEndReading) : null,
      hasElectricityDiscrepancy: entry.hasElectricityDiscrepancy,
      electricityDiscrepancyNotes: entry.electricityDiscrepancyNotes,
      workers: entry.workers.map((w) => ({ ...w.worker, role: w.role })),
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
      // Filter by variantId via shiftVariants
      ...(variantId ? { shiftVariants: { some: { variantId } } } : {}),
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
          machine: { select: { id: true, identifier: true } },
          shiftVariants: {
            include: {
              variant: {
                select: {
                  id: true, code: true, name: true,
                  ingredients: {
                    select: { ratioPercent: true, grainType: { select: { name: true } } },
                    orderBy: { ratioPercent: 'desc' },
                  },
                },
              },
            },
          },
          workers: { include: { worker: { select: { id: true, name: true } } } },
        },
      }),
      prisma.productionEntry.count({ where }),
    ]);

    const data = entries.map((entry) => ({
      id: entry.id,
      plant: entry.plant,
      machine: entry.machine,
      shift: entry.shift,
      date: toISODate(entry.date),
      status: entry.status,
      shiftVariants: entry.shiftVariants.map((sv) => ({
        id: sv.id,
        variantId: sv.variantId,
        variant: {
          id: sv.variant.id,
          code: sv.variant.code,
          name: sv.variant.name,
          ingredients: sv.variant.ingredients.map((i) => ({
            grainTypeName: i.grainType.name,
            ratioPercent: Number(i.ratioPercent),
          })),
        },
        metersProduced: sv.metersProduced,
        gramsPerMeter: sv.gramsPerMeter != null ? Number(sv.gramsPerMeter) : null,
        scrapWeightGrams: sv.scrapWeightGrams,
      })),
      metersProduced: entry.metersProduced,
      electricityUnitsConsumed: entry.electricityUnitsConsumed != null ? Number(entry.electricityUnitsConsumed) : null,
      hasElectricityDiscrepancy: entry.hasElectricityDiscrepancy,
      workers: entry.workers.map((w) => ({ ...w.worker, role: w.role })),
      createdBy: entry.createdBy,
      createdAt: entry.createdAt.toISOString(),
      version: entry.version,
    }));

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
          shiftVariants: {
            include: {
              variant: {
                include: {
                  grainType: true,
                  ingredients: { include: { grainType: true } },
                },
              },
            },
          },
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
        electricityUnitsConsumed: Number(existing.electricityUnitsConsumed),
      };

      // For single-variant completed entries, adjust stocks if meters/grams changed
      const newMeters = input.metersProduced ?? existing.metersProduced ?? 0;
      const oldMeters = existing.metersProduced ?? 0;
      let metersDiff = 0;
      let bagsDiff = 0;

      if (existing.status === ProductionStatus.COMPLETED && existing.shiftVariants.length === 1) {
        const sv = existing.shiftVariants[0];
        const oldGramsPerMeter = sv.gramsPerMeter != null ? Number(sv.gramsPerMeter) : 0;
        const newGramsPerMeter = input.gramsPerMeter ?? oldGramsPerMeter;

        const primaryGrain = sv.variant.ingredients[0]?.grainType ?? sv.variant.grainType;
        if (!primaryGrain) throw Object.assign(new Error('Variant has no grain configured'), { statusCode: 422 });

        const oldConsumption = calculateRawMaterialConsumption(oldGramsPerMeter, oldMeters, primaryGrain.bagWeightGrams);
        const newConsumption = calculateRawMaterialConsumption(newGramsPerMeter, newMeters, primaryGrain.bagWeightGrams);

        bagsDiff = newConsumption.bagsConsumed - oldConsumption.bagsConsumed;
        metersDiff = newMeters - oldMeters;

        if (Math.abs(bagsDiff) > 0.0001) {
          // Adjust all ingredient stocks proportionally
          const ingredientList = sv.variant.ingredients.length > 0
            ? sv.variant.ingredients.map((ing) => ({ grainTypeId: ing.grainTypeId, ratioPercent: Number(ing.ratioPercent) }))
            : [{ grainTypeId: sv.variant.grainTypeId!, ratioPercent: 100 }];

          for (const ing of ingredientList) {
            const ingBagsDiff = bagsDiff * (ing.ratioPercent / 100);
            const rawMaterialStock = await tx.rawMaterialStock.findUnique({ where: { grainTypeId: ing.grainTypeId } });
            if (rawMaterialStock) {
              const newBags = Number(rawMaterialStock.currentBags) - ingBagsDiff;
              if (newBags < 0) {
                throw Object.assign(new Error('Insufficient raw material stock for this update'), { statusCode: 422, code: 'INSUFFICIENT_RAW_MATERIAL' });
              }
              await tx.rawMaterialStock.update({
                where: { id: rawMaterialStock.id },
                data: { currentBags: new Prisma.Decimal(newBags), updatedBy: userId },
              });
            }
          }
        }

        if (metersDiff !== 0) {
          await tx.finishedGoodsStock.update({
            where: { variantId: sv.variantId },
            data: { currentMeters: { increment: metersDiff }, updatedBy: userId },
          });
        }

        // Update single ShiftVariant with new meters/grams/scrap
        if (input.metersProduced != null || input.gramsPerMeter != null || input.scrapWeightGrams != null) {
          await tx.productionShiftVariant.update({
            where: { entryId_variantId: { entryId: id, variantId: sv.variantId } },
            data: {
              ...(input.metersProduced != null ? { metersProduced: input.metersProduced } : {}),
              ...(input.gramsPerMeter != null ? { gramsPerMeter: new Prisma.Decimal(input.gramsPerMeter) } : {}),
              ...(input.scrapWeightGrams != null ? { scrapWeightGrams: input.scrapWeightGrams } : {}),
            },
          });
        }
      }

      // Re-check electricity discrepancy
      let hasDiscrepancy = existing.hasElectricityDiscrepancy;
      let discrepancyNotes = existing.electricityDiscrepancyNotes;
      const newElectricity = input.electricityUnitsConsumed ?? (existing.electricityUnitsConsumed != null ? Number(existing.electricityUnitsConsumed) : 0);
      const effectiveMeters = input.metersProduced ?? existing.metersProduced ?? 0;

      const machines = await tx.machine.findMany({ where: { plantId: existing.plantId, isActive: true } });

      if (machines.length > 0 && newElectricity > 0 && effectiveMeters > 0) {
        const totalKwhRating = machines.reduce((sum, m) => sum + Number(m.kwhRating), 0);
        const totalExpectedOutput = machines.reduce((sum, m) => sum + m.expectedOutputPerShift, 0);

        const result = detectElectricityDiscrepancy(
          newElectricity,
          totalKwhRating,
          SHIFT_HOURS,
          effectiveMeters,
          totalExpectedOutput,
          ELECTRICITY_DISCREPANCY_THRESHOLD_PERCENT
        );

        hasDiscrepancy = result.isDiscrepancy;
        discrepancyNotes = result.notes || null;
      }

      // Update workers if provided
      const workerAssignments: WorkerAssignment[] | null = input.workers ?? (input.workerIds ? input.workerIds.map((id) => ({ workerId: id })) : null);
      if (workerAssignments) {
        await tx.productionEntryWorker.deleteMany({ where: { productionEntryId: id } });
        if (workerAssignments.length > 0) {
          await tx.productionEntryWorker.createMany({
            data: workerAssignments.map(({ workerId, role }) => ({ productionEntryId: id, workerId, role: role ?? null })),
          });
        }
      }

      // Update entry
      const updated = await tx.productionEntry.update({
        where: { id },
        data: {
          ...(input.metersProduced != null ? { metersProduced: input.metersProduced } : {}),
          ...(input.electricityUnitsConsumed != null
            ? { electricityUnitsConsumed: new Prisma.Decimal(input.electricityUnitsConsumed) }
            : {}),
          ...(input.electricityStartReading !== undefined
            ? { electricityStartReading: input.electricityStartReading != null ? new Prisma.Decimal(input.electricityStartReading) : null }
            : {}),
          ...(input.electricityEndReading !== undefined
            ? { electricityEndReading: input.electricityEndReading != null ? new Prisma.Decimal(input.electricityEndReading) : null }
            : {}),
          hasElectricityDiscrepancy: hasDiscrepancy,
          electricityDiscrepancyNotes: discrepancyNotes,
          updatedBy: userId,
          version: { increment: 1 },
        },
        include: {
          plant: { select: { id: true, name: true } },
          machine: { select: { id: true, identifier: true } },
          shiftVariants: { include: { variant: { select: { id: true, code: true, name: true } } } },
          workers: { include: { worker: { select: { id: true, name: true } } } },
        },
      });

      const changedFields = Object.keys(input).filter((k) => input[k as keyof UpdateProductionEntryInput] !== undefined);
      await auditService.log({
        entityType: 'ProductionEntry',
        entityId: id,
        action: AuditAction.UPDATE,
        previousValue,
        newValue: {
          metersProduced: updated.metersProduced,
          electricityUnitsConsumed: Number(updated.electricityUnitsConsumed),
        },
        changedFields,
        userId,
      });

      return {
        id: updated.id,
        plant: updated.plant,
        machine: updated.machine,
        shift: updated.shift,
        date: toISODate(updated.date),
        shiftVariants: updated.shiftVariants.map((sv) => ({
          id: sv.id,
          variantId: sv.variantId,
          variant: sv.variant,
          metersProduced: sv.metersProduced,
          gramsPerMeter: sv.gramsPerMeter != null ? Number(sv.gramsPerMeter) : null,
          scrapWeightGrams: sv.scrapWeightGrams,
        })),
        metersProduced: updated.metersProduced,
        hasElectricityDiscrepancy: updated.hasElectricityDiscrepancy,
        workers: updated.workers.map((w) => ({ ...w.worker, role: w.role })),
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
        shiftVariants: { include: { variant: { select: { id: true, code: true, name: true } } } },
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

        const metersProduced = shiftEntries.reduce((sum, e) => sum + (e.metersProduced ?? 0), 0);
        // Build variants from shiftVariants (multi-variant aware)
        const variants = shiftEntries.flatMap((e) =>
          e.shiftVariants.map((sv) => ({
            code: sv.variant.code,
            name: sv.variant.name,
            meters: sv.metersProduced,
          }))
        );
        const electricityUnits = shiftEntries.reduce((sum, e) => sum + (e.electricityUnitsConsumed != null ? Number(e.electricityUnitsConsumed) : 0), 0);
        const scrapGrams = shiftEntries.reduce((sum, e) => sum + (e.scrapWeightGrams ?? 0), 0);
        const workersMap = new Map<string, { name: string; role: string | null }>();
        for (const e of shiftEntries) {
          for (const w of e.workers) {
            if (!workersMap.has(w.worker.id)) {
              workersMap.set(w.worker.id, { name: w.worker.name, role: w.role });
            }
          }
        }
        const hasDiscrepancy = shiftEntries.some((e) => e.hasElectricityDiscrepancy);

        return {
          metersProduced,
          variants,
          electricityUnits: Math.round(electricityUnits * 100) / 100,
          scrapGrams,
          workers: Array.from(workersMap.values()),
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
      const entryNumber = await generateSequenceNumber('JE', 'journalEntry');

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
   * Monthly summary of scrap sales, grouped by month.
   */
  async getScrapMonthlySummary() {
    const sales = await prisma.scrapSale.findMany({
      where: { isDeleted: false },
      select: { date: true, totalWeightKg: true, totalAmountPaisa: true },
      orderBy: { date: 'asc' },
    });

    const monthMap = new Map<string, { totalWeightKg: number; totalPaisa: number; count: number }>();

    for (const sale of sales) {
      const d = new Date(sale.date);
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
      const existing = monthMap.get(key) ?? { totalWeightKg: 0, totalPaisa: 0, count: 0 };
      existing.totalWeightKg += Number(sale.totalWeightKg);
      existing.totalPaisa += Number(sale.totalAmountPaisa);
      existing.count += 1;
      monthMap.set(key, existing);
    }

    return Array.from(monthMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({ month, ...data }));
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
          shiftVariants: { include: { variant: { select: { id: true, code: true, name: true } } } },
        },
      }),
      prisma.productionEntry.count({ where }),
    ]);

    const data = entries.map((entry) => ({
      id: entry.id,
      plant: entry.plant,
      shift: entry.shift,
      date: toISODate(entry.date),
      variant: entry.shiftVariants.map(sv => sv.variant),
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
      select: {
        id: true,
        name: true,
        location: true,
        machines: {
          where: { isActive: true },
          select: { id: true, identifier: true, kwhRating: true, expectedOutputPerShift: true },
          orderBy: { identifier: 'asc' },
        },
      },
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

  async unlockEntry(id: string, userId: string) {
    const existing = await prisma.productionEntry.findFirst({ where: { id, isDeleted: false } });
    if (!existing) {
      throw Object.assign(new Error('Production entry not found'), { statusCode: 404, code: 'NOT_FOUND' });
    }
    if (existing.status !== ProductionStatus.COMPLETED) {
      throw Object.assign(new Error('Only COMPLETED entries can be unlocked'), { statusCode: 409, code: 'INVALID_STATUS' });
    }
    const updated = await prisma.productionEntry.update({
      where: { id },
      data: { status: ProductionStatus.IN_PRODUCTION, updatedBy: userId },
    });
    await auditService.log({
      userId,
      action: AuditAction.UPDATE,
      entityType: 'ProductionEntry',
      entityId: id,
      newValue: { action: 'UNLOCK', previousStatus: 'COMPLETED', newStatus: 'IN_PRODUCTION' },
    });
    return updated;
  }
}

export const productionService = new ProductionService();
