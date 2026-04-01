import api from './api';
import type { PaginatedResponse } from '../types';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ClientWithBalance {
  id: string;
  name: string;
  paymentCycleDays: number;
  totalDebitsPaisa: number;
  totalDebitsDisplay: string;
  totalCreditsPaisa: number;
  totalCreditsDisplay: string;
  outstandingPaisa: number;
  outstandingDisplay: string;
  overdueAmountPaisa: number;
  overdueAmountDisplay: string;
  maxDaysOverdue: number;
  version: number;
}

export interface LedgerEntry {
  id: string;
  date: string;
  type: 'DEBIT' | 'CREDIT';
  description: string;
  referenceType: string | null;
  referenceId: string | null;
  gatePassNumber?: string;
  paymentMode?: string;
  chequeNumber?: string;
  amountPaisa: number;
  amountDisplay: string;
  paymentDueDate?: string;
  isOverdue?: boolean;
  daysOverdue?: number;
  runningBalancePaisa: number;
  runningBalanceDisplay: string;
}

export interface ClientLedgerData {
  client: { id: string; name: string; paymentCycleDays: number };
  summary: {
    totalDebitsPaisa: number;
    totalCreditsPaisa: number;
    outstandingPaisa: number;
  };
  entries: LedgerEntry[];
}

export interface ClientLedgerResponse {
  data: ClientLedgerData;
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export interface RecordPaymentPayload {
  amountPaisa: number;
  date: string;
  paymentMode: 'CASH' | 'CHEQUE' | 'BANK_TRANSFER';
  chequeNumber?: string;
  notes?: string;
}

export interface PaymentResult {
  id: string;
  journalEntryId: string;
  newOutstandingPaisa: number;
  newOutstandingDisplay: string;
}

export interface OverdueEntry {
  clientId: string;
  clientName: string;
  gatePassNumber: string;
  amountPaisa: number;
  amountDisplay: string;
  dueDate: string;
  daysOverdue: number;
}

export interface ClientRate {
  id: string;
  variant: { id: string; code: string; name: string };
  ratePerMeterPaisa: number;
  ratePerMeterDisplay: string;
  effectiveFrom: string;
  effectiveTo: string | null;
}

export interface UpdateRatePayload {
  variantId: string;
  newRatePerMeterPaisa: number;
}

export interface Voucher {
  id: string;
  voucherNumber: string;
  title: string;
  description: string | null;
  date: string;
  amountPaisa: number;
  amountDisplay: string;
  category: { id: string; name: string };
  paymentMode: string;
  chequeNumber: string | null;
  company: { id: string; name: string };
  approvalStatus: 'PENDING' | 'AUTO_APPROVED' | 'APPROVED' | 'REJECTED';
  createdBy: { id: string; name: string };
  createdAt: string;
  version: number;
}

export interface CreateVoucherPayload {
  title: string;
  description?: string;
  date: string;
  amountPaisa: number;
  categoryId: string;
  paymentMode: 'CASH' | 'CHEQUE';
  chequeNumber?: string;
  companyId: string;
}

export interface VoucherResult {
  id: string;
  voucherNumber: string;
  approvalStatus: string;
  requiresApproval: boolean;
  notificationSent: boolean;
  version: number;
}

export interface ApproveRejectPayload {
  action: 'APPROVE' | 'REJECT';
  comment?: string;
}

export interface MonthlyReportData {
  period: string;
  company: string;
  openingBalancePaisa: number;
  openingBalanceDisplay: string;
  inflowPaisa: number;
  inflowDisplay: string;
  inflowBreakdown: { clientPayments: number; scrapSales: number };
  outflowPaisa: number;
  outflowDisplay: string;
  outflowByCategory: {
    category: string;
    amountPaisa: number;
    amountDisplay: string;
  }[];
  closingBalancePaisa: number;
  closingBalanceDisplay: string;
}

// ─── Filters ────────────────────────────────────────────────────────────────

export interface ClientFilters {
  page?: number;
  limit?: number;
  search?: string;
  hasOverdue?: boolean;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface LedgerFilters {
  page?: number;
  limit?: number;
  dateFrom?: string;
  dateTo?: string;
  type?: 'DEBIT' | 'CREDIT';
}

export interface VoucherFilters {
  page?: number;
  limit?: number;
  categoryId?: string;
  companyId?: string;
  approvalStatus?: string;
  dateFrom?: string;
  dateTo?: string;
  paymentMode?: string;
}

// ─── API Methods ────────────────────────────────────────────────────────────

export const financeApi = {
  // Client Ledger
  getClients: (params: ClientFilters = {}) =>
    api
      .get<PaginatedResponse<ClientWithBalance>>('/finance/clients', { params })
      .then((r) => r.data),

  getClientLedger: (clientId: string, params: LedgerFilters = {}) =>
    api
      .get<ClientLedgerResponse>(`/finance/clients/${clientId}/ledger`, {
        params,
      })
      .then((r) => r.data),

  recordPayment: (clientId: string, data: RecordPaymentPayload) =>
    api
      .post<{ data: PaymentResult }>(
        `/finance/clients/${clientId}/payments`,
        data,
      )
      .then((r) => r.data),

  getOverdue: (sortBy?: string, sortOrder?: string) =>
    api
      .get<{ data: OverdueEntry[] }>('/finance/overdue', {
        params: { sortBy, sortOrder },
      })
      .then((r) => r.data),

  getClientRates: (clientId: string) =>
    api
      .get<{ data: ClientRate[] }>(`/finance/clients/${clientId}/rates`)
      .then((r) => r.data),

  updateClientRate: (clientId: string, data: UpdateRatePayload) =>
    api
      .put<{ data: ClientRate }>(`/finance/clients/${clientId}/rates`, data)
      .then((r) => r.data),

  downloadLedger: (clientId: string, format: 'pdf' | 'csv') =>
    api.get(`/finance/clients/${clientId}/ledger/download`, {
      params: { format },
      responseType: 'blob',
    }),

  // Vouchers
  getVouchers: (params: VoucherFilters = {}) =>
    api
      .get<PaginatedResponse<Voucher>>('/finance/vouchers', { params })
      .then((r) => r.data),

  createVoucher: (data: CreateVoucherPayload) =>
    api
      .post<{ data: VoucherResult }>('/finance/vouchers', data)
      .then((r) => r.data),

  approveOrRejectVoucher: (id: string, data: ApproveRejectPayload) =>
    api
      .patch<{ data: Voucher }>(`/finance/vouchers/${id}/approve`, data)
      .then((r) => r.data),

  // Reports
  getMonthlyReport: (year: number, month: number, companyId?: string) =>
    api
      .get<{ data: MonthlyReportData }>('/finance/reports/monthly', {
        params: { year, month, companyId },
      })
      .then((r) => r.data),

  // Lookups (for forms)
  getExpenseCategories: () =>
    api
      .get<{
        data: {
          id: string;
          name: string;
          children?: { id: string; name: string }[];
        }[];
      }>('/settings/expense-categories')
      .then((r) => r.data),

  getCompanies: () =>
    api
      .get<{ data: { id: string; name: string }[] }>('/settings/companies')
      .then((r) => r.data),
};
