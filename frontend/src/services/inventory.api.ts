import api from './api';
import type { PaginatedResponse } from '../types';

// Types
export interface VariantRef { id: string; code: string; name: string; metersPerCarton?: number | null; }
export interface GrainTypeRef { id: string; code: string; name: string; }

export interface FinishedGoodsStockItem {
  id: string;
  variant: VariantRef;
  currentMeters: number;
  lowStockThreshold: number | null;
  isBelowThreshold: boolean;
  lastUpdated: string;
  version: number;
}

export interface RawMaterialStockItem {
  id: string;
  grainType: GrainTypeRef;
  currentBags: number;
  lowStockThresholdBags: number | null;
  isBelowThreshold: boolean;
  lastUpdated: string;
  version: number;
}

export interface PurchaseRecord {
  id: string;
  grainType: GrainTypeRef;
  vendor: { id: string; name: string } | null;
  numberOfBags: number;
  ratePerBagPaisa: number;
  ratePerBagDisplay: string;
  totalAmountPaisa: number;
  totalAmountDisplay: string;
  purchaseDate: string;
  source: 'CONTAINER' | 'SPOT_MARKET';
  createdAt: string;
}

export interface CreatePurchasePayload {
  grainTypeId: string;
  vendorId?: string;
  numberOfBags: number;
  ratePerBagPaisa: number;
  purchaseDate: string;
  source: 'CONTAINER' | 'SPOT_MARKET';
}

export interface PurchaseResult {
  id: string;
  totalAmountPaisa: number;
  stockUpdate: { grainTypeId: string; newStockBags: number; };
}

export interface PurchaseFilters {
  page?: number;
  limit?: number;
  grainTypeId?: string;
  source?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface FinishedGoodsFilters {
  variantId?: string;
  belowThreshold?: boolean;
}

export interface ConsumptionReportFilters {
  grainTypeId?: string;
  period?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface ConsumptionGrainData {
  grainType: string;
  purchasedBags: number;
  consumedBags: number;
  netChange: number;
  currentStock: number;
  weightedAvgCostPaisa: number;
}

export interface ConsumptionReportData {
  period: string;
  grainTypes: ConsumptionGrainData[];
}

// ─── FIFO Batch types ─────────────────────────────────────────────────────────

export interface FifoBatch {
  id: string;
  grainType: GrainTypeRef;
  purchaseDate: string;
  source: 'CONTAINER' | 'SPOT_MARKET';
  bagsTotal: number;
  bagsRemaining: number;
  bagsConsumed: number;
  pricePerBagPaisa: number;
  pricePerBagDisplay: string;
  isExhausted: boolean;
  purchaseId: string;
}

// ─── Electricity Rate types ───────────────────────────────────────────────────

export interface ElectricityRate {
  id: string;
  ratePaisaPerUnit: number;
  rateDisplay: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  notes: string | null;
}

export interface CreateElectricityRatePayload {
  ratePaisaPerUnit: number;
  effectiveFrom: string;
  notes?: string;
}

// API methods
export const inventoryApi = {
  getFinishedGoods: (params: FinishedGoodsFilters = {}) =>
    api.get<{ data: FinishedGoodsStockItem[] }>('/inventory/finished-goods', { params }).then(r => r.data),

  getRawMaterials: () =>
    api.get<{ data: RawMaterialStockItem[] }>('/inventory/raw-materials').then(r => r.data),

  getPurchases: (params: PurchaseFilters = {}) =>
    api.get<PaginatedResponse<PurchaseRecord>>('/inventory/raw-materials/purchases', { params }).then(r => r.data),

  createPurchase: (data: CreatePurchasePayload) =>
    api.post<{ data: PurchaseResult }>('/inventory/raw-materials/purchases', data).then(r => r.data),

  getConsumptionReport: (params: ConsumptionReportFilters = {}) =>
    api.get<{ data: ConsumptionReportData }>('/inventory/consumption-report', { params }).then(r => r.data),

  updateFinishedGoodsThreshold: (id: string, threshold: number) =>
    api.put<{ data: FinishedGoodsStockItem }>(`/inventory/finished-goods/${id}/threshold`, { threshold }).then(r => r.data),

  updateRawMaterialThreshold: (id: string, thresholdBags: number) =>
    api.put<{ data: RawMaterialStockItem }>(`/inventory/raw-materials/${id}/threshold`, { thresholdBags }).then(r => r.data),

  // FIFO Batches
  getBatches: (params: { grainTypeId?: string; includeExhausted?: boolean } = {}) =>
    api.get<{ data: FifoBatch[] }>('/inventory/raw-materials/batches', { params }).then(r => r.data),

  // Electricity Rates
  getElectricityRates: () =>
    api.get<{ data: ElectricityRate[] }>('/inventory/electricity-rates').then(r => r.data),

  getCurrentElectricityRate: () =>
    api.get<{ data: ElectricityRate | null }>('/inventory/electricity-rates/current').then(r => r.data),

  createElectricityRate: (data: CreateElectricityRatePayload) =>
    api.post<{ data: ElectricityRate }>('/inventory/electricity-rates', data).then(r => r.data),
};

// ─── Packaging Inventory API ─────────────────────────────────────────────────

export interface PackagingMaterial {
  id: string;
  name: string;
  unit: string;
  currentStock: number;
  ratePerUnitPaisa: number;
  lowStockThreshold: number | null;
  notes: string | null;
  isActive: boolean;
  isBelowThreshold: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PackagingAdjustment {
  id: string;
  materialId: string;
  quantity: number;
  type: string;
  unitRatePaisa: number | null;
  totalCostPaisa: number | null;
  vendorId: string | null;
  purchaseDate: string | null;
  vendor: { id: string; name: string } | null;
  notes: string | null;
  createdBy: string;
  createdAt: string;
}

export const packagingApi = {
  listMaterials: () =>
    api.get<{ data: PackagingMaterial[] }>('/packaging').then((r) => r.data),

  createMaterial: (data: { name: string; unit?: string; ratePerUnitPaisa?: number; lowStockThreshold?: number; notes?: string }) =>
    api.post<{ data: PackagingMaterial }>('/packaging', data).then((r) => r.data),

  updateMaterial: (id: string, data: { name?: string; unit?: string; ratePerUnitPaisa?: number; lowStockThreshold?: number | null; notes?: string | null; isActive?: boolean }) =>
    api.put<{ data: PackagingMaterial }>(`/packaging/${id}`, data).then((r) => r.data),

  listAdjustments: (materialId: string) =>
    api.get<{ data: PackagingAdjustment[] }>(`/packaging/${materialId}/adjustments`).then((r) => r.data),

  recordAdjustment: (materialId: string, data: { quantity: number; type: string; notes?: string; vendorId?: string; purchaseDate?: string; ratePerUnitPaisa?: number }) =>
    api.post<{ data: PackagingMaterial }>(`/packaging/${materialId}/adjustments`, data).then((r) => r.data),
};
