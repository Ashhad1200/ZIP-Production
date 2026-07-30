import { Request, Response, NextFunction } from 'express';
import { organizationService } from '../../services/platform/organization.service';
import { AuthenticatedRequest } from '../../types';

export class OrganizationController {
  /** Tenant-authenticated — current user's org subscription status (for the billing screen). */
  async getMySubscription(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const subscription = await organizationService.getMySubscription(req.user!.userId);
      res.json({ data: subscription });
    } catch (error) {
      next(error);
    }
  }

  /** Public — self-serve signup from the marketing site. */
  async signup(req: Request, res: Response, next: NextFunction) {
    try {
      const { organizationName, contactName, contactEmail, contactPhone, industry, adminUserName, password, planCode } = req.body;

      if (!organizationName || !contactName || !contactEmail || !adminUserName || !password || !planCode) {
        res.status(422).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'organizationName, contactName, contactEmail, adminUserName, password and planCode are required',
          },
        });
        return;
      }

      if (password.length < 8) {
        res.status(422).json({
          error: { code: 'VALIDATION_ERROR', message: 'Password must be at least 8 characters' },
        });
        return;
      }

      const result = await organizationService.signup({
        organizationName,
        contactName,
        contactEmail,
        contactPhone,
        industry,
        adminUserName,
        password,
        planCode,
      });

      res.status(201).json({ data: result });
    } catch (error) {
      next(error);
    }
  }

  /** Backoffice — list all registered organizations. */
  async list(_req: Request, res: Response, next: NextFunction) {
    try {
      const organizations = await organizationService.list();
      res.json({ data: organizations });
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const organization = await organizationService.getById(req.params.id as string);
      res.json({ data: organization });
    } catch (error) {
      next(error);
    }
  }

  async setStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { status } = req.body;
      if (!['ACTIVE', 'SUSPENDED', 'CANCELED'].includes(status)) {
        res.status(422).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid status' } });
        return;
      }
      const organization = await organizationService.setStatus(req.params.id as string, status);
      res.json({ data: organization });
    } catch (error) {
      next(error);
    }
  }
}

export const organizationController = new OrganizationController();
