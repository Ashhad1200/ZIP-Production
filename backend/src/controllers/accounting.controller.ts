import { Response, NextFunction } from 'express';
import { JournalEntryStatus } from '@prisma/client';
import { accountingService } from '../services/accounting.service';
import { AuthenticatedRequest } from '../types';

export class AccountingController {
  async listJournalEntries(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { page, limit, status, dateFrom, dateTo, referenceType, search } = req.query;
      const result = await accountingService.listJournalEntries({
        page: parseInt(page as string) || 1,
        limit: Math.min(100, Math.max(1, parseInt(limit as string) || 20)),
        status: status as JournalEntryStatus | undefined,
        dateFrom: dateFrom as string | undefined,
        dateTo: dateTo as string | undefined,
        referenceType: referenceType as string | undefined,
        search: search as string | undefined,
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async getGeneralLedger(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { dateFrom, dateTo, accountId } = req.query;
      if (!dateFrom || !dateTo) {
        res.status(422).json({
          error: { code: 'VALIDATION_ERROR', message: 'dateFrom and dateTo are required' },
        });
        return;
      }
      const result = await accountingService.getGeneralLedger({
        dateFrom: dateFrom as string,
        dateTo: dateTo as string,
        accountId: accountId as string | undefined,
      });
      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  }

  async getTrialBalance(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { dateFrom, dateTo } = req.query;
      if (!dateFrom || !dateTo) {
        res.status(422).json({
          error: { code: 'VALIDATION_ERROR', message: 'dateFrom and dateTo are required' },
        });
        return;
      }
      const result = await accountingService.getTrialBalance({
        dateFrom: dateFrom as string,
        dateTo: dateTo as string,
      });
      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  }

  async listAccounts(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await accountingService.listAccounts();
      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  }
}

export const accountingController = new AccountingController();
