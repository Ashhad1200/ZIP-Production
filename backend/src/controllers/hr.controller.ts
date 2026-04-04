import { Response, NextFunction } from 'express';
import { PaymentMode } from '@prisma/client';
import { hrService } from '../services/hr.service';
import { AuthenticatedRequest } from '../types';

export class HrController {
  // ── Workers with salary ───────────────────────────────────────────────────

  async listWorkersWithSalary(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const data = await hrService.listWorkersWithSalary();
      res.json({ data });
    } catch (e) { next(e); }
  }

  async getWorkerWithSalary(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const data = await hrService.getWorkerWithSalary(req.params.workerId as string);
      res.json({ data });
    } catch (e) { next(e); }
  }

  async setSalaryRate(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { monthlySalaryPaisa } = req.body as { monthlySalaryPaisa: number };
      if (!monthlySalaryPaisa || monthlySalaryPaisa <= 0) {
        res.status(422).json({ error: { message: 'monthlySalaryPaisa must be positive' } });
        return;
      }
      const data = await hrService.setSalaryRate(req.params.workerId as string, monthlySalaryPaisa, req.user!.userId);
      res.json({ data });
    } catch (e) { next(e); }
  }

  // ── Advances ──────────────────────────────────────────────────────────────

  async listAdvances(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { workerId, recovered } = req.query;
      const data = await hrService.listAdvances(
        workerId as string | undefined,
        recovered === 'true' ? true : recovered === 'false' ? false : undefined
      );
      res.json({ data });
    } catch (e) { next(e); }
  }

  async createAdvance(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { workerId } = req.params;
      const { amountPaisa, date, reason } = req.body as { amountPaisa: number; date: string; reason?: string };
      if (!amountPaisa || amountPaisa <= 0) {
        res.status(422).json({ error: { message: 'amountPaisa must be positive' } });
        return;
      }
      if (!date) {
        res.status(422).json({ error: { message: 'date is required' } });
        return;
      }
      const data = await hrService.createAdvance(workerId as string, { amountPaisa, date, reason }, req.user!.userId);
      res.status(201).json({ data });
    } catch (e) { next(e); }
  }

  async markAdvanceRecovered(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const data = await hrService.markAdvanceRecovered(req.params.advanceId as string, req.user!.userId);
      res.json({ data });
    } catch (e) { next(e); }
  }

  // ── Payroll ───────────────────────────────────────────────────────────────

  async listPayroll(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { month, year, workerId } = req.query;
      const data = await hrService.listPayroll({
        month: month ? parseInt(month as string) : undefined,
        year: year ? parseInt(year as string) : undefined,
        workerId: workerId as string | undefined,
      });
      res.json({ data });
    } catch (e) { next(e); }
  }

  async getMonthlyPayrollSummary(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const month = parseInt(req.params.month as string);
      const year = parseInt(req.params.year as string);
      if (isNaN(month) || month < 1 || month > 12 || isNaN(year)) {
        res.status(422).json({ error: { message: 'Invalid month or year' } });
        return;
      }
      const data = await hrService.getMonthlyPayrollSummary(month, year);
      res.json({ data });
    } catch (e) { next(e); }
  }

  async createPayroll(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const body = req.body as {
        workerId: string;
        month: number;
        year: number;
        grossSalaryPaisa: number;
        deductionsPaisa?: number;
        advanceDeductionPaisa?: number;
        paymentMode?: PaymentMode;
        chequeNumber?: string;
        notes?: string;
      };

      if (!body.workerId || !body.month || !body.year || !body.grossSalaryPaisa) {
        res.status(422).json({ error: { message: 'workerId, month, year and grossSalaryPaisa are required' } });
        return;
      }

      const data = await hrService.createPayroll(
        { ...body, paymentMode: body.paymentMode ?? PaymentMode.CASH },
        req.user!.userId
      );
      res.status(201).json({ data });
    } catch (e) { next(e); }
  }
}

export const hrController = new HrController();
