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
import { monthlyOverheadService } from './monthly-overhead.service';

export interface IngredientCostBreakdown {
  grainTypeName: string;
  grainTypeCode: string;
  standardRatioPercent: number; // what the recipe says
  actualBagsConsumed: number;
  actualCostPaisa: number;
  actualCostDisplay: string;
}

export interface RecipeInfo {
  ingredients: { grainTypeName: string; grainTypeCode: string; ratioPercent: number }[];
}

export interface ShiftCostBreakdown {
  productionEntryId: string;
  date: string;
  plant: string;
  shift: string;
  variant: string;
  metersProduced: number;

  // Recipe / formula for this variant
  recipe: RecipeInfo | null;

  // Per-ingredient cost breakdown
  ingredientCosts: IngredientCostBreakdown[];

  electricityCostPaisa: bigint;
  electricityUnitsConsumed: number;
  electricityRatePaisaPerUnit: number;
  electricityCostDisplay: string;

  rawMaterialCostPaisa: bigint;
  bagsConsumed: number;
  weightedAvgBagPricePaisa: number;
  rawMaterialCostDisplay: string;

  packagingCostPaisa: bigint;
  packagingUnitsConsumed: number;
  weightedAvgPackagingRatePaisa: number;
  packagingCostDisplay: string;

  laborCostPaisa: bigint;
  workerCount: number;
  laborCostDisplay: string;

  // Monthly overhead allocation (distributed per meter)
  overheadLaborPaisa: bigint;
  overheadRentPaisa: bigint;
  overheadTransportationPaisa: bigint;
  overheadPackingPaisa: bigint;
  overheadMiscellaneousPaisa: bigint;
  overheadTotalPaisa: bigint;
  overheadPerMeterPaisa: number;
  overheadLaborDisplay: string;
  overheadRentDisplay: string;
  overheadTransportationDisplay: string;
  overheadPackingDisplay: string;
  overheadMiscellaneousDisplay: string;
  overheadTotalDisplay: string;
  overheadPerMeterDisplay: string;
  monthlyTotalMeters: number; // total meters produced in the same month (for overhead allocation)

  // Scrap credit (reduces total cost)
  scrapWeightGrams: number;
  scrapRatePerKgPaisa: bigint;
  scrapCreditPaisa: bigint;
  scrapCreditDisplay: string;

  // Total before and after scrap credit
  totalCostBeforeScrapPaisa: bigint;
  totalCostBeforeScrapDisplay: string;
  totalCostPaisa: bigint;
  totalCostDisplay: string;

  costPerMeterPaisa: number;
  costPerMeterDisplay: string;

