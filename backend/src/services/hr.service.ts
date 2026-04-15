import prisma from '../config/database';
import { PaymentMode, Prisma, Role } from '@prisma/client';
import { formatPaisaToRupees } from '../utils/currency';
import { generateSequenceNumber } from '../utils/sequence';
import { auditService } from './audit.service';
import { accountingService } from './accounting.service';
import { AuditAction } from '@prisma/client';

const SALARY_EXPENSE_ACCOUNT_CODE = '5050';

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function ensureSalaryAccount(userId: string): Promise<string> {
  let account = await prisma.account.findUnique({ where: { code: SALARY_EXPENSE_ACCOUNT_CODE } });
  if (!account) {
    const parent = await prisma.account.findUnique({ where: { code: '5000' } });
    account = await prisma.account.create({
      data: {
        code: SALARY_EXPENSE_ACCOUNT_CODE,
        name: 'Salary & Wages',
        accountType: 'EXPENSE',
        isGroup: false,
        parentId: parent?.id ?? null,
        createdBy: userId,
      },
    });
  }
  return account.id;
}

async function getCashAccountId(): Promise<string> {
  const account = await prisma.account.findUnique({ where: { code: '1100' } });
  if (!account) throw Object.assign(new Error('Cash account (1100) not found'), { statusCode: 500, code: 'ACCOUNT_NOT_FOUND' });
  return account.id;
}

// ─── Service ─────────────────────────────────────────────────────────────────

export class HrService {
  // ── Salary Rates ──────────────────────────────────────────────────────────

  async setSalaryRate(workerId: string, monthlySalaryPaisa: number, userId: string) {
    const worker = await prisma.worker.findUnique({ where: { id: workerId, isDeleted: false } });
    if (!worker) throw Object.assign(new Error('Worker not found'), { statusCode: 404 });

    // Deactivate existing active rates
    await prisma.workerSalaryRate.updateMany({
      where: { workerId, isActive: true },
      data: { isActive: false },
    });

    const rate = await prisma.workerSalaryRate.create({
      data: {
        workerId,
        monthlySalaryPaisa: BigInt(monthlySalaryPaisa),
        effectiveFrom: new Date(),
        isActive: true,
        createdBy: userId,
      },
    });

    await auditService.log({ entityType: 'WorkerSalaryRate', entityId: rate.id, action: AuditAction.CREATE, newValue: { workerId, monthlySalaryPaisa }, userId });

    return {
      id: rate.id,
      workerId,
      monthlySalaryPaisa: rate.monthlySalaryPaisa.toString(),
      monthlySalaryDisplay: formatPaisaToRupees(rate.monthlySalaryPaisa),
      effectiveFrom: rate.effectiveFrom.toISOString(),
    };
  }

  async getWorkerWithSalary(workerId: string) {
    const worker = await prisma.worker.findUnique({
      where: { id: workerId, isDeleted: false },
      include: {
        plant: { select: { id: true, name: true } },
        salaryRates: { where: { isActive: true }, take: 1 },
      },
    });
    if (!worker) throw Object.assign(new Error('Worker not found'), { statusCode: 404 });

    const activeRate = worker.salaryRates[0];
    return {
      id: worker.id,
      name: worker.name,
      designation: worker.designation,
      plant: worker.plant,
      isActive: worker.isActive,
      currentSalaryPaisa: activeRate ? activeRate.monthlySalaryPaisa.toString() : null,
      currentSalaryDisplay: activeRate ? formatPaisaToRupees(activeRate.monthlySalaryPaisa) : 'Not Set',
    };
  }

  async listWorkersWithSalary() {
    const workers = await prisma.worker.findMany({
      where: { isDeleted: false },
      include: {
        plant: { select: { id: true, name: true } },
        salaryRates: { where: { isActive: true }, take: 1 },
      },
      orderBy: { name: 'asc' },
    });

    return workers.map((w) => {
      const activeRate = w.salaryRates[0];
      return {
        id: w.id,
        name: w.name,
        designation: w.designation,
        plant: w.plant,
        isActive: w.isActive,
        currentSalaryPaisa: activeRate ? activeRate.monthlySalaryPaisa.toString() : null,
        currentSalaryDisplay: activeRate ? formatPaisaToRupees(activeRate.monthlySalaryPaisa) : 'Not Set',
      };
    });
  }

