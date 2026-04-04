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
  listWorkers: (): Promise<{ data: WorkerSalaryInfo[] }> =>
    api.get('/hr/workers'),

  setSalaryRate: (workerId: string, payload: SetSalaryRatePayload): Promise<{ data: unknown }> =>
    api.post(`/hr/workers/${workerId}/salary-rate`, payload),

  // Advances
  listAdvances: (params?: { workerId?: string; recovered?: boolean }): Promise<{ data: WorkerAdvance[]; meta: { page: number; totalPages: number } }> =>
    api.get('/hr/advances', { params }),

  createAdvance: (workerId: string, payload: CreateAdvancePayload): Promise<{ data: WorkerAdvance }> =>
    api.post(`/hr/workers/${workerId}/advances`, payload),

  markAdvanceRecovered: (advanceId: string): Promise<{ data: unknown }> =>
    api.post(`/hr/advances/${advanceId}/recover`, {}),

  // Payroll
  listPayroll: (params?: { year?: number; month?: number; workerId?: string }): Promise<{ data: PayrollRecord[]; meta: { page: number; totalPages: number } }> =>
    api.get('/hr/payroll', { params }),

  getMonthlySummary: (year: number, month: number): Promise<{ data: MonthlyPayrollSummary }> =>
    api.get(`/hr/payroll/${year}/${month}/summary`),

  createPayroll: (payload: CreatePayrollPayload): Promise<{ data: PayrollRecord }> =>
    api.post('/hr/payroll', payload),
};
