import api from './api';

// ─── Types ───────────────────────────────────────────────────────────────────

interface PaginatedMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ShiftCostBreakdown {
  productionEntryId: string;
  date: string;
  plant: string;
  shift: 'DAY' | 'NIGHT';
  variant: string;
  metersProduced: number;

  electricityCostPaisa: string;
  electricityUnitsConsumed: number;
  electricityRatePaisaPerUnit: string;
  electricityCostDisplay: string;

  rawMaterialCostPaisa: string;
  bagsConsumed: number;
  weightedAvgBagPricePaisa: number;
  rawMaterialCostDisplay: string;

  laborCostPaisa: string;
  workerCount: number;
  laborCostDisplay: string;

  totalCostPaisa: string;
  totalCostDisplay: string;

  costPerMeterPaisa: number;
  costPerMeterDisplay: string;
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
