import { Request, Response, NextFunction } from 'express';
import { Shift } from '@prisma/client';
import { productionService } from '../services/production.service';
import { AuthenticatedRequest } from '../types';

export class ProductionController {
  async listEntries(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const {
        page, limit, plantId, shift, dateFrom, dateTo, variantId, sortBy, sortOrder,
      } = req.query;

      const result = await productionService.listEntries({
        page: parseInt(page as string) || 1,
        limit: Math.min(100, Math.max(1, parseInt(limit as string) || 20)),
        plantId: plantId as string | undefined,
        shift: shift as Shift | undefined,
        dateFrom: dateFrom as string | undefined,
        dateTo: dateTo as string | undefined,
        variantId: variantId as string | undefined,
        sortBy: (sortBy as string) || 'date',
        sortOrder: ((sortOrder as string) || 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc',
      });

      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async createEntry(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const {
        plantId, machineId, shift, date, variantId, variants,
        electricityStartReading, workers, workerIds,
      } = req.body;

      if (!plantId || !shift || !date) {
        res.status(422).json({
          error: { code: 'VALIDATION_ERROR', message: 'Missing required fields: plantId, shift, date. Provide variantId (single) or variants[] (multi).' },
        });
        return;
      }

      const result = await productionService.createEntry(
        { plantId, machineId, shift, date, variantId, variants, electricityStartReading, workers, workerIds },
        req.user!.userId
      );

      res.status(201).json({ data: result });
    } catch (error) {
      next(error);
    }
  }

  async completeEntry(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { variants, metersProduced, gramsPerMeter, electricityEndReading, scrapWeightGrams } = req.body;

      // Must provide either variants[] or flat metersProduced+gramsPerMeter
      if (!variants?.length && (metersProduced == null || gramsPerMeter == null)) {
        res.status(422).json({
          error: { code: 'VALIDATION_ERROR', message: 'Provide variants[] for multi-variant or metersProduced+gramsPerMeter for single-variant completion.' },
        });
        return;
      }

      const result = await productionService.completeEntry(
        String(req.params.id),
        { variants, metersProduced, gramsPerMeter, electricityEndReading, scrapWeightGrams },
        req.user!.userId
      );

      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  }

  async getEntry(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await productionService.getEntryById(req.params.id as string);
      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  }

  async updateEntry(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const ifMatch = req.headers['if-match'];
      if (!ifMatch) {
        res.status(428).json({
          error: { code: 'PRECONDITION_REQUIRED', message: 'If-Match header is required' },
        });
        return;
      }

      const expectedVersion = parseInt(ifMatch as string, 10);
      if (isNaN(expectedVersion)) {
        res.status(422).json({
          error: { code: 'VALIDATION_ERROR', message: 'If-Match header must be a valid version number' },
        });
        return;
      }

      const result = await productionService.updateEntry(
        req.params.id as string,
        req.body,
        expectedVersion,
        req.user!.userId
      );

      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  }

  async getDPR(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { date, plantId } = req.query;
      const result = await productionService.getDPR({
        date: date as string | undefined,
        plantId: plantId as string | undefined,
      });
      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  }

  async listScrapSales(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { page, limit, plantId, dateFrom, dateTo } = req.query;
      const result = await productionService.listScrapSales({
        page: parseInt(page as string) || 1,
        limit: Math.min(100, Math.max(1, parseInt(limit as string) || 20)),
        plantId: plantId as string | undefined,
        dateFrom: dateFrom as string | undefined,
        dateTo: dateTo as string | undefined,
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async createScrapSale(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { date, totalWeightKg, ratePerKgPaisa, buyerName, plantId } = req.body;

      if (!date || totalWeightKg == null || ratePerKgPaisa == null) {
        res.status(422).json({
          error: { code: 'VALIDATION_ERROR', message: 'Missing required fields: date, totalWeightKg, ratePerKgPaisa' },
        });
        return;
      }

      const result = await productionService.createScrapSale(
        { date, totalWeightKg, ratePerKgPaisa, buyerName, plantId },
        req.user!.userId
      );

      res.status(201).json({ data: result });
    } catch (error) {
      next(error);
    }
  }

  async listDiscrepancies(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { page, limit, plantId, dateFrom, dateTo } = req.query;
      const result = await productionService.listDiscrepancies({
        page: parseInt(page as string) || 1,
        limit: Math.min(100, Math.max(1, parseInt(limit as string) || 20)),
        plantId: plantId as string | undefined,
        dateFrom: dateFrom as string | undefined,
        dateTo: dateTo as string | undefined,
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async getPlants(_req: Request, res: Response, next: NextFunction) {
    try {
      const plants = await productionService.getPlants();
      res.json({ data: plants });
    } catch (error) {
      next(error);
    }
  }

  async getWorkers(req: Request, res: Response, next: NextFunction) {
    try {
      const workers = await productionService.getWorkers(req.query.plantId as string | undefined);
      res.json({ data: workers });
    } catch (error) {
      next(error);
    }
  }

  async getVariants(_req: Request, res: Response, next: NextFunction) {
    try {
      const variants = await productionService.getVariants();
      res.json({ data: variants });
    } catch (error) {
      next(error);
    }
  }
}

export const productionController = new ProductionController();
