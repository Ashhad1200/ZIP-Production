import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types';
import { packagingService } from '../services/packaging.service';

export class PackagingController {
  async listMaterials(_req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const data = await packagingService.listMaterials();
      res.json({ data });
    } catch (error) { next(error); }
  }

  async createMaterial(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { name, unit, ratePerUnitPaisa, lowStockThreshold, notes } = req.body;
      if (!name) {
        res.status(422).json({ error: { code: 'VALIDATION_ERROR', message: 'name is required' } });
        return;
      }
      const data = await packagingService.createMaterial({ name, unit, ratePerUnitPaisa, lowStockThreshold, notes });
      res.status(201).json({ data });
    } catch (error) { next(error); }
  }

  async updateMaterial(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const { name, unit, ratePerUnitPaisa, lowStockThreshold, notes, isActive } = req.body;
      const data = await packagingService.updateMaterial(id, { name, unit, ratePerUnitPaisa, lowStockThreshold, notes, isActive });
      res.json({ data });
    } catch (error) { next(error); }
  }

  async recordAdjustment(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const materialId = req.params.id as string;
      const { quantity, type, referenceType, referenceId, notes, vendorId, purchaseDate, ratePerUnitPaisa } = req.body;
      if (quantity == null || !type) {
        res.status(422).json({ error: { code: 'VALIDATION_ERROR', message: 'quantity and type are required' } });
        return;
      }
      const data = await packagingService.recordAdjustment({
        materialId,
        quantity: Number(quantity),
        type,
        vendorId,
        purchaseDate,
        ratePerUnitPaisa: ratePerUnitPaisa != null ? Number(ratePerUnitPaisa) : undefined,
        referenceType,
        referenceId,
        notes,
        createdBy: req.user!.userId,
      });
      res.json({ data });
    } catch (error) { next(error); }
  }

  async listAdjustments(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const materialId = req.params.id as string;
      const data = await packagingService.listAdjustments(materialId);
      res.json({ data });
    } catch (error) { next(error); }
  }
}

export const packagingController = new PackagingController();