  // ── Advances ──────────────────────────────────────────────────────────────

  async createAdvance(workerId: string, input: { amountPaisa: number; date: string; reason?: string }, userId: string) {
    const worker = await prisma.worker.findUnique({ where: { id: workerId, isDeleted: false } });
    if (!worker) throw Object.assign(new Error('Worker not found'), { statusCode: 404 });

    const advance = await prisma.workerAdvance.create({
      data: {
        workerId,
        amountPaisa: BigInt(input.amountPaisa),
        date: new Date(input.date + 'T00:00:00.000Z'),
        reason: input.reason,
        createdBy: userId,
      },
    });

    await auditService.log({ entityType: 'WorkerAdvance', entityId: advance.id, action: AuditAction.CREATE, newValue: { workerId, amountPaisa: input.amountPaisa }, userId });

    return {
      id: advance.id,
      workerId,
      amountPaisa: advance.amountPaisa.toString(),
      amountDisplay: formatPaisaToRupees(advance.amountPaisa),
      date: input.date,
      reason: advance.reason,
      isRecovered: false,
    };
  }

  async listAdvances(workerId?: string, recovered?: boolean) {
    const where: Prisma.WorkerAdvanceWhereInput = {};
    if (workerId) where.workerId = workerId;
    if (recovered !== undefined) where.isRecovered = recovered;

    const advances = await prisma.workerAdvance.findMany({
      where,
      include: { worker: { select: { id: true, name: true } } },
      orderBy: { date: 'desc' },
    });

    return advances.map((a) => ({
      id: a.id,
      worker: a.worker,
      amountPaisa: a.amountPaisa.toString(),
      amountDisplay: formatPaisaToRupees(a.amountPaisa),
      date: a.date.toISOString().split('T')[0],
      reason: a.reason,
      isRecovered: a.isRecovered,
      recoveredAt: a.recoveredAt?.toISOString() ?? null,
    }));
  }

  async markAdvanceRecovered(id: string, userId: string) {
    const advance = await prisma.workerAdvance.findUnique({ where: { id } });
    if (!advance) throw Object.assign(new Error('Advance not found'), { statusCode: 404 });
    if (advance.isRecovered) throw Object.assign(new Error('Already recovered'), { statusCode: 422 });

    const updated = await prisma.workerAdvance.update({
      where: { id },
      data: { isRecovered: true, recoveredAt: new Date() },
    });

    await auditService.log({ entityType: 'WorkerAdvance', entityId: id, action: AuditAction.SOFT_DELETE, newValue: { isRecovered: true }, userId });
    return { id: updated.id, isRecovered: true, recoveredAt: updated.recoveredAt?.toISOString() };
  }

  // ── Payroll ───────────────────────────────────────────────────────────────

  async createPayroll(
    input: {
      workerId: string;
      month: number;
      year: number;
      grossSalaryPaisa: number;
      deductionsPaisa?: number;
      advanceDeductionPaisa?: number;
      paymentMode: PaymentMode;
      chequeNumber?: string;
      notes?: string;
    },
    userId: string
  ) {
    const worker = await prisma.worker.findUnique({
      where: { id: input.workerId, isDeleted: false },
      select: { id: true, name: true },
    });
    if (!worker) throw Object.assign(new Error('Worker not found'), { statusCode: 404 });

    const existing = await prisma.payrollRecord.findUnique({
      where: { workerId_month_year: { workerId: input.workerId, month: input.month, year: input.year } },
    });
    if (existing) throw Object.assign(new Error(`Payroll for ${worker.name} in ${input.month}/${input.year} already exists`), { statusCode: 409 });

    const grossSalaryPaisa = BigInt(input.grossSalaryPaisa);
    const deductionsPaisa = BigInt(input.deductionsPaisa ?? 0);
    const advanceDeductionPaisa = BigInt(input.advanceDeductionPaisa ?? 0);
    const netSalaryPaisa = grossSalaryPaisa - deductionsPaisa - advanceDeductionPaisa;

    if (netSalaryPaisa < 0n) {
      throw Object.assign(new Error('Net salary cannot be negative'), { statusCode: 422 });
    }

    // Ensure salary expense account exists
    const salaryAccountId = await ensureSalaryAccount(userId);
    const cashAccountId = await getCashAccountId();

    const entryNumber = await generateSequenceNumber('PAY', 'journalEntry');
    const entryDate = new Date(input.year, input.month - 1, 28); // end of month

    const journalEntry = await accountingService.createJournalEntry({
      entryNumber,
      entryDate,
      description: `Payroll — ${worker.name} — ${input.month}/${input.year}`,
      referenceType: 'Payroll',
      lines: [
        { accountId: salaryAccountId, debitAmountPaisa: netSalaryPaisa, creditAmountPaisa: 0n, description: `Salary: ${worker.name}` },
        { accountId: cashAccountId, debitAmountPaisa: 0n, creditAmountPaisa: netSalaryPaisa, description: `Payroll payment: ${worker.name}` },
      ],
      userId,
      autoPost: true,
    });

    const record = await prisma.payrollRecord.create({
      data: {
        workerId: input.workerId,
        month: input.month,
        year: input.year,
        grossSalaryPaisa,
        deductionsPaisa,
        advanceDeductionPaisa,
        netSalaryPaisa,
        paymentMode: input.paymentMode,
        chequeNumber: input.chequeNumber,
        notes: input.notes,
        journalEntryId: journalEntry.id,
        createdBy: userId,
      },
    });

    await auditService.log({ entityType: 'PayrollRecord', entityId: record.id, action: AuditAction.CREATE, newValue: { workerId: input.workerId, month: input.month, year: input.year, netSalaryPaisa: netSalaryPaisa.toString() }, userId });

    return this.serializePayroll(record, worker);
  }

