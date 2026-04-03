import api from './api';
import type { PaginatedResponse } from '../types';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface EntityRef {
  id: string;
  name: string;
}

export interface VariantRef {
  id: string;
  code: string;
  name: string;
}

export type Shift = 'DAY' | 'NIGHT';

export type ProductionStatus = 'IN_PRODUCTION' | 'COMPLETED';

export interface RawMaterialConsumed {
  grainType: string;
  gramsConsumed: number;
  bagsConsumed: number;
}

export interface ProductionEntry {
  id: string;
  plant: EntityRef;
  shift: Shift;
  date: string;
  status: ProductionStatus;
  variant: VariantRef & { standardGramsPerMeter?: number };
  metersProduced: number | null;
  gramsPerMeter: number | null;
  electricityUnitsConsumed: number | null;
  electricityStartReading: number | null;
  electricityEndReading: number | null;
  hasElectricityDiscrepancy: boolean;
  electricityDiscrepancyNotes: string | null;
  scrapWeightGrams: number;
  workers: EntityRef[];
  rawMaterialConsumed: RawMaterialConsumed | null;
  createdBy: string;
  createdAt: string;
  updatedAt?: string;
  version: number;
}

export interface ProductionEntryCreateResult {
  id: string;
  plant: EntityRef;
  shift: Shift;
  date: string;
  variant: VariantRef;
  status: ProductionStatus;
  workers: EntityRef[];
  electricityStartReading: number | null;
  version: number;
}

export interface ProductionEntryCompleteResult {
  id: string;
  plant: EntityRef;
  shift: Shift;
  date: string;
  variant: VariantRef;
  status: ProductionStatus;
  metersProduced: number;
  hasElectricityDiscrepancy: boolean;
  rawMaterialConsumed: { gramsConsumed: number; bagsConsumed: number };
  stockUpdate: { variantId: string; newStockMeters: number };
  version: number;
}

export interface CreateProductionEntryPayload {
  plantId: string;
  shift: Shift;
  date: string;
  variantId: string;
  electricityStartReading?: number;
  workerIds?: string[];
}

export interface CompleteProductionEntryPayload {
  metersProduced: number;
  gramsPerMeter: number;
  electricityEndReading?: number;
  scrapWeightGrams?: number;
}

export interface UpdateProductionEntryPayload {
  metersProduced?: number;
  gramsPerMeter?: number;
  electricityUnitsConsumed?: number;
  electricityStartReading?: number | null;
  electricityEndReading?: number | null;
  scrapWeightGrams?: number;
  workerIds?: string[];
}

export interface DPRShiftData {
  metersProduced: number;
  variants: { code: string; name: string; meters: number }[];
  electricityUnits: number;
  scrapGrams: number;
  workers: string[];
  hasDiscrepancy: boolean;
}

export interface DPRPlantData {
  plant: EntityRef;
  dayShift: DPRShiftData | null;
  nightShift: DPRShiftData | null;
  totalMeters: number;
}

export interface DPRData {
  date: string;
  plants: DPRPlantData[];
  grandTotalMeters: number;
}

export interface ScrapSale {
  id: string;
  date: string;
  totalWeightKg: number;
  ratePerKgPaisa: number;
  totalAmountPaisa: number;
  totalAmountDisplay: string;
  buyerName: string | null;
  plant: EntityRef | null;
  version: number;
}

export interface CreateScrapSalePayload {
  date: string;
  totalWeightKg: number;
  ratePerKgPaisa: number;
  buyerName?: string;
  plantId?: string;
}

export interface DiscrepancyEntry {
  id: string;
  plant: EntityRef;
  shift: Shift;
  date: string;
  variant: VariantRef;
  metersProduced: number;
  electricityUnitsConsumed: number;
  hasElectricityDiscrepancy: boolean;
  electricityDiscrepancyNotes: string | null;
}

export interface PlantLookup {
  id: string;
  name: string;
  location: string | null;
}

export interface WorkerLookup {
  id: string;
  name: string;
  designation: string | null;
  plantId: string | null;
}

