import api from './api';

// ── Response types (matching backend exactly) ──────────────────────────────────

export interface WorkerSalaryInfo {
  id: string;
  name: string;
  designation?: string | null;
  plant?: { id: string; name: string } | null;
  isActive: boolean;
  /** BigInt serialised as string, e.g. "2500000" (= PKR 25,000.00) */
  currentSalaryPaisa: string | null;
  /** Pre-formatted display string, e.g. "PKR 25,000.00" or "Not Set" */
  currentSalaryDisplay: string;
}

export interface WorkerAdvance {
  id: string;
  worker: { id: string; name: string };
  amountPaisa: string;
  amountDisplay: string;
  date: string;
  reason?: string | null;
  isRecovered: boolean;
  recoveredAt?: string | null;
}

export interface PayrollRecord {
  id: string;
  worker: { id: string; name: string; designation?: string | null };
  month: number;
  year: number;
  grossSalaryPaisa: string;
  grossSalaryDisplay: string;
  deductionsPaisa: string;
  advanceDeductionPaisa: string;
  netSalaryPaisa: string;
  netSalaryDisplay: string;
  paymentMode: string;
  chequeNumber?: string | null;
  notes?: string | null;
  journalEntryId?: string | null;
  createdAt: string;
}

export interface MonthlyPayrollSummary {
  month: number;
  year: number;
  workerCount: number;
  totalGrossPaisa: string;
  totalGrossDisplay: string;
  totalDeductionsPaisa: string;
  totalDeductionsDisplay: string;
  totalNetPaisa: string;
  totalNetDisplay: string;
  records: PayrollRecord[];
}

// ── Input types (user enters PKR; API functions convert to paisa before sending) ──

export interface SetSalaryRatePayload {
  /** Monthly salary in PKR (whole rupees) */
  monthlySalaryPkr: number;
}

export interface CreateAdvancePayload {
  /** Amount in PKR */
  amount: number;
  date: string;
  reason?: string;
}

export interface CreatePayrollPayload {
  workerId: string;
  month: number;
  year: number;
  /** Gross salary in PKR */
  grossSalary: number;
  /** Other deductions in PKR */
  deductions?: number;
  /** Advance recovery deduction in PKR */
  advanceDeduction?: number;
  paymentMode?: string;
}

// ── API functions ──────────────────────────────────────────────────────────────

export const hrApi = {
  // Workers & salary rates
  listWorkers: () =>
    api.get<{ data: WorkerSalaryInfo[] }>('/hr/workers').then((r) => r.data),

  setSalaryRate: (workerId: string, payload: SetSalaryRatePayload) =>
    api
      .post<{ data: unknown }>(`/hr/workers/${workerId}/salary-rate`, {
        monthlySalaryPaisa: Math.round(payload.monthlySalaryPkr * 100),
      })
      .then((r) => r.data),

  // Advances
  listAdvances: (params?: { workerId?: string; recovered?: boolean }) =>
    api.get<{ data: WorkerAdvance[] }>('/hr/advances', { params }).then((r) => r.data),

  createAdvance: (workerId: string, payload: CreateAdvancePayload) =>
    api
      .post<{ data: WorkerAdvance }>(`/hr/workers/${workerId}/advances`, {
        amountPaisa: Math.round(payload.amount * 100),
        date: payload.date,
        reason: payload.reason,
      })
      .then((r) => r.data),

  markAdvanceRecovered: (advanceId: string) =>
    api.post<{ data: unknown }>(`/hr/advances/${advanceId}/recover`, {}).then((r) => r.data),

  // Payroll
  listPayroll: (params?: { year?: number; month?: number; workerId?: string }) =>
    api.get<{ data: PayrollRecord[] }>('/hr/payroll', { params }).then((r) => r.data),

  getMonthlySummary: (year: number, month: number) =>
    api.get<{ data: MonthlyPayrollSummary }>(`/hr/payroll/${year}/${month}/summary`).then((r) => r.data),

  createPayroll: (payload: CreatePayrollPayload) =>
    api
      .post<{ data: PayrollRecord }>('/hr/payroll', {
        workerId: payload.workerId,
        month: payload.month,
        year: payload.year,
        grossSalaryPaisa: Math.round(payload.grossSalary * 100),
        deductionsPaisa: Math.round((payload.deductions ?? 0) * 100),
        advanceDeductionPaisa: Math.round((payload.advanceDeduction ?? 0) * 100),
        paymentMode: payload.paymentMode ?? 'CASH',
      })
      .then((r) => r.data),
};

