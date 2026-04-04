import api from './api';

export interface WorkerSalaryInfo {
  id: string;
  name: string;
  cnic?: string;
  phone?: string;
  currentRate: number | null;
  rateEffectiveDate: string | null;
}

export interface WorkerAdvance {
  id: string;
  worker: { id: string; name: string };
  amount: number;
  date: string;
  reason?: string;
  isRecovered: boolean;
  recoveredAt?: string;
  createdAt: string;
}

export interface PayrollRecord {
  id: string;
  worker: { id: string; name: string };
  month: number;
  year: number;
  grossSalary: number;
  deductions: number;
  advanceDeduction: number;
  netSalary: number;
  paymentMode: string;
  journalEntry?: { id: string; entryNumber: string };
  createdAt: string;
}

export interface MonthlyPayrollSummary {
  month: number;
  year: number;
  totalWorkers: number;
  totalGross: number;
  totalDeductions: number;
  totalAdvanceDeductions: number;
  totalNet: number;
  records: PayrollRecord[];
}

export interface SetSalaryRatePayload {
  dailyRate: number;
  effectiveDate: string;
}

export interface CreateAdvancePayload {
  amount: number;
  date: string;
  reason?: string;
}

export interface CreatePayrollPayload {
  workerId: string;
  month: number;
  year: number;
  grossSalary: number;
  deductions?: number;
  advanceDeduction?: number;
  paymentMode?: string;
}

export const hrApi = {
  // Workers & salary rates
  listWorkers: () =>
    api.get<{ data: WorkerSalaryInfo[] }>('/hr/workers').then((r) => r.data),

  setSalaryRate: (workerId: string, payload: SetSalaryRatePayload) =>
    api.post<{ data: unknown }>(`/hr/workers/${workerId}/salary-rate`, payload).then((r) => r.data),

  // Advances
  listAdvances: (params?: { workerId?: string; recovered?: boolean }) =>
    api.get<{ data: WorkerAdvance[]; meta: { page: number; totalPages: number } }>('/hr/advances', { params }).then((r) => r.data),

  createAdvance: (workerId: string, payload: CreateAdvancePayload) =>
    api.post<{ data: WorkerAdvance }>(`/hr/workers/${workerId}/advances`, payload).then((r) => r.data),

  markAdvanceRecovered: (advanceId: string) =>
    api.post<{ data: unknown }>(`/hr/advances/${advanceId}/recover`, {}).then((r) => r.data),

  // Payroll
  listPayroll: (params?: { year?: number; month?: number; workerId?: string }) =>
    api.get<{ data: PayrollRecord[]; meta: { page: number; totalPages: number } }>('/hr/payroll', { params }).then((r) => r.data),

  getMonthlySummary: (year: number, month: number) =>
    api.get<{ data: MonthlyPayrollSummary }>(`/hr/payroll/${year}/${month}/summary`).then((r) => r.data),

  createPayroll: (payload: CreatePayrollPayload) =>
    api.post<{ data: PayrollRecord }>('/hr/payroll', payload).then((r) => r.data),
};
