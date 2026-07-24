import { Request, Response, NextFunction } from 'express';
import { moduleService } from '../../services/platform/module.service';

export class ModuleController {
  async list(_req: Request, res: Response, next: NextFunction) {
    try {
      res.json({ data: await moduleService.list() });
    } catch (error) {
      next(error);
    }
  }
}

export const moduleController = new ModuleController();