  // Percentage breakdown (each component as % of total cost before scrap)
  rawMaterialPct: number;
  electricityPct: number;
  laborPct: number;
  packagingPct: number;
  overheadPct: number;
  scrapCreditPct: number;
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
                packagingMaterialId: true,
                standardGramsPerMeter: true,
                grainType: { select: { id: true, code: true, name: true, bagWeightGrams: true } },
                ingredients: {
                  include: { grainType: { select: { id: true, code: true, name: true, bagWeightGrams: true } } },
                },
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
          include: { batch: { include: { grainType: { select: { id: true, code: true, name: true } } } } },
        },
      },
    });

    if (!entry || !entry.metersProduced) return null;

    // Safe cast: batchConsumptions is from Prisma include, type may be inferred as never in strict mode
    type BatchConsumption = {
      totalCostPaisa: bigint;
      bagsConsumed: { toNumber: () => number } | number | string;
      batch: { grainTypeId: string; grainType: { id: string; code: string; name: string } };
    };
    const batchConsumptions = (entry.batchConsumptions as unknown as BatchConsumption[]) ?? [];

    const entryDate = entry.date;

    // ─── Build recipe info from variant ingredients ───────────────────────
    const primarySV = entry.shiftVariants[0];
    type VariantWithIngredients = typeof primarySV extends undefined ? never : typeof primarySV & {
      variant: typeof primarySV.variant & {
        ingredients?: { grainTypeId: string; ratioPercent: number | { toNumber?: () => number }; grainType: { id: string; code: string; name: string; bagWeightGrams: number } }[];
      };
    };
    const variantData = primarySV as unknown as VariantWithIngredients | undefined;
    const variantIngredients = (variantData?.variant as { ingredients?: { grainTypeId: string; ratioPercent: number | { toNumber?: () => number }; grainType: { id: string; code: string; name: string; bagWeightGrams: number } }[] })?.ingredients ?? [];

    const recipe: RecipeInfo | null = variantIngredients.length > 0
      ? {
          ingredients: variantIngredients.map((i) => ({
            grainTypeName: i.grainType.name,
            grainTypeCode: i.grainType.code,
            ratioPercent: typeof i.ratioPercent === 'number' ? i.ratioPercent : Number(i.ratioPercent),
          })),
        }
      : primarySV?.variant.grainType
        ? { ingredients: [{ grainTypeName: primarySV.variant.grainType.name, grainTypeCode: primarySV.variant.grainType.code, ratioPercent: 100 }] }
        : null;

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

    // Per-ingredient cost tracking (group batch consumptions by grain type)
    const ingredientCostMap = new Map<string, { name: string; code: string; bags: number; costPaisa: bigint }>();

    if (batchConsumptions.length > 0) {
      for (const bc of batchConsumptions) {
        rawMaterialCostPaisa += bc.totalCostPaisa;
        const bags = typeof bc.bagsConsumed === 'number' ? bc.bagsConsumed : Number(bc.bagsConsumed);
        totalBagsConsumed += bags;

        // Group by grain type for per-ingredient breakdown
        const gtId = bc.batch.grainTypeId;
        const existing = ingredientCostMap.get(gtId);
        if (existing) {
          existing.bags += bags;
          existing.costPaisa += bc.totalCostPaisa;
        } else {
          ingredientCostMap.set(gtId, {
            name: bc.batch.grainType.name,
            code: bc.batch.grainType.code,
            bags,
            costPaisa: bc.totalCostPaisa,
          });
        }
      }
    } else {
      // Fallback: estimate from grams/meter × meters across all shift variants / bag weight × avg purchase price
      if (primarySV) {
        const bagWeightGrams = variantIngredients[0]?.grainType?.bagWeightGrams
          ?? primarySV.variant.grainType?.bagWeightGrams ?? 25000;
        const primaryGrainTypeId = variantIngredients[0]?.grainTypeId ?? primarySV.variant.grainTypeId;

        for (const sv of entry.shiftVariants) {
          const gpm = sv.gramsPerMeter ? Number(sv.gramsPerMeter) : 0;
          totalBagsConsumed += (gpm * sv.metersProduced) / bagWeightGrams;
        }

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

    // Build per-ingredient cost breakdown with standard ratio comparison
    const recipeIngredients = recipe?.ingredients ?? [];
    const ingredientCosts: IngredientCostBreakdown[] = [];

    // Add entries from actual consumption
    for (const [, data] of ingredientCostMap) {
      const standardEntry = recipeIngredients.find((r) => r.grainTypeCode === data.code);
      ingredientCosts.push({
        grainTypeName: data.name,
        grainTypeCode: data.code,
        standardRatioPercent: standardEntry?.ratioPercent ?? 0,
        actualBagsConsumed: data.bags,
        actualCostPaisa: Number(data.costPaisa),
        actualCostDisplay: formatPaisaToRupees(data.costPaisa),
      });
    }

    // Add recipe ingredients with zero actual consumption (if any were not consumed)
    for (const ri of recipeIngredients) {
      if (!ingredientCosts.find((ic) => ic.grainTypeCode === ri.grainTypeCode)) {
        ingredientCosts.push({
          grainTypeName: ri.grainTypeName,
          grainTypeCode: ri.grainTypeCode,
          standardRatioPercent: ri.ratioPercent,
          actualBagsConsumed: 0,
          actualCostPaisa: 0,
          actualCostDisplay: formatPaisaToRupees(0n),
        });
      }
    }

    const weightedAvgBagPricePaisa =
      totalBagsConsumed > 0
        ? Number(rawMaterialCostPaisa) / totalBagsConsumed
        : 0;

    // ─── Packaging cost (from production-linked packaging adjustments) ──────
    const packagingAdjustments = await prisma.packagingStockAdjustment.findMany({
      where: {
        referenceType: 'ProductionEntry',
        referenceId: entry.id,
      },
      select: {
        quantity: true,
        totalCostPaisa: true,
        unitRatePaisa: true,
      },
    });

    let packagingCostPaisa = 0n;
    let packagingUnitsConsumed = 0;
    for (const adjustment of packagingAdjustments) {
      if (adjustment.quantity < 0) {
        packagingUnitsConsumed += Math.abs(adjustment.quantity);
      }
      packagingCostPaisa += adjustment.totalCostPaisa ?? 0n;
    }

    const weightedAvgPackagingRatePaisa =
      packagingUnitsConsumed > 0
        ? Number(packagingCostPaisa) / packagingUnitsConsumed
        : 0;

    // ─── Labor cost (sum of worker shift costs) ───────────────────────────
    let laborCostPaisa = 0n;
    for (const pw of entry.workers) {
      if (pw.worker.shiftCostPaisa) {
        laborCostPaisa += pw.worker.shiftCostPaisa;
      }
    }

    // ─── Monthly overhead allocation ──────────────────────────────────────
    const entryYear = entry.date.getFullYear();
    const entryMonth = entry.date.getMonth() + 1; // 1-12

    const overheadBreakdown = await monthlyOverheadService.getBreakdownForMonth(entryYear, entryMonth);
    const effectivePackingOverheadPaisa =
      packagingUnitsConsumed > 0 ? 0n : overheadBreakdown.packingPaisa;
    const effectiveOverheadTotalPaisa =
      overheadBreakdown.laborPaisa +
      overheadBreakdown.rentPaisa +
      overheadBreakdown.transportationPaisa +
      effectivePackingOverheadPaisa +
      overheadBreakdown.miscellaneousPaisa;

    // Total meters produced in this calendar month (for overhead allocation)
    const monthStart = new Date(entryYear, entryMonth - 1, 1);
    const monthEnd = new Date(entryYear, entryMonth, 1);
    const monthlyMetersAgg = await prisma.productionEntry.aggregate({
      _sum: { metersProduced: true },
      where: {
        isDeleted: false,
        status: 'COMPLETED',
        metersProduced: { not: null },
        date: { gte: monthStart, lt: monthEnd },
      },
    });
    const monthlyTotalMeters = monthlyMetersAgg._sum.metersProduced ?? 0;

    // Overhead per meter = total monthly overhead / total monthly meters
    let overheadPerMeterPaisa = 0;
    if (monthlyTotalMeters > 0 && effectiveOverheadTotalPaisa > 0n) {
      overheadPerMeterPaisa = Number(effectiveOverheadTotalPaisa) / monthlyTotalMeters;
    }
    const overheadAllocatedPaisa = BigInt(Math.round(overheadPerMeterPaisa * (entry.metersProduced ?? 0)));

    // ─── Scrap credit ─────────────────────────────────────────────────────
    // Sum scrap from all shift variants, fallback to entry-level scrap
    let totalScrapWeightGrams = 0;
    for (const sv of entry.shiftVariants) {
      totalScrapWeightGrams += sv.scrapWeightGrams ?? 0;
    }
    if (totalScrapWeightGrams === 0 && entry.scrapWeightGrams) {
      totalScrapWeightGrams = entry.scrapWeightGrams;
    }

    // Get latest scrap sale rate for credit calculation
    let scrapRatePerKgPaisa = 0n;
    const latestScrapSale = await prisma.scrapSale.findFirst({
      where: { isDeleted: false },
      orderBy: { date: 'desc' },
      select: { ratePerKgPaisa: true },
    });
    if (latestScrapSale) {
      scrapRatePerKgPaisa = latestScrapSale.ratePerKgPaisa;
    }

    const scrapWeightKg = totalScrapWeightGrams / 1000;
    const scrapCreditPaisa = scrapRatePerKgPaisa > 0n
      ? BigInt(Math.round(scrapWeightKg * Number(scrapRatePerKgPaisa)))
      : 0n;

    // ─── Total & per-meter ────────────────────────────────────────────────
    const totalCostBeforeScrapPaisa =
      electricityCostPaisa +
      rawMaterialCostPaisa +
      packagingCostPaisa +
      laborCostPaisa +
      overheadAllocatedPaisa;

    const totalCostPaisa = totalCostBeforeScrapPaisa - scrapCreditPaisa;
    const costPerMeterPaisa =
      entry.metersProduced > 0 ? Number(totalCostPaisa) / entry.metersProduced : 0;

    // ─── Percentage breakdown (each component as % of total before scrap) ──
    const totalBeforeScrapNum = Number(totalCostBeforeScrapPaisa);
    const pctOf = (val: bigint) => totalBeforeScrapNum > 0 ? (Number(val) / totalBeforeScrapNum) * 100 : 0;

    const rawMaterialPct = pctOf(rawMaterialCostPaisa);
    const electricityPct = pctOf(electricityCostPaisa);
    const laborPct = pctOf(laborCostPaisa);
    const packagingPct = pctOf(packagingCostPaisa);
    const overheadPct = pctOf(overheadAllocatedPaisa);
    const scrapCreditPct = pctOf(scrapCreditPaisa);

    return {
      productionEntryId: entry.id,
      date: toISODate(entry.date),
      plant: entry.plant.name,
      shift: entry.shift,
      variant: entry.shiftVariants.map(sv => `${sv.variant.code} - ${sv.variant.name}`).join(', ') || '—',
      metersProduced: entry.metersProduced,

      recipe,
      ingredientCosts,

      electricityCostPaisa,
      electricityUnitsConsumed: electricityUnits,
      electricityRatePaisaPerUnit: Number(electricityRatePaisaPerUnit),
      electricityCostDisplay: formatPaisaToRupees(electricityCostPaisa),

      rawMaterialCostPaisa,
      bagsConsumed: totalBagsConsumed,
      weightedAvgBagPricePaisa,
      rawMaterialCostDisplay: formatPaisaToRupees(rawMaterialCostPaisa),

      packagingCostPaisa,
      packagingUnitsConsumed,
      weightedAvgPackagingRatePaisa,
      packagingCostDisplay: formatPaisaToRupees(packagingCostPaisa),

      laborCostPaisa,
      workerCount: entry.workers.length,
      laborCostDisplay: formatPaisaToRupees(laborCostPaisa),

      overheadLaborPaisa: overheadBreakdown.laborPaisa,
      overheadRentPaisa: overheadBreakdown.rentPaisa,
      overheadTransportationPaisa: overheadBreakdown.transportationPaisa,
      overheadPackingPaisa: effectivePackingOverheadPaisa,
      overheadMiscellaneousPaisa: overheadBreakdown.miscellaneousPaisa,
      overheadTotalPaisa: effectiveOverheadTotalPaisa,
      overheadPerMeterPaisa,
      overheadLaborDisplay: formatPaisaToRupees(overheadBreakdown.laborPaisa),
      overheadRentDisplay: formatPaisaToRupees(overheadBreakdown.rentPaisa),
      overheadTransportationDisplay: formatPaisaToRupees(overheadBreakdown.transportationPaisa),
      overheadPackingDisplay: formatPaisaToRupees(effectivePackingOverheadPaisa),
      overheadMiscellaneousDisplay: formatPaisaToRupees(overheadBreakdown.miscellaneousPaisa),
      overheadTotalDisplay: formatPaisaToRupees(effectiveOverheadTotalPaisa),
      overheadPerMeterDisplay: formatPaisaToRupees(BigInt(Math.round(overheadPerMeterPaisa))),
      monthlyTotalMeters,

      scrapWeightGrams: totalScrapWeightGrams,
      scrapRatePerKgPaisa,
      scrapCreditPaisa,
      scrapCreditDisplay: formatPaisaToRupees(scrapCreditPaisa),

      totalCostBeforeScrapPaisa,
      totalCostBeforeScrapDisplay: formatPaisaToRupees(totalCostBeforeScrapPaisa),
      totalCostPaisa,
      totalCostDisplay: formatPaisaToRupees(totalCostPaisa),

      costPerMeterPaisa,
      costPerMeterDisplay: formatPaisaToRupees(BigInt(Math.round(costPerMeterPaisa))),

      rawMaterialPct,
      electricityPct,
      laborPct,
      packagingPct,
      overheadPct,
      scrapCreditPct,
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

  /**
   * Monthly cost summary: aggregates cost data by month for a given year.
   */
  async getMonthlySummary(params: {
    year: number;
    plantId?: string;
    variantId?: string;
  }) {
    const { year, plantId, variantId } = params;

    const months: {
      month: number;
      monthLabel: string;
      totalMeters: number;
      totalEntries: number;
      rawMaterialPaisa: bigint;
      electricityPaisa: bigint;
      laborPaisa: bigint;
      packagingPaisa: bigint;
      overheadPaisa: bigint;
      scrapCreditPaisa: bigint;
      totalCostPaisa: bigint;
      avgCostPerMeterPaisa: number;
    }[] = [];

    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ];

    for (let m = 1; m <= 12; m++) {
      const monthStart = new Date(year, m - 1, 1);
      const monthEnd = new Date(year, m, 1);

      // Skip future months
      if (monthStart > new Date()) break;

      const entries = await prisma.productionEntry.findMany({
        where: {
          isDeleted: false,
          status: 'COMPLETED',
          metersProduced: { not: null },
          date: { gte: monthStart, lt: monthEnd },
          ...(plantId ? { plantId } : {}),
          ...(variantId
            ? { shiftVariants: { some: { variantId } } }
            : {}),
        },
        select: { id: true },
      });

      if (entries.length === 0) {
        months.push({
          month: m,
          monthLabel: monthNames[m - 1],
          totalMeters: 0,
          totalEntries: 0,
          rawMaterialPaisa: 0n,
          electricityPaisa: 0n,
          laborPaisa: 0n,
          packagingPaisa: 0n,
          overheadPaisa: 0n,
          scrapCreditPaisa: 0n,
          totalCostPaisa: 0n,
          avgCostPerMeterPaisa: 0,
        });
        continue;
      }

      // Calculate breakdown for each entry, then aggregate
      const breakdowns = (
        await Promise.all(entries.map((e) => this.calculateForEntry(e.id)))
      ).filter(Boolean) as ShiftCostBreakdown[];

      let totalMeters = 0;
      let rawMaterialPaisa = 0n;
      let electricityPaisa = 0n;
      let laborPaisa = 0n;
      let packagingPaisa = 0n;
      let overheadPaisa = 0n;
      let scrapCredit = 0n;
      let totalCost = 0n;

      for (const b of breakdowns) {
        totalMeters += b.metersProduced;
        rawMaterialPaisa += b.rawMaterialCostPaisa;
        electricityPaisa += b.electricityCostPaisa;
        laborPaisa += b.laborCostPaisa;
        packagingPaisa += b.packagingCostPaisa;
        overheadPaisa += BigInt(Math.round(b.overheadPerMeterPaisa * b.metersProduced));
        scrapCredit += b.scrapCreditPaisa;
        totalCost += b.totalCostPaisa;
      }

      months.push({
        month: m,
        monthLabel: monthNames[m - 1],
        totalMeters,
        totalEntries: breakdowns.length,
        rawMaterialPaisa,
        electricityPaisa,
        laborPaisa,
        packagingPaisa,
        overheadPaisa,
        scrapCreditPaisa: scrapCredit,
        totalCostPaisa: totalCost,
        avgCostPerMeterPaisa: totalMeters > 0 ? Number(totalCost) / totalMeters : 0,
      });
    }

    // Format for JSON response
    const formatted = months.map((m) => ({
      month: m.month,
      monthLabel: m.monthLabel,
      totalMeters: m.totalMeters,
      totalEntries: m.totalEntries,
      rawMaterialDisplay: formatPaisaToRupees(m.rawMaterialPaisa),
      electricityDisplay: formatPaisaToRupees(m.electricityPaisa),
      laborDisplay: formatPaisaToRupees(m.laborPaisa),
      packagingDisplay: formatPaisaToRupees(m.packagingPaisa),
      overheadDisplay: formatPaisaToRupees(m.overheadPaisa),
      scrapCreditDisplay: formatPaisaToRupees(m.scrapCreditPaisa),
      totalCostDisplay: formatPaisaToRupees(m.totalCostPaisa),
      avgCostPerMeterDisplay: formatPaisaToRupees(BigInt(Math.round(m.avgCostPerMeterPaisa))),
      // Raw paisa values for chart rendering
      rawMaterialPaisa: Number(m.rawMaterialPaisa),
      electricityPaisa: Number(m.electricityPaisa),
      laborPaisa: Number(m.laborPaisa),
      packagingPaisa: Number(m.packagingPaisa),
      overheadPaisa: Number(m.overheadPaisa),
      scrapCreditPaisa: Number(m.scrapCreditPaisa),
      totalCostPaisa: Number(m.totalCostPaisa),
      avgCostPerMeterPaisa: m.avgCostPerMeterPaisa,
    }));

    // Yearly totals
    const yearTotalMeters = months.reduce((s, m) => s + m.totalMeters, 0);
    const yearTotalCost = months.reduce((s, m) => s + m.totalCostPaisa, 0n);
    const yearTotalEntries = months.reduce((s, m) => s + m.totalEntries, 0);

    return {
      year,
      months: formatted,
      yearSummary: {
        totalMeters: yearTotalMeters,
        totalEntries: yearTotalEntries,
        totalCostDisplay: formatPaisaToRupees(yearTotalCost),
        totalCostPaisa: Number(yearTotalCost),
        avgCostPerMeterDisplay: formatPaisaToRupees(
          BigInt(Math.round(yearTotalMeters > 0 ? Number(yearTotalCost) / yearTotalMeters : 0))
        ),
        avgCostPerMeterPaisa: yearTotalMeters > 0 ? Number(yearTotalCost) / yearTotalMeters : 0,
      },
    };
  }
}

export const costPriceService = new CostPriceService();
