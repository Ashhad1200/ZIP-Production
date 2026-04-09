import api from './api';
import type { PaginatedResponse } from '../types';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SalesReturnLineItem {
  id: string;
  gatePassLineItemId: string;
  variantId: string;
  metersReturned: number;
  originalMeters: number;
  ratePerMeterPaisa: string;
  ratePerMeterDisplay: string;
  lineAmountPaisa: string;
  lineAmountDisplay: string;
  variant: { id: string; code: string; name: string };
}

export interface SalesReturn {
  id: string;
  returnNumber: string;
  gatePassId: string;
  clientId: string;
  date: string;
  reason: string | null;
  totalAmountPaisa: string;
  totalAmountDisplay: string;
  journalEntryId: string | null;
  createdAt: string;
  gatePass: { id: string; gatePassNumber: string };
  client: { id: string; name: string };
  lineItems: SalesReturnLineItem[];
}

export interface CreateSalesReturnLineItemInput {
  gatePassLineItemId: string;
  metersReturned: number;
}

export interface CreateSalesReturnInput {
  gatePassId: string;
  date: string;
  reason?: string;
  lineItems: CreateSalesReturnLineItemInput[];
}

export interface SalesReturnListFilters {
  page?: number;
  limit?: number;
  clientId?: string;
  gatePassId?: string;
  dateFrom?: string;
  dateTo?: string;
}

// ─── API calls ───────────────────────────────────────────────────────────────

export const salesReturnApi = {
  list: (filters?: SalesReturnListFilters): Promise<PaginatedResponse<SalesReturn>> => {
    const params = new URLSearchParams();
    if (filters?.page) params.set('page', String(filters.page));
    if (filters?.limit) params.set('limit', String(filters.limit));
    if (filters?.clientId) params.set('clientId', filters.clientId);
    if (filters?.gatePassId) params.set('gatePassId', filters.gatePassId);
    if (filters?.dateFrom) params.set('dateFrom', filters.dateFrom);
    if (filters?.dateTo) params.set('dateTo', filters.dateTo);
    return api.get(`/sales-returns?${params.toString()}`).then((r) => r.data);
  },

  getById: (id: string): Promise<{ data: SalesReturn }> =>
    api.get(`/sales-returns/${id}`).then((r) => r.data),

  create: (input: CreateSalesReturnInput): Promise<{ data: SalesReturn }> =>
    api.post('/sales-returns', input).then((r) => r.data),
};
