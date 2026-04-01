import { Response, NextFunction } from 'express';
import { GatePassStatus, Shift } from '@prisma/client';
import { gatePassService } from '../services/gate-pass.service';
import { AuthenticatedRequest } from '../types';

export class GatePassController {
  // ─── List gate passes ──────────────────────────────────────────────────────

  async list(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { page, limit, clientId, status, dateFrom, dateTo, shift, sortBy, sortOrder } = req.query;

      const result = await gatePassService.list(
        {
          page: parseInt(page as string) || 1,
          limit: Math.min(100, Math.max(1, parseInt(limit as string) || 20)),
          clientId: clientId as string | undefined,
          status: status as GatePassStatus | undefined,
          dateFrom: dateFrom as string | undefined,
          dateTo: dateTo as string | undefined,
          shift: shift as Shift | undefined,
          sortBy: (sortBy as string) || 'date',
          sortOrder: ((sortOrder as string) || 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc',
        },
        req.user?.role,
      );

      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  // ─── Create gate pass ─────────────────────────────────────────────────────

  async create(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { clientId, date, shift, orderId, lineItems } = req.body;

      if (!clientId || !date || !shift || !lineItems || !Array.isArray(lineItems) || lineItems.length === 0) {
        res.status(422).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Missing required fields: clientId, date, shift, lineItems (non-empty array)',
          },
        });
        return;
      }

      // Validate each line item
      for (const item of lineItems) {
        if (!item.variantId || !item.meters || item.meters <= 0) {
          res.status(422).json({
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Each line item must have variantId and meters > 0',
            },
          });
          return;
        }
      }

      const result = await gatePassService.create(
        { clientId, date, shift, orderId, lineItems },
        req.user!.userId,
      );

      res.status(201).json({ data: result });
    } catch (error) {
      next(error);
    }
  }

  // ─── Get gate pass by ID ──────────────────────────────────────────────────

  async getById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await gatePassService.getById(req.params.id as string);
      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  }

  // ─── Update status ─────────────────────────────────────────────────────────

  async updateStatus(req: AuthenticatedRequest, res: Response, next: NextFunction) {
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

      const { status } = req.body;
      if (!status || !['DISPATCHED', 'RECEIVED'].includes(status)) {
        res.status(422).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'status must be DISPATCHED or RECEIVED',
          },
        });
        return;
      }

      const result = await gatePassService.updateStatus(
        req.params.id as string,
        { status },
        expectedVersion,
        req.user!.userId,
      );

      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  }

  // ─── QR Verification (PUBLIC) ──────────────────────────────────────────────

  async verify(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { token } = req.body;
      if (!token || typeof token !== 'string') {
        res.status(422).json({
          error: { code: 'VALIDATION_ERROR', message: 'token is required' },
        });
        return;
      }

      const result = await gatePassService.verifyToken(token);
      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  }

  // ─── PDF data ──────────────────────────────────────────────────────────────

  async getPdfData(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await gatePassService.getPdfData(req.params.id as string);
      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  }

  // ─── Lookups ───────────────────────────────────────────────────────────────

  async getClients(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await gatePassService.getClients();
      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  }

  async getVariants(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await gatePassService.getVariants();
      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  }

  async getClientOrders(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { clientId } = req.params;
      if (!clientId) {
        res.status(422).json({
          error: { code: 'VALIDATION_ERROR', message: 'clientId is required' },
        });
        return;
      }
      const result = await gatePassService.getClientOrders(clientId as string);
      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  }

  async getClientRate(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { clientId, variantId } = req.query;
      if (!clientId || !variantId) {
        res.status(422).json({
          error: { code: 'VALIDATION_ERROR', message: 'clientId and variantId are required' },
        });
        return;
      }
      const result = await gatePassService.getClientRate(clientId as string, variantId as string);
      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  }

  async getStock(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { variantId } = req.params;
      if (!variantId) {
        res.status(422).json({
          error: { code: 'VALIDATION_ERROR', message: 'variantId is required' },
        });
        return;
      }
      const result = await gatePassService.getStockForVariant(variantId as string);
      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  }
}

export const gatePassController = new GatePassController();
