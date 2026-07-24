import { Request, Response, NextFunction } from 'express';
import { planService } from '../../services/platform/plan.service';

export class PlanController {
  /** Public — plan comparison for the marketing/signup page. */
  async listPublic(_req: Request, res: Response, next: NextFunction) {
    try {
      const plans = (await planService.list()).filter((p) => p.isActive);
      res.json({ data: plans });
    } catch (error) {
      next(error);
    }
  }

  async list(_req: Request, res: Response, next: NextFunction) {
    try {
      res.json({ data: await planService.list() });
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      res.json({ data: await planService.getById(req.params.id as string) });
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const { name, code, pricePaisa, billingCycleDays, trialDays, maxSubCompanies, maxUsers, sortOrder, moduleKeys } = req.body;

      if (!name || !code || pricePaisa === undefined || !Array.isArray(moduleKeys)) {
        res.status(422).json({
          error: { code: 'VALIDATION_ERROR', message: 'name, code, pricePaisa and moduleKeys[] are required' },
        });
        return;
      }

      const plan = await planService.create({
        name,
        code,
        pricePaisa: BigInt(pricePaisa),
        billingCycleDays,
        trialDays,
        maxSubCompanies,
        maxUsers,
        sortOrder,
        moduleKeys,
      });
      res.status(201).json({ data: plan });
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const { name, code, pricePaisa, billingCycleDays, trialDays, maxSubCompanies, maxUsers, sortOrder, moduleKeys } = req.body;
      const plan = await planService.update(req.params.id as string, {
        name,
        code,
        pricePaisa: pricePaisa !== undefined ? BigInt(pricePaisa) : undefined,
        billingCycleDays,
        trialDays,
        maxSubCompanies,
        maxUsers,
        sortOrder,
        moduleKeys,
      });
      res.json({ data: plan });
    } catch (error) {
      next(error);
    }
  }

  async setActive(req: Request, res: Response, next: NextFunction) {
    try {
      const { isActive } = req.body;
      const plan = await planService.setActive(req.params.id as string, Boolean(isActive));
      res.json({ data: plan });
    } catch (error) {
      next(error);
    }
  }
}

export const planController = new PlanController();