  async listPayroll(params: { month?: number; year?: number; workerId?: string }) {
    const where: Prisma.PayrollRecordWhereInput = {};
    if (params.month) where.month = params.month;
    if (params.year) where.year = params.year;
    if (params.workerId) where.workerId = params.workerId;

    const records = await prisma.payrollRecord.findMany({
      where,
      include: { worker: { select: { id: true, name: true, designation: true } } },
      orderBy: [{ year: 'desc' }, { month: 'desc' }, { worker: { name: 'asc' } }],
    });

    return records.map((r) => this.serializePayroll(r, r.worker));
  }

  async getMonthlyPayrollSummary(month: number, year: number) {
    const records = await prisma.payrollRecord.findMany({
      where: { month, year },
      include: { worker: { select: { id: true, name: true, designation: true } } },
    });

    const totalGross = records.reduce((s, r) => s + r.grossSalaryPaisa, 0n);
    const totalDeductions = records.reduce((s, r) => s + r.deductionsPaisa + r.advanceDeductionPaisa, 0n);
    const totalNet = records.reduce((s, r) => s + r.netSalaryPaisa, 0n);

    return {
      month,
      year,
      workerCount: records.length,
      totalGrossPaisa: totalGross.toString(),
      totalGrossDisplay: formatPaisaToRupees(totalGross),
      totalDeductionsPaisa: totalDeductions.toString(),
      totalDeductionsDisplay: formatPaisaToRupees(totalDeductions),
      totalNetPaisa: totalNet.toString(),
      totalNetDisplay: formatPaisaToRupees(totalNet),
      records: records.map((r) => this.serializePayroll(r, r.worker)),
    };
  }

  private serializePayroll(record: { id: string; month: number; year: number; grossSalaryPaisa: bigint; deductionsPaisa: bigint; advanceDeductionPaisa: bigint; netSalaryPaisa: bigint; paymentMode: PaymentMode; chequeNumber: string | null; notes: string | null; createdAt: Date; journalEntryId: string | null }, worker: { id: string; name: string; designation?: string | null }) {
    return {
      id: record.id,
      worker: { id: worker.id, name: worker.name, designation: worker.designation },
      month: record.month,
      year: record.year,
      grossSalaryPaisa: record.grossSalaryPaisa.toString(),
      grossSalaryDisplay: formatPaisaToRupees(record.grossSalaryPaisa),
      deductionsPaisa: record.deductionsPaisa.toString(),
      advanceDeductionPaisa: record.advanceDeductionPaisa.toString(),
      netSalaryPaisa: record.netSalaryPaisa.toString(),
      netSalaryDisplay: formatPaisaToRupees(record.netSalaryPaisa),
      paymentMode: record.paymentMode,
      chequeNumber: record.chequeNumber,
      notes: record.notes,
      journalEntryId: record.journalEntryId,
      createdAt: record.createdAt.toISOString(),
    };
  }
}

export const hrService = new HrService();
