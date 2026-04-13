import api from './api';

export interface MonthlyOverheadDisplay {
  id: string;
  year: number;
  month: number;
  monthLabel: string;
  laborPaisa: string;
  rentPaisa: string;
  transportationPaisa: string;
  packingPaisa: string;
  miscellaneousPaisa: string;
  totalPaisa: string;
  laborDisplay: string;
  rentDisplay: string;
  transportationDisplay: string;
  packingDisplay: string;
  miscellaneousDisplay: string;
  totalDisplay: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MonthlyOverheadInput {
  year: number;
  month: number;
  laborPaisa: number;
  rentPaisa: number;
  transportationPaisa: number;
  packingPaisa: number;
  miscellaneousPaisa: number;
  notes?: string;
}

export interface MonthlyOverheadListResponse {
  data: MonthlyOverheadDisplay[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export const monthlyOverheadApi = {
  list: (params: { page?: number; limit?: number } = {}) =>
    api.get<MonthlyOverheadListResponse>('/monthly-overheads', { params }).then((r) => r.data),

  getForMonth: (year: number, month: number) =>
    api.get<{ data: MonthlyOverheadDisplay | null }>(`/monthly-overheads/${year}/${month}`).then((r) => r.data),

  upsert: (input: MonthlyOverheadInput) =>
    api.put<{ data: MonthlyOverheadDisplay }>('/monthly-overheads', input).then((r) => r.data),

  delete: (id: string) =>
    api.delete(`/monthly-overheads/${id}`).then((r) => r.data),
};
