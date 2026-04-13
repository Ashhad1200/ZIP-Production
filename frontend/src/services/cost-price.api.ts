import api from './api';

// ─── Types ───────────────────────────────────────────────────────────────────

interface PaginatedMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface IngredientCostBreakdown {
  grainTypeName: string;
  grainTypeCode: string;
  standardRatioPercent: number;
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
  shift: 'DAY' | 'NIGHT';
  variant: string;
  metersProduced: number;

  recipe: RecipeInfo | null;
  ingredientCosts: IngredientCostBreakdown[];

  electricityCostPaisa: string;
  electricityUnitsConsumed: number;
  electricityRatePaisaPerUnit: string;
  electricityCostDisplay: string;

  rawMaterialCostPaisa: string;
  bagsConsumed: number;
  weightedAvgBagPricePaisa: number;
  rawMaterialCostDisplay: string;

  packagingCostPaisa: string;
  packagingUnitsConsumed: number;
  weightedAvgPackagingRatePaisa: number;
  packagingCostDisplay: string;

  laborCostPaisa: string;
  workerCount: number;
  laborCostDisplay: string;

  overheadLaborPaisa: string;
  overheadRentPaisa: string;
  overheadTransportationPaisa: string;
  overheadPackingPaisa: string;
  overheadMiscellaneousPaisa: string;
  overheadTotalPaisa: string;
  overheadPerMeterPaisa: number;
  overheadLaborDisplay: string;
  overheadRentDisplay: string;
  overheadTransportationDisplay: string;
  overheadPackingDisplay: string;
  overheadMiscellaneousDisplay: string;
  overheadTotalDisplay: string;
  overheadPerMeterDisplay: string;
  monthlyTotalMeters: number;

  // Scrap credit
  scrapWeightGrams: number;
  scrapRatePerKgPaisa: string;
  scrapCreditPaisa: string;
  scrapCreditDisplay: string;

  // Totals
  totalCostBeforeScrapPaisa: string;
  totalCostBeforeScrapDisplay: string;
  totalCostPaisa: string;
  totalCostDisplay: string;

  costPerMeterPaisa: number;
  costPerMeterDisplay: string;

  // Percentage breakdown
  rawMaterialPct: number;
  electricityPct: number;
  laborPct: number;
  packagingPct: number;
  overheadPct: number;
  scrapCreditPct: number;
}

export interface CostPriceSummary {
  totalMeters: number;
  totalCostPaisa: string;
  totalCostDisplay: string;
  avgCostPerMeterPaisa: number;
  avgCostPerMeterDisplay: string;
}

export interface CostPriceListResponse {
  data: ShiftCostBreakdown[];
  summary: CostPriceSummary;
  meta: PaginatedMeta;
}

export interface CostPriceFilters {
  page?: number;
  limit?: number;
  dateFrom?: string;
  dateTo?: string;
  plantId?: string;
  variantId?: string;
}

// ─── API calls ───────────────────────────────────────────────────────────────

export const costPriceApi = {
  list: (params: CostPriceFilters = {}) =>
    api
      .get<CostPriceListResponse>('/cost-price', { params })
      .then((r) => r.data),

  getForEntry: (id: string) =>
    api
      .get<{ data: ShiftCostBreakdown }>(`/cost-price/${id}`)
      .then((r) => r.data),
};
