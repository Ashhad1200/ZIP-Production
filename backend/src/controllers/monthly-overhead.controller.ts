import { Request, Response, NextFunction } from 'express';
import { monthlyOverheadService } from '../services/monthly-overhead.service';

export class MonthlyOverheadController {
  async upsert(req: Request, res: Response, next: NextFunction) {
    try {
      const { year, month, laborPaisa, rentPaisa, transportationPaisa, packingPaisa, miscellaneousPaisa, notes } = req.body;

      if (!year || !month || Number(month) < 1 || Number(month) > 12) {
        res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Valid year and month (1-12) are required' } });
        return;
      }

      const result = await monthlyOverheadService.upsert({
        year: Number(year),
        month: Number(month),
        laborPaisa: laborPaisa ? Math.round(Number(laborPaisa)) : 0,
        rentPaisa: rentPaisa ? Math.round(Number(rentPaisa)) : 0,
        transportationPaisa: transportationPaisa ? Math.round(Number(transportationPaisa)) : 0,
        packingPaisa: packingPaisa ? Math.round(Number(packingPaisa)) : 0,
        miscellaneousPaisa: miscellaneousPaisa ? Math.round(Number(miscellaneousPaisa)) : 0,
        notes,
      });

      res.status(200).json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  async getForMonth(req: Request, res: Response, next: NextFunction) {
    try {
      const year = parseInt(req.params['year'] as string);
      const month = parseInt(req.params['month'] as string);
      if (!year || !month) {
        res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'year and month params required' } });
        return;
      }
      const result = await monthlyOverheadService.getForMonth(year, month);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query['page'] as string) || 1;
      const limit = parseInt(req.query['limit'] as string) || 24;
      const result = await monthlyOverheadService.list({ page, limit });
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  async remove(req: Request, res: Response, next: NextFunction) {
    try {
      await monthlyOverheadService.delete(req.params['id'] as string);
      res.json({ data: { message: 'Deleted' } });
    } catch (err) {
      next(err);
    }
  }
}

export const monthlyOverheadController = new MonthlyOverheadController();
