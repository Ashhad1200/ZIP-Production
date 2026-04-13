import { Request, Response, NextFunction } from 'express';
import { vendorService } from '../services/vendor.service';
import { AuthenticatedRequest } from '../types';

export class VendorController {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const { includeInactive, search } = req.query;
      const result = await vendorService.list({
        includeInactive: includeInactive === 'true',
        search: search as string | undefined,
      });
      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await vendorService.getById(req.params.id as string);
      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  }

  async create(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { name, contactName, phone, address, grainTypes } = req.body;
      if (!name?.trim()) {
        res.status(422).json({ error: { code: 'VALIDATION_ERROR', message: 'Vendor name is required' } });
        return;
      }
      const result = await vendorService.create({ name, contactName, phone, address, grainTypes }, req.user!.userId);
      res.status(201).json({ data: result });
    } catch (error) {
      next(error);
    }
  }

  async update(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await vendorService.update(req.params.id as string, req.body, req.user!.userId);
      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  }

  async remove(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await vendorService.remove(req.params.id as string, req.user!.userId);
      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  }
}

export const vendorController = new VendorController();
