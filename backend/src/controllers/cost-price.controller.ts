import { Response, NextFunction } from 'express';
import { costPriceService } from '../services/cost-price.service';
import { AuthenticatedRequest } from '../types';

export class CostPriceController {
  async getForEntry(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await costPriceService.calculateForEntry(req.params.id as string);
      if (!result) {
        res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Production entry not found or not completed' } });
        return;
      }
      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  }

  async listForPeriod(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { page, limit, dateFrom, dateTo, plantId, variantId } = req.query;
      const result = await costPriceService.listForPeriod({
        page: parseInt(page as string) || 1,
        limit: Math.min(100, Math.max(1, parseInt(limit as string) || 30)),
        dateFrom: dateFrom as string | undefined,
        dateTo: dateTo as string | undefined,
        plantId: plantId as string | undefined,
        variantId: variantId as string | undefined,
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async getMonthlySummary(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { year, plantId, variantId } = req.query;
      const result = await costPriceService.getMonthlySummary({
        year: parseInt(year as string) || new Date().getFullYear(),
        plantId: plantId as string | undefined,
        variantId: variantId as string | undefined,
      });
      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  }
}

export const costPriceController = new CostPriceController();
