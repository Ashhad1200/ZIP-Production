import api from './api';
import type { PaginatedResponse } from '../types';

// ─── Types ───────────────────────────────────────────────────────────────────

export type Shift = 'DAY' | 'NIGHT';
export type GatePassStatus = 'CREATED' | 'DISPATCHED' | 'RECEIVED';

export interface EntityRef {
  id: string;
  name: string;
}

export interface VariantRef {
  id: string;
  code: string;
  name: string;
}

export interface GatePassLineItem {
  id: string;
  variant: VariantRef;
  meters: number;
  ratePerMeterPaisa: string;
  ratePerMeterDisplay: string;
  lineAmountPaisa: string;
  lineAmountDisplay: string;
}

export interface GatePass {
  id: string;
  gatePassNumber: string;
  client: EntityRef;
  date: string;
  issuingManagerName: string;
  shift: Shift;
  status: GatePassStatus;
  order: { id: string; orderNumber: string } | null;
  totalAmountPaisa: string;
  totalAmountDisplay: string;
  paymentDueDate: string;
  receivedAt: string | null;
  receivedBy: string | null;
  receiptPhotoUrl: string | null;
  journalEntry: { id: string; entryNumber: string; status: string } | null;
  lineItems: GatePassLineItem[];
  verifyToken: string;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface GatePassDetail extends GatePass {
  client: EntityRef & {
    contactPerson?: string;
    phone?: string;
    address?: string;
    paymentCycleDays?: number;
  };
  order: {
    id: string;
    orderNumber: string;
    metersOrdered?: number;
    metersDelivered?: number;
    status?: string;
  } | null;
}

export interface CreateGatePassPayload {
  clientId: string;
  date: string;
  shift: Shift;
  orderId?: string;
  lineItems: { variantId: string; meters: number }[];
}

export interface ClientLookup {
  id: string;
  name: string;
  paymentCycleDays: number;
}

export interface VariantLookup {
  id: string;
  code: string;
  name: string;
}

export interface ClientOrderLineItem {
  variantId: string;
  variant: VariantRef;
  metersOrdered: number;
  metersDelivered: number;
}

export interface ClientOrder {
  id: string;
  orderNumber: string;
  metersOrdered: number;
  metersDelivered: number;
  lineItems: ClientOrderLineItem[];
}

export interface ClientRateResult {
  ratePerMeterPaisa: string;
  ratePerMeterDisplay: string;
}

export interface StockResult {
  availableMeters: number;
}

export interface VerifyResult {
  id: string;
  status: 'received' | 'already_received';
  gatePassNumber: string;
  clientName: string;
  receivedAt: string;
  totalAmountDisplay: string;
  lineItems: { variant: VariantRef; meters: number }[];
}

// ─── Filters ─────────────────────────────────────────────────────────────────

export interface GatePassFilters {
  page?: number;
  limit?: number;
  clientId?: string;
  status?: GatePassStatus;
  dateFrom?: string;
  dateTo?: string;
  shift?: Shift;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// ─── API calls ───────────────────────────────────────────────────────────────

export const gatePassApi = {
  // Gate passes
  list: (params: GatePassFilters = {}) =>
    api
      .get<PaginatedResponse<GatePass>>('/gate-passes', { params })
      .then((r) => r.data),

  create: (data: CreateGatePassPayload) =>
    api
      .post<{ data: GatePass }>('/gate-passes', data)
      .then((r) => r.data),

  getById: (id: string) =>
    api
      .get<{ data: GatePassDetail }>(`/gate-passes/${id}`)
      .then((r) => r.data),

  updateStatus: (id: string, status: GatePassStatus, version: number) =>
    api
      .patch<{ data: GatePass }>(`/gate-passes/${id}/status`, { status }, {
        headers: { 'If-Match': String(version) },
      })
      .then((r) => r.data),

  getPdfData: (id: string) =>
    api
      .get<{ data: GatePassDetail }>(`/gate-passes/${id}/pdf`)
      .then((r) => r.data),

  // QR verification (public, no auth needed)
  verify: (token: string) =>
    api
      .post<{ data: VerifyResult }>('/gate-passes/verify', { token })
      .then((r) => r.data),

  // Lookups
  getClients: () =>
    api
      .get<{ data: ClientLookup[] }>('/gate-passes/clients')
      .then((r) => r.data),

  getVariants: () =>
    api
      .get<{ data: VariantLookup[] }>('/gate-passes/variants')
      .then((r) => r.data),

  getClientOrders: (clientId: string) =>
    api
      .get<{ data: ClientOrder[] }>(`/gate-passes/clients/${clientId}/orders`)
      .then((r) => r.data),

  getClientRate: (clientId: string, variantId: string) =>
    api
      .get<{ data: ClientRateResult | null }>('/gate-passes/client-rate', {
        params: { clientId, variantId },
      })
      .then((r) => r.data),

  getStock: (variantId: string) =>
    api
      .get<{ data: StockResult }>(`/gate-passes/stock/${variantId}`)
      .then((r) => r.data),

  // Receipt photo upload (semi-public: token from QR flow OR authenticated)
  uploadReceiptPhoto: (id: string, photoUrl: string, token?: string) =>
    api
      .patch<{ data: { id: string; receiptPhotoUrl: string } }>(
        `/gate-passes/${id}/receipt-photo`,
        { photoUrl, token },
      )
      .then((r) => r.data),
};
