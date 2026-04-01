import { Response, NextFunction } from 'express';
import { OrderStatus } from '@prisma/client';
import { orderService } from '../services/order.service';
import { AuthenticatedRequest } from '../types';

export class OrderController {
  async listOrders(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { page, limit, clientId, status, variantId, dateFrom, dateTo, overdue, sortBy, sortOrder } = req.query;
      const result = await orderService.listOrders(
        {
          page: parseInt(page as string) || 1,
          limit: Math.min(100, Math.max(1, parseInt(limit as string) || 20)),
          clientId: clientId as string | undefined,
          status: status as OrderStatus | undefined,
          variantId: variantId as string | undefined,
          dateFrom: dateFrom as string | undefined,
          dateTo: dateTo as string | undefined,
          overdue: overdue === 'true',
          sortBy: sortBy as string | undefined,
          sortOrder: sortOrder as 'asc' | 'desc' | undefined,
        },
        req.user!.role
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async createOrder(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { clientId, variantId, metersOrdered, ratePerMeterPaisa, deliveryDeadline } = req.body;

      if (!clientId || !variantId || metersOrdered == null || ratePerMeterPaisa == null || !deliveryDeadline) {
        res.status(422).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Missing required fields: clientId, variantId, metersOrdered, ratePerMeterPaisa, deliveryDeadline',
          },
        });
        return;
      }

      const result = await orderService.createOrder(
        { clientId, variantId, metersOrdered, ratePerMeterPaisa, deliveryDeadline },
        req.user!.userId
      );

      res.status(201).json({ data: result });
    } catch (error) {
      next(error);
    }
  }

  async getOrderById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await orderService.getOrderById(req.params.id as string, req.user!.role);
      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  }

  async getOrdersByClient(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await orderService.getOrdersByClient(req.params.clientId as string, req.user!.role);
      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  }

  async getFulfillmentReport(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await orderService.getFulfillmentReport();
      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  }
}

export const orderController = new OrderController();
