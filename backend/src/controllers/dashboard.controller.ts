import { Response, NextFunction } from 'express';
import { dashboardService } from '../services/dashboard.service';
import { AuthenticatedRequest } from '../types';
import { stripFinancialFields } from '../utils/serializer';

export class DashboardController {
  async getKPIs(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const data = await dashboardService.getKPIs();
      res.json({ data });
    } catch (error) {
      next(error);
    }
  }

  async getProductionTrend(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { period, plantId, variantId } = req.query;
      const data = await dashboardService.getProductionTrend(
        (period as string) || '7d',
        plantId as string | undefined,
        variantId as string | undefined
      );
      res.json({ data });
    } catch (error) {
      next(error);
    }
  }

  async getShiftComparison(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { period, plantId } = req.query;
      const data = await dashboardService.getShiftComparison(
        (period as string) || '7d',
        plantId as string | undefined
      );
      res.json({ data });
    } catch (error) {
      next(error);
    }
  }

  async getRevenueOverview(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const year = parseInt(req.query.year as string) || new Date().getFullYear();
      const data = await dashboardService.getRevenueOverview(year);
      res.json({ data: stripFinancialFields(data as unknown as Record<string, unknown>, req.user!.role) });
    } catch (error) {
      next(error);
    }
  }

  async getStockLevels(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const data = await dashboardService.getStockLevels();
      res.json({ data });
    } catch (error) {
      next(error);
    }
  }

  async getOverduePayments(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const data = await dashboardService.getOverduePayments();
      res.json({ data: stripFinancialFields(data as unknown as Record<string, unknown>, req.user!.role) });
    } catch (error) {
      next(error);
    }
  }

  async getRecentActivity(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const data = await dashboardService.getRecentActivity(Math.min(100, Math.max(1, limit)));
      res.json({ data });
    } catch (error) {
      next(error);
    }
  }

  async getRecentGatePasses(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const data = await dashboardService.getRecentGatePasses(Math.min(100, Math.max(1, limit)));
      res.json({ data });
    } catch (error) {
      next(error);
    }
  }
}

export const dashboardController = new DashboardController();
