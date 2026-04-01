import api from './api';
import type { PaginatedResponse } from '../types';

// Types
export interface VariantRef { id: string; code: string; name: string; }
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
};