export interface VariantLookup {
  id: string;
  code: string;
  name: string;
  standardGramsPerMeter: number;
}

// ─── Filters ─────────────────────────────────────────────────────────────────

export interface ProductionEntryFilters {
  page?: number;
  limit?: number;
  plantId?: string;
  shift?: Shift;
  variantId?: string;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface DPRFilters {
  date?: string;
  plantId?: string;
}

export interface DiscrepancyFilters {
  page?: number;
  limit?: number;
  plantId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface ScrapSaleFilters {
  page?: number;
  limit?: number;
  plantId?: string;
  dateFrom?: string;
  dateTo?: string;
}

// ─── API calls ───────────────────────────────────────────────────────────────

export const productionApi = {
  // Production entries
  getEntries: (params: ProductionEntryFilters = {}) =>
    api
      .get<PaginatedResponse<ProductionEntry>>('/production/entries', { params })
      .then((r) => r.data),

  createEntry: (data: CreateProductionEntryPayload) =>
    api
      .post<{ data: ProductionEntryCreateResult }>('/production/entries', data)
      .then((r) => r.data),

  getEntryById: (id: string) =>
    api
      .get<{ data: ProductionEntry }>(`/production/entries/${id}`)
      .then((r) => r.data),

  updateEntry: (id: string, data: UpdateProductionEntryPayload, version: number) =>
    api
      .put<{ data: ProductionEntry }>(`/production/entries/${id}`, data, {
        headers: { 'If-Match': String(version) },
      })
      .then((r) => r.data),

  completeEntry: (id: string, data: CompleteProductionEntryPayload) =>
    api
      .post<{ data: ProductionEntryCompleteResult }>(`/production/entries/${id}/complete`, data)
      .then((r) => r.data),

  // Daily Progress Report
  getDPR: (params: DPRFilters = {}) =>
    api
      .get<{ data: DPRData }>('/production/dpr', { params })
      .then((r) => r.data),

  // Scrap sales
  getScrapSales: (params: ScrapSaleFilters = {}) =>
    api
      .get<PaginatedResponse<ScrapSale>>('/production/scrap-sales', { params })
      .then((r) => r.data),

  createScrapSale: (data: CreateScrapSalePayload) =>
    api
      .post<{ data: ScrapSale }>('/production/scrap-sales', data)
      .then((r) => r.data),

  // Discrepancies
  getDiscrepancies: (params: DiscrepancyFilters = {}) =>
    api
      .get<PaginatedResponse<DiscrepancyEntry>>('/production/discrepancies', { params })
      .then((r) => r.data),

  // Lookups
  getPlants: () =>
    api.get<{ data: PlantLookup[] }>('/production/plants').then((r) => r.data),

  getWorkers: (plantId?: string) =>
    api
      .get<{ data: WorkerLookup[] }>('/production/workers', {
        params: plantId ? { plantId } : {},
      })
      .then((r) => r.data),

  getVariants: () =>
    api
      .get<{ data: VariantLookup[] }>('/production/variants')
      .then((r) => r.data),

  // Backward-compatible method aliases
  getEntry: (id: string) =>
    api
      .get<{ data: ProductionEntry }>(`/production/entries/${id}`)
      .then((r) => r.data),

  getDailyReport: (date: string) =>
    api
      .get<{ data: DPRData }>('/production/dpr', { params: { date } })
      .then((r) => r.data),

  getScrapMonthlySummary: () =>
    api
      .get<{ data: ScrapMonthlySummary[] }>('/production/scrap-sales/monthly-summary')
      .then((r) => r.data),
};

// Backward-compatible type aliases for existing pages
export type ProductionEntryPayload = CreateProductionEntryPayload;
export type CompleteEntryPayload = CompleteProductionEntryPayload;
export type ScrapSalePayload = CreateScrapSalePayload;
export type DailyReport = DPRData;
export type DailyReportPlant = DPRPlantData;
export type Discrepancy = DiscrepancyEntry;
export interface ScrapMonthlySummary {
  month: string;
  totalWeightKg: number;
  totalPaisa: number;
  count: number;
}
