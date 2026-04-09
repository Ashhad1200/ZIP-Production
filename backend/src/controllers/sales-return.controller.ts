import { Response, NextFunction } from 'express';
import { salesReturnService } from '../services/sales-return.service';
import { AuthenticatedRequest } from '../types';

export class SalesReturnController {
  // ─── List ──────────────────────────────────────────────────────────────────

  async list(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { page, limit, clientId, gatePassId, dateFrom, dateTo } = req.query;

      const result = await salesReturnService.list({
        page: parseInt(page as string) || 1,
        limit: Math.min(100, Math.max(1, parseInt(limit as string) || 20)),
        clientId: clientId as string | undefined,
        gatePassId: gatePassId as string | undefined,
        dateFrom: dateFrom as string | undefined,
        dateTo: dateTo as string | undefined,
      });

      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  // ─── Get by ID ─────────────────────────────────────────────────────────────

  async getById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await salesReturnService.getById(req.params.id as string);
      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  }

  // ─── Create ────────────────────────────────────────────────────────────────

  async create(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { gatePassId, date, reason, lineItems } = req.body;

      if (!gatePassId || !date || !lineItems || !Array.isArray(lineItems) || lineItems.length === 0) {
        res.status(422).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Missing required fields: gatePassId, date, lineItems (non-empty array)',
          },
        });
        return;
      }

      for (const item of lineItems) {
        if (!item.gatePassLineItemId || !item.metersReturned || item.metersReturned <= 0) {
          res.status(422).json({
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Each line item must have gatePassLineItemId and metersReturned > 0',
            },
          });
          return;
        }
      }

      const result = await salesReturnService.create(
        { gatePassId, date, reason, lineItems },
        req.user!.userId,
      );

      res.status(201).json({ data: result });
    } catch (error) {
      next(error);
    }
  }
}

export const salesReturnController = new SalesReturnController();
