/**
 * Cost Price Calculator Service
 *
 * Computes per-shift cost breakdown and cost-per-meter for production entries:
 *   total_cost = electricity_cost + raw_material_cost + labor_cost
 *   cost_per_meter = total_cost / meters_produced
 *   gross_margin_per_meter = avg_selling_rate - cost_per_meter
 */

import prisma from '../config/database';
import { formatPaisaToRupees } from '../utils/currency';
import { toISODate } from '../utils/date';
import { inventoryService } from './inventory.service';

export interface ShiftCostBreakdown {
  productionEntryId: string;
  date: string;
  plant: string;
  shift: string;
  variant: string;
  metersProduced: number;

  electricityCostPaisa: bigint;
  electricityUnitsConsumed: number;
  electricityRatePaisaPerUnit: bigint;
  electricityCostDisplay: string;

  rawMaterialCostPaisa: bigint;
  bagsConsumed: number;
  weightedAvgBagPricePaisa: number;
  rawMaterialCostDisplay: string;

  laborCostPaisa: bigint;
  workerCount: number;
  laborCostDisplay: string;

  totalCostPaisa: bigint;
  totalCostDisplay: string;

  costPerMeterPaisa: number;
  costPerMeterDisplay: string;
}

export class CostPriceService {
  /**
   * Calculate cost breakdown for a single production entry.
   */
  async calculateForEntry(productionEntryId: string): Promise<ShiftCostBreakdown | null> {
    const entry = await prisma.productionEntry.findFirst({
      where: { id: productionEntryId, isDeleted: false },
      include: {
        plant: { select: { id: true, name: true } },
        shiftVariants: {
          include: {
            variant: {
              select: {
                id: true,
                code: true,
                name: true,
                grainTypeId: true,
                grainType: { select: { bagWeightGrams: true } },
              },
            },
          },
        },
        workers: {
          include: {
            worker: { select: { id: true, name: true, shiftCostPaisa: true } },
          },
        },
        batchConsumptions: {
          include: { batch: true },
        },
      },
    });

    if (!entry || !entry.metersProduced) return null;

    // Safe cast: batchConsumptions is from Prisma include, type may be inferred as never in strict mode
    type BatchConsumption = { totalCostPaisa: bigint; bagsConsumed: { toNumber: () => number } | number | string };
    const batchConsumptions = (entry.batchConsumptions as unknown as BatchConsumption[]) ?? [];

    const entryDate = entry.date;

    // ─── Electricity cost ─────────────────────────────────────────────────
    const electricityUnits = entry.electricityUnitsConsumed
      ? Number(entry.electricityUnitsConsumed)
      : 0;

    const electricityRate = await inventoryService.getElectricityRateOnDate(entryDate);
    const electricityRatePaisaPerUnit = electricityRate ?? 0n;
    const electricityCostPaisa =
      electricityRatePaisaPerUnit > 0n
        ? BigInt(Math.round(electricityUnits)) * electricityRatePaisaPerUnit
        : 0n;

    // ─── Raw material cost (from FIFO batch consumption records) ─────────
    let rawMaterialCostPaisa = 0n;
    let totalBagsConsumed = 0;

    if (batchConsumptions.length > 0) {
      for (const bc of batchConsumptions) {
        rawMaterialCostPaisa += bc.totalCostPaisa;
        const bags = typeof bc.bagsConsumed === 'number' ? bc.bagsConsumed : Number(bc.bagsConsumed);
        totalBagsConsumed += bags;
      }
    } else {
      // Fallback: estimate from grams/meter × meters across all shift variants / bag weight × avg purchase price
      const primarySV = entry.shiftVariants[0];
      if (primarySV) {
        // Use ingredients' first grain or fallback to legacy grainType
        const primaryIngredient = (primarySV.variant as { ingredients?: { grainType: { bagWeightGrams: number }; grainTypeId: string }[] }).ingredients?.[0];
        const bagWeightGrams = primaryIngredient?.grainType?.bagWeightGrams ?? primarySV.variant.grainType?.bagWeightGrams ?? 25000;
        const primaryGrainTypeId = primaryIngredient?.grainTypeId ?? primarySV.variant.grainTypeId;

        // Sum (gramsPerMeter × meters) across all shift variants
        for (const sv of entry.shiftVariants) {
          const gpm = sv.gramsPerMeter ? Number(sv.gramsPerMeter) : 0;
          totalBagsConsumed += (gpm * sv.metersProduced) / bagWeightGrams;
        }

        // Use most recent batch price for primary grain type as fallback
        const latestPurchase = primaryGrainTypeId ? await prisma.rawMaterialBatch.findFirst({
          where: { grainTypeId: primaryGrainTypeId },
          orderBy: { purchaseDate: 'desc' },
        }) : null;
        if (latestPurchase && totalBagsConsumed > 0) {
          rawMaterialCostPaisa = BigInt(
            Math.round(totalBagsConsumed * Number(latestPurchase.pricePerBagPaisa))
          );
        }
      }
    }

    const weightedAvgBagPricePaisa =
      totalBagsConsumed > 0
        ? Number(rawMaterialCostPaisa) / totalBagsConsumed
        : 0;

    // ─── Labor cost (sum of worker shift costs) ───────────────────────────
    let laborCostPaisa = 0n;
    for (const pw of entry.workers) {
      if (pw.worker.shiftCostPaisa) {
        laborCostPaisa += pw.worker.shiftCostPaisa;
      }
    }

    // ─── Total & per-meter ────────────────────────────────────────────────
    const totalCostPaisa = electricityCostPaisa + rawMaterialCostPaisa + laborCostPaisa;
    const costPerMeterPaisa =
      entry.metersProduced > 0 ? Number(totalCostPaisa) / entry.metersProduced : 0;

    return {
      productionEntryId: entry.id,
      date: toISODate(entry.date),
      plant: entry.plant.name,
      shift: entry.shift,
      variant: entry.shiftVariants.map(sv => `${sv.variant.code} - ${sv.variant.name}`).join(', ') || '—',
      metersProduced: entry.metersProduced,

      electricityCostPaisa,
      electricityUnitsConsumed: electricityUnits,
      electricityRatePaisaPerUnit: electricityRatePaisaPerUnit,
      electricityCostDisplay: formatPaisaToRupees(electricityCostPaisa),

      rawMaterialCostPaisa,
      bagsConsumed: totalBagsConsumed,
      weightedAvgBagPricePaisa,
      rawMaterialCostDisplay: formatPaisaToRupees(rawMaterialCostPaisa),

      laborCostPaisa,
      workerCount: entry.workers.length,
      laborCostDisplay: formatPaisaToRupees(laborCostPaisa),

      totalCostPaisa,
      totalCostDisplay: formatPaisaToRupees(totalCostPaisa),

      costPerMeterPaisa,
      costPerMeterDisplay: formatPaisaToRupees(BigInt(Math.round(costPerMeterPaisa))),
    };
  }

