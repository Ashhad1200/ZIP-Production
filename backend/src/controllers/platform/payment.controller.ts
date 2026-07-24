import { Response, NextFunction } from 'express';
import { paymentService } from '../../services/platform/payment.service';
import { organizationService } from '../../services/platform/organization.service';
import { AuthenticatedRequest, PlatformAuthenticatedRequest } from '../../types';

export class PaymentController {
  /** Tenant-authenticated — submit proof of a manual bank transfer. */
  async submit(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { amountClaimedPaisa, screenshotUrl, transactionRef, bankAccountId } = req.body;

      if (!amountClaimedPaisa || !screenshotUrl) {
        res.status(422).json({
          error: { code: 'VALIDATION_ERROR', message: 'amountClaimedPaisa and screenshotUrl are required' },
        });
        return;
      }

      const organizationId = await organizationService.getOrganizationIdForUser(req.user!.userId);
      if (!organizationId) {
        res.status(422).json({
          error: { code: 'NO_ORGANIZATION', message: 'This user is not attached to an organization' },
        });
        return;
      }

      const payment = await paymentService.submit({
        organizationId,
        amountClaimedPaisa: BigInt(amountClaimedPaisa),
        screenshotUrl,
        transactionRef,
        bankAccountId,
      });

      res.status(201).json({ data: payment });
    } catch (error) {
      next(error);
    }
  }

  /** Backoffice — payments queue. */
  async list(req: PlatformAuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const status = req.query.status as 'PENDING' | 'VERIFIED' | 'REJECTED' | undefined;
      const payments = await paymentService.list(status);
      res.json({ data: payments });
    } catch (error) {
      next(error);
    }
  }

  async verify(req: PlatformAuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const payment = await paymentService.verify(req.params.id as string, req.platformAdmin!.adminId);
      res.json({ data: payment });
    } catch (error) {
      next(error);
    }
  }

  async reject(req: PlatformAuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { reason } = req.body;
      if (!reason) {
        res.status(422).json({ error: { code: 'VALIDATION_ERROR', message: 'reason is required' } });
        return;
      }
      const payment = await paymentService.reject(req.params.id as string, req.platformAdmin!.adminId, reason);
      res.json({ data: payment });
    } catch (error) {
      next(error);
    }
  }
}

export const paymentController = new PaymentController();
