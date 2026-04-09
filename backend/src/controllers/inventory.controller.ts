import { Request, Response, NextFunction } from 'express';
import { PurchaseSource } from '@prisma/client';
import { inventoryService } from '../services/inventory.service';
import { AuthenticatedRequest } from '../types';

export class InventoryController {
  async getFinishedGoods(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { variantId, belowThreshold } = req.query;
      const result = await inventoryService.getFinishedGoods({
        variantId: variantId as string | undefined,
        belowThreshold: belowThreshold === 'true',
      });
      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  }

  async getRawMaterials(_req: Request, res: Response, next: NextFunction) {
    try {
      const result = await inventoryService.getRawMaterials();
      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  }

  async listPurchases(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { page, limit, grainTypeId, source, dateFrom, dateTo } = req.query;
      const result = await inventoryService.listPurchases({
        page: parseInt(page as string) || 1,
        limit: Math.min(100, Math.max(1, parseInt(limit as string) || 20)),
        grainTypeId: grainTypeId as string | undefined,
        source: source as PurchaseSource | undefined,
        dateFrom: dateFrom as string | undefined,
        dateTo: dateTo as string | undefined,
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async recordPurchase(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { grainTypeId, numberOfBags, ratePerBagPaisa, purchaseDate, source } = req.body;

      if (!grainTypeId || numberOfBags == null || ratePerBagPaisa == null || !purchaseDate || !source) {
        res.status(422).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Missing required fields: grainTypeId, numberOfBags, ratePerBagPaisa, purchaseDate, source',
          },
        });
        return;
      }

      const result = await inventoryService.recordPurchase(
        { grainTypeId, numberOfBags, ratePerBagPaisa, purchaseDate, source },
        req.user!.userId
      );

      res.status(201).json({ data: result });
    } catch (error) {
      next(error);
    }
  }

  async getConsumptionReport(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { period, grainTypeId, dateFrom, dateTo } = req.query;
      const result = await inventoryService.getConsumptionReport({
        period: period as string | undefined,
        grainTypeId: grainTypeId as string | undefined,
        dateFrom: dateFrom as string | undefined,
        dateTo: dateTo as string | undefined,
      });
      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  }

  async updateFinishedGoodsThreshold(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { threshold } = req.body;

      if (threshold == null || typeof threshold !== 'number') {
        res.status(422).json({
          error: { code: 'VALIDATION_ERROR', message: 'threshold (number) is required' },
        });
        return;
      }

      const result = await inventoryService.updateFinishedGoodsThreshold(
        req.params.id as string,
        threshold,
        req.user!.userId
      );

      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  }

  async updateRawMaterialThreshold(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { thresholdBags } = req.body;

      if (thresholdBags == null || typeof thresholdBags !== 'number') {
        res.status(422).json({
          error: { code: 'VALIDATION_ERROR', message: 'thresholdBags (number) is required' },
        });
        return;
      }

      const result = await inventoryService.updateRawMaterialThreshold(
        req.params.id as string,
        thresholdBags,
        req.user!.userId
      );

      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  }

  // ─── FIFO Batch endpoints ───────────────────────────────────────────────────

  async listBatches(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { grainTypeId, includeExhausted } = req.query;
      const result = await inventoryService.listBatches({
        grainTypeId: grainTypeId as string | undefined,
        includeExhausted: includeExhausted === 'true',
      });
      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  }

  // ─── Electricity Rate endpoints ─────────────────────────────────────────────

  async listElectricityRates(_req: Request, res: Response, next: NextFunction) {
    try {
      const result = await inventoryService.listElectricityRates();
      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  }

  async getCurrentElectricityRate(_req: Request, res: Response, next: NextFunction) {
    try {
      const result = await inventoryService.getCurrentElectricityRate();
      res.json({ data: result ?? null });
    } catch (error) {
      next(error);
    }
  }

  async createElectricityRate(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { ratePaisaPerUnit, effectiveFrom, notes } = req.body;

      if (ratePaisaPerUnit == null || !effectiveFrom) {
        res.status(422).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Missing required fields: ratePaisaPerUnit, effectiveFrom',
          },
        });
        return;
      }

      const result = await inventoryService.createElectricityRate(
        {
          ratePaisaPerUnit: BigInt(ratePaisaPerUnit),
          effectiveFrom: effectiveFrom as string,
          notes: notes as string | undefined,
        },
        req.user!.userId
      );

      res.status(201).json({ data: result });
    } catch (error) {
      next(error);
    }
  }
}

export const inventoryController = new InventoryController();