  /**
   * Get cost breakdowns for all completed production entries in a date range.
   */
  async listForPeriod(params: {
    dateFrom?: string;
    dateTo?: string;
    plantId?: string;
    variantId?: string;
    page?: number;
    limit?: number;
  }) {
    const { dateFrom, dateTo, plantId, variantId, page = 1, limit = 30 } = params;
    const skip = (page - 1) * limit;

    const [entries, total] = await Promise.all([
      prisma.productionEntry.findMany({
        where: {
          isDeleted: false,
          status: 'COMPLETED',
          metersProduced: { not: null },
          ...(plantId ? { plantId } : {}),
          ...(variantId ? { variantId } : {}),
          ...(dateFrom || dateTo
            ? {
                date: {
                  ...(dateFrom ? { gte: new Date(dateFrom + 'T00:00:00.000Z') } : {}),
                  ...(dateTo ? { lte: new Date(dateTo + 'T00:00:00.000Z') } : {}),
                },
              }
            : {}),
        },
        select: { id: true },
        skip,
        take: limit,
        orderBy: [{ date: 'desc' }, { shift: 'asc' }],
      }),
      prisma.productionEntry.count({
        where: {
          isDeleted: false,
          status: 'COMPLETED',
          metersProduced: { not: null },
          ...(plantId ? { plantId } : {}),
          ...(variantId ? { variantId } : {}),
        },
      }),
    ]);

    const breakdowns = await Promise.all(
      entries.map((e) => this.calculateForEntry(e.id))
    );

    const validBreakdowns = breakdowns.filter(Boolean) as ShiftCostBreakdown[];

    // Summary totals
    const totalMeters = validBreakdowns.reduce((s, b) => s + b.metersProduced, 0);
    const totalCost = validBreakdowns.reduce((s, b) => s + b.totalCostPaisa, 0n);
    const avgCostPerMeter = totalMeters > 0 ? Number(totalCost) / totalMeters : 0;

    return {
      data: validBreakdowns,
      summary: {
        totalMeters,
        totalCostPaisa: totalCost,
        totalCostDisplay: formatPaisaToRupees(totalCost),
        avgCostPerMeterPaisa: avgCostPerMeter,
        avgCostPerMeterDisplay: formatPaisaToRupees(BigInt(Math.round(avgCostPerMeter))),
      },
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }
}

export const costPriceService = new CostPriceService();
