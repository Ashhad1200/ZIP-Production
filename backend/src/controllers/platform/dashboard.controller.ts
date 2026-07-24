import { Request, Response, NextFunction } from 'express';
import { subscriptionService } from '../../services/platform/subscription.service';

export class PlatformDashboardController {
  async summary(_req: Request, res: Response, next: NextFunction) {
    try {
      res.json({ data: await subscriptionService.dashboardSummary() });
    } catch (error) {
      next(error);
    }
  }
}

export const platformDashboardController = new PlatformDashboardController();
