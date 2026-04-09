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

export interface OrderLineItem {
  id: string;
  variantId: string;
  variant: VariantRef;
  metersOrdered: number;
  metersDelivered: number;
  // Financial (only for FINANCE_HEAD/SUPER_ADMIN)
  ratePerMeterPaisa?: string;
  ratePerMeterDisplay?: string;
}

export interface DeliveryLineItem {
  id: string;
  meters: number;
  variant: VariantRef;
}

export interface Delivery {
  id: string;
  gatePassNumber: string;
  date: string;
  status: string;
  totalAmountPaisa?: string;
  totalAmountDisplay?: string;
  lineItems: DeliveryLineItem[];
}

export interface Order {
  id: string;
  orderNumber: string;
  client: EntityRef;
  lineItems: OrderLineItem[];
  deliveries: Delivery[];
  metersOrdered: number;
  metersDelivered: number;
  fulfillmentPercent: number;
  deliveryDeadline: string;
  status: 'PENDING_APPROVAL' | 'PENDING' | 'ONGOING' | 'COMPLETED';
  isOverdue: boolean;
  // Financial fields (only for FINANCE_HEAD/SUPER_ADMIN)
  totalAmountPaisa?: string;
  totalAmountDisplay?: string;
  clientOutstandingPaisa?: string;
  clientOutstandingDisplay?: string;
  createdAt: string;
  version: number;
}

export interface CreateOrderLineItem {
  variantId: string;
  metersOrdered: number;
  ratePerMeterPaisa: number;
}

export interface CreateOrderPayload {
  clientId: string;
  lineItems: CreateOrderLineItem[];
  deliveryDeadline: string;
}

export interface CreateOrderResult {
  id: string;
  orderNumber: string;
  status: string;
  totalAmountPaisa: number;
  totalAmountDisplay: string;
  clientOutstandingPaisa: number;
  clientOutstandingDisplay: string;
  notificationSent: boolean;
  version: number;
}

// ─── Filters ─────────────────────────────────────────────────────────────────

export interface OrderFilters {
  page?: number;
  limit?: number;
  clientId?: string;
  status?: string;
  variantId?: string;
  dateFrom?: string;
  dateTo?: string;
  overdue?: boolean;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// ─── Fulfillment report ──────────────────────────────────────────────────────

export interface FulfillmentSummary {
  totalOrders: number;
  pending: number;
  ongoing: number;
  completed: number;
  overdue: number;
}

export interface FulfillmentOrder {
  orderNumber: string;
  client: string;
  variant: string;
  metersOrdered: number;
  metersDelivered: number;
  fulfillmentPercent: number;
  deliveryDeadline: string;
  status: string;
  daysRemaining: number;
}

export interface FulfillmentReport {
  summary: FulfillmentSummary;
  orders: FulfillmentOrder[];
}

// ─── Lookups ─────────────────────────────────────────────────────────────────

export interface ClientLookup {
  id: string;
  name: string;
}

export interface VariantLookup {
  id: string;
  code: string;
  name: string;
  standardGramsPerMeter: number;
}

// ─── API calls ───────────────────────────────────────────────────────────────

export const orderApi = {
  getOrders: (params: OrderFilters = {}) =>
    api
      .get<PaginatedResponse<Order>>('/orders', { params })
      .then((r) => r.data),

  createOrder: (data: CreateOrderPayload) =>
    api
      .post<{ data: CreateOrderResult }>('/orders', data)
      .then((r) => r.data),

  getOrderById: (id: string) =>
    api
      .get<{ data: Order }>(`/orders/${id}`)
      .then((r) => r.data),

  getOrdersByClient: (clientId: string) =>
    api
      .get<{ data: Order[] }>(`/orders/by-client/${clientId}`)
      .then((r) => r.data),

  getFulfillmentReport: () =>
    api
      .get<{ data: FulfillmentReport }>('/orders/fulfillment-report')
      .then((r) => r.data),

  approveOrder: (id: string) =>
    api.post<{ data: { id: string; status: string; version: number } }>(`/orders/${id}/approve`).then((r) => r.data),

  rejectOrder: (id: string, reason?: string) =>
    api.post<{ data: { id: string; status: string; reason: string } }>(`/orders/${id}/reject`, { reason }).then((r) => r.data),

  // Reuse gate-pass lookups for clients and variants
  getClients: () =>
    api
      .get<{ data: ClientLookup[] }>('/gate-passes/clients')
      .then((r) => r.data),

  getVariants: () =>
    api
      .get<{ data: VariantLookup[] }>('/production/variants')
      .then((r) => r.data),
};
