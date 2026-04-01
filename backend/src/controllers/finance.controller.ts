import { Response, NextFunction } from 'express';
import { ApprovalStatus, PaymentMode } from '@prisma/client';
import { financeService } from '../services/finance.service';
import { AuthenticatedRequest } from '../types';

export class FinanceController {
  // ═══════════════════════════════════════════════════════════════════════════
  //  CLIENT LEDGER
  // ═══════════════════════════════════════════════════════════════════════════

  async listClients(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { page, limit, search, hasOverdue, sortBy, sortOrder } = req.query;
      const result = await financeService.listClientsWithBalances({
        page: parseInt(page as string) || 1,
        limit: Math.min(100, Math.max(1, parseInt(limit as string) || 20)),
        search: search as string | undefined,
        hasOverdue: hasOverdue === 'true',
        sortBy: sortBy as string | undefined,
        sortOrder: (sortOrder as 'asc' | 'desc') || 'asc',
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async getClientLedger(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { clientId } = req.params;
      const { page, limit, dateFrom, dateTo, type } = req.query;
      const result = await financeService.getClientLedger(clientId as string, {
        page: parseInt(page as string) || 1,
        limit: Math.min(100, Math.max(1, parseInt(limit as string) || 20)),
        dateFrom: dateFrom as string | undefined,
        dateTo: dateTo as string | undefined,
        type: type as string | undefined,
      });
      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  }

  async getLedgerDownload(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { clientId } = req.params;
      const format = (req.query.format as string) || 'csv';
      if (format !== 'csv' && format !== 'pdf') {
        res.status(422).json({
          error: { code: 'VALIDATION_ERROR', message: 'format must be "csv" or "pdf"' },
        });
        return;
      }
      const result = await financeService.getLedgerDownloadData(clientId as string, format);
      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  }

  async recordPayment(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { clientId } = req.params;
      const { amountPaisa, date, paymentMode, chequeNumber, notes } = req.body;

      if (amountPaisa == null || !date || !paymentMode) {
        res.status(422).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Missing required fields: amountPaisa, date, paymentMode',
          },
        });
        return;
      }

      const result = await financeService.recordPayment(
        clientId as string,
        {
          amountPaisa: BigInt(amountPaisa),
          date,
          paymentMode: paymentMode as PaymentMode,
          chequeNumber,
          notes,
        },
        req.user!.userId,
      );

      res.status(201).json({ data: result });
    } catch (error) {
      next(error);
    }
  }

  async getOverduePayments(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { sortBy, sortOrder } = req.query;
      const result = await financeService.getOverduePayments(
        sortBy as string | undefined,
        (sortOrder as 'asc' | 'desc') || undefined,
      );
      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  }

  async getClientRates(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { clientId } = req.params;
      const result = await financeService.getClientRates(clientId as string);
      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  }

  async updateClientRate(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { clientId } = req.params;
      const { variantId, newRatePerMeterPaisa } = req.body;

      if (!variantId || newRatePerMeterPaisa == null) {
        res.status(422).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Missing required fields: variantId, newRatePerMeterPaisa',
          },
        });
        return;
      }

      const result = await financeService.updateClientRate(
        clientId as string,
        variantId,
        BigInt(newRatePerMeterPaisa),
        req.user!.userId,
      );
      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  VOUCHERS
  // ═══════════════════════════════════════════════════════════════════════════

  async listVouchers(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { page, limit, categoryId, companyId, approvalStatus, dateFrom, dateTo, paymentMode } =
        req.query;
      const result = await financeService.listVouchers({
        page: parseInt(page as string) || 1,
        limit: Math.min(100, Math.max(1, parseInt(limit as string) || 20)),
        categoryId: categoryId as string | undefined,
        companyId: companyId as string | undefined,
        approvalStatus: approvalStatus as ApprovalStatus | undefined,
        dateFrom: dateFrom as string | undefined,
        dateTo: dateTo as string | undefined,
        paymentMode: paymentMode as PaymentMode | undefined,
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async createVoucher(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { title, description, date, amountPaisa, categoryId, paymentMode, chequeNumber, companyId } =
        req.body;

      if (!title || !date || amountPaisa == null || !categoryId || !paymentMode || !companyId) {
        res.status(422).json({
          error: {
            code: 'VALIDATION_ERROR',
            message:
              'Missing required fields: title, date, amountPaisa, categoryId, paymentMode, companyId',
          },
        });
        return;
      }

      const result = await financeService.createVoucher(
        {
          title,
          description,
          date,
          amountPaisa: BigInt(amountPaisa),
          categoryId,
          paymentMode: paymentMode as PaymentMode,
          chequeNumber,
          companyId,
        },
        req.user!.userId,
      );

      res.status(201).json({ data: result });
    } catch (error) {
      next(error);
    }
  }

  async approveOrRejectVoucher(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { action, comment } = req.body;

      if (!action || (action !== 'APPROVE' && action !== 'REJECT')) {
        res.status(422).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'action must be "APPROVE" or "REJECT"',
          },
        });
        return;
      }

      const result = await financeService.approveOrRejectVoucher(
        id as string,
        action,
        comment,
        req.user!.userId,
      );
      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  REPORTS
  // ═══════════════════════════════════════════════════════════════════════════

  async getMonthlyReport(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { year, month, companyId } = req.query;

      if (!year || !month) {
        res.status(422).json({
          error: { code: 'VALIDATION_ERROR', message: 'year and month query params are required' },
        });
        return;
      }

      const result = await financeService.getMonthlyReport(
        parseInt(year as string),
        parseInt(month as string),
        companyId as string | undefined,
      );
      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  }
}

export const financeController = new FinanceController();
